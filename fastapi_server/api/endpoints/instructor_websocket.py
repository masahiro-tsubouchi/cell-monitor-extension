"""
講師認証付きWebSocketエンドポイント

Phase 4: WebSocket統合・イベント連携
- 講師認証付きWebSocket接続
- 講師ステータス変更のリアルタイム通知
- 学生-講師間リアルタイム通信
"""

import json
from typing import Dict, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from sqlalchemy.orm import Session

from core.connection_manager import manager
from core.security import verify_token
from db.session import get_db
from crud.crud_instructor import get_instructor_by_email, update_instructor_status
from db.models import InstructorStatus

router = APIRouter()


class InstructorConnectionManager:
    """講師専用WebSocket接続管理クラス"""

    def __init__(self):
        self.instructor_connections: Dict[int, WebSocket] = {}
        self.connection_info: Dict[int, Dict] = {}

    async def connect_instructor(
        self, instructor_id: int, websocket: WebSocket, instructor_email: str
    ):
        """講師のWebSocket接続を確立"""
        await websocket.accept()
        self.instructor_connections[instructor_id] = websocket
        self.connection_info[instructor_id] = {
            "email": instructor_email,
            "connected_at": datetime.now(timezone.utc),
            "status": "AVAILABLE",
        }

        # 接続成功メッセージを送信
        await websocket.send_text(
            json.dumps(
                {
                    "type": "connection_success",
                    "instructor_id": instructor_id,
                    "connected_at": datetime.now(timezone.utc).isoformat(),
                    "message": "講師WebSocket接続が確立されました",
                }
            )
        )

    def disconnect_instructor(self, instructor_id: int):
        """講師のWebSocket接続を切断"""
        if instructor_id in self.instructor_connections:
            del self.instructor_connections[instructor_id]
        if instructor_id in self.connection_info:
            del self.connection_info[instructor_id]

    async def send_to_instructor(self, instructor_id: int, message: dict):
        """特定の講師にメッセージを送信"""
        if instructor_id in self.instructor_connections:
            websocket = self.instructor_connections[instructor_id]
            await websocket.send_text(json.dumps(message))

    async def broadcast_to_all_instructors(self, message: dict):
        """全講師にメッセージをブロードキャスト"""
        for instructor_id, websocket in self.instructor_connections.items():
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                print(f"Error broadcasting to instructor {instructor_id}: {e}")

    def get_connected_instructors(self) -> Dict[int, Dict]:
        """接続中の講師一覧を取得"""
        return self.connection_info.copy()


# 講師専用接続マネージャーのシングルトンインスタンス
instructor_manager = InstructorConnectionManager()


async def authenticate_websocket_token(token: str, db: Session) -> Optional[dict]:
    """WebSocket用JWTトークン認証"""
    try:
        print(f"WebSocket auth: Verifying token: {token[:20]}...")
        payload = verify_token(token)
        print(f"WebSocket auth: Token payload: {payload}")
        if payload is None:
            print("WebSocket auth: Token verification failed")
            return None

        email = payload.get("sub")
        print(f"WebSocket auth: Email from token: {email}")
        if email is None:
            print("WebSocket auth: No email in token")
            return None

        instructor = get_instructor_by_email(db, email)
        print(f"WebSocket auth: Instructor found: {instructor is not None}")
        if instructor is not None:
            print(f"WebSocket auth: Instructor active: {instructor.is_active}")

        if instructor is None or not instructor.is_active:
            print("WebSocket auth: Instructor not found or inactive")
            return None

        print(
            f"WebSocket auth: Authentication successful for instructor {instructor.id}"
        )
        return {
            "instructor_id": instructor.id,
            "email": instructor.email,
            "name": instructor.name,
        }
    except Exception as e:
        print(f"WebSocket authentication error: {e}")
        import traceback

        traceback.print_exc()
        return None


@router.websocket("/ws/instructor/{instructor_id}")
async def instructor_websocket_endpoint(
    websocket: WebSocket,
    instructor_id: int,
    token: str = Query(..., description="JWT認証トークン"),
):
    """
    講師認証付きWebSocketエンドポイント

    Args:
        websocket: WebSocket接続
        instructor_id: 講師ID
        token: JWT認証トークン
    """
    # データベースセッションを取得（テスト環境での依存性オーバーライドを考慮）
    db_gen = get_db()
    db = next(db_gen)

    try:
        print(
            f"WebSocket endpoint: Starting authentication for instructor {instructor_id}"
        )
        # トークン認証
        auth_info = await authenticate_websocket_token(token, db)
        print(f"WebSocket endpoint: Auth result: {auth_info}")
        if not auth_info or auth_info["instructor_id"] != instructor_id:
            print(
                f"WebSocket endpoint: Authentication failed - auth_info: {auth_info}, expected_id: {instructor_id}"
            )
            await websocket.close(code=4001, reason="Authentication failed")
            return

        # 講師WebSocket接続を確立
        await instructor_manager.connect_instructor(
            instructor_id, websocket, auth_info["email"]
        )

        print(
            f"Instructor #{instructor_id} ({auth_info['email']}) connected via WebSocket."
        )

        try:
            while True:
                # クライアントからのメッセージを受信
                data = await websocket.receive_text()
                message = json.loads(data)

                # メッセージタイプに応じて処理
                await handle_instructor_message(instructor_id, message, db)

        except WebSocketDisconnect:
            instructor_manager.disconnect_instructor(instructor_id)
            print(f"Instructor #{instructor_id} disconnected.")

    except Exception as e:
        print(f"WebSocket error for instructor {instructor_id}: {e}")
        await websocket.close(code=4000, reason="Internal server error")

    finally:
        db.close()


async def handle_instructor_message(instructor_id: int, message: dict, db: Session):
    """講師からのWebSocketメッセージを処理"""
    message_type = message.get("type")

    if message_type == "status_update":
        await handle_status_update(instructor_id, message, db)
    elif message_type == "student_message":
        await handle_student_message(instructor_id, message)
    elif message_type == "instructor_reply":
        await handle_instructor_reply(instructor_id, message)
    elif message_type == "instructor_to_instructor":
        await handle_instructor_to_instructor(instructor_id, message)
    else:
        # 未知のメッセージタイプ
        await instructor_manager.send_to_instructor(
            instructor_id,
            {"type": "error", "message": f"Unknown message type: {message_type}"},
        )


async def handle_status_update(instructor_id: int, message: dict, db: Session):
    """講師ステータス更新を処理"""
    try:
        status = message.get("status")
        session_id = message.get("session_id")

        # ステータスの妥当性チェック
        if status not in [s.value for s in InstructorStatus]:
            await instructor_manager.send_to_instructor(
                instructor_id, {"type": "error", "message": f"Invalid status: {status}"}
            )
            return

        # データベースでステータスを更新
        from schemas.instructor import InstructorStatusUpdate

        status_update = InstructorStatusUpdate(
            status=InstructorStatus(status), current_session_id=session_id
        )
        instructor = update_instructor_status(db, instructor_id, status_update)

        if instructor:
            # ステータス更新成功を通知
            response = {
                "type": "status_updated",
                "instructor_id": instructor_id,
                "status": status,
                "session_id": session_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

            await instructor_manager.send_to_instructor(instructor_id, response)

            # 他の講師にもステータス変更を通知
            broadcast_message = {
                "type": "instructor_status_changed",
                "instructor_id": instructor_id,
                "status": status,
                "session_id": session_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

            await instructor_manager.broadcast_to_all_instructors(broadcast_message)

    except Exception as e:
        await instructor_manager.send_to_instructor(
            instructor_id,
            {"type": "error", "message": f"Status update failed: {str(e)}"},
        )


async def handle_student_message(instructor_id: int, message: dict):
    """学生からのメッセージを処理"""
    student_id = message.get("student_id")
    content = message.get("message")
    timestamp = message.get("timestamp", datetime.now(timezone.utc).isoformat())

    # 講師にメッセージ受信を通知
    response = {
        "type": "student_message_received",
        "student_id": student_id,
        "message": content,
        "timestamp": timestamp,
        "received_at": datetime.now(timezone.utc).isoformat(),
    }

    await instructor_manager.send_to_instructor(instructor_id, response)


async def handle_instructor_reply(instructor_id: int, message: dict):
    """講師から学生への返信を処理"""
    student_id = message.get("student_id")
    content = message.get("message")
    timestamp = message.get("timestamp", datetime.now(timezone.utc).isoformat())

    # 返信送信確認を講師に通知
    response = {
        "type": "reply_sent",
        "student_id": student_id,
        "message": content,
        "timestamp": timestamp,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }

    await instructor_manager.send_to_instructor(instructor_id, response)

    # TODO: 実際の学生WebSocket接続に返信を送信する実装


async def handle_instructor_to_instructor(instructor_id: int, message: dict):
    """講師間メッセージを処理"""
    target_instructor_id = message.get("target_instructor_id")
    content = message.get("message")
    timestamp = message.get("timestamp", datetime.now(timezone.utc).isoformat())

    # 対象講師にメッセージを送信
    if target_instructor_id:
        target_message = {
            "type": "instructor_message_received",
            "from_instructor_id": instructor_id,
            "message": content,
            "timestamp": timestamp,
            "received_at": datetime.now(timezone.utc).isoformat(),
        }

        await instructor_manager.send_to_instructor(
            target_instructor_id, target_message
        )


@router.get("/ws/instructor/status")
async def get_connected_instructors():
    """接続中の講師一覧を取得するAPIエンドポイント"""
    return {
        "connected_instructors": instructor_manager.get_connected_instructors(),
        "total_connections": len(instructor_manager.instructor_connections),
    }
