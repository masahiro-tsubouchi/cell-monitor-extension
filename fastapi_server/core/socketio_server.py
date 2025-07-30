"""
Socket.IOサーバー実装
instructor-dashboardとの互換性を提供するSocket.IOサーバー

TDD開発ルール準拠:
- 既存のネイティブWebSocket実装（13個テスト成功）を維持
- Socket.IO互換性を追加で提供
- 講師認証機能統合
"""

import socketio
import asyncio
import logging
import time
from typing import Dict, Any
from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.security import verify_token
from crud.crud_instructor import get_instructor_by_email
from db.session import get_db

# ログ設定
logger = logging.getLogger("socketio_auth")
logger.setLevel(logging.DEBUG)


class InstructorSocketIOManager:
    """講師向けSocket.IOサーバー管理クラス"""

    def __init__(self):
        # Socket.IOサーバーの初期化
        self.sio = socketio.AsyncServer(
            cors_allowed_origins="*", logger=True, engineio_logger=True
        )
        self.instructor_sessions: Dict[str, Dict] = {}

        # イベントハンドラーの登録
        self.register_event_handlers()

    def register_event_handlers(self):
        """Socket.IOイベントハンドラーを登録"""

        @self.sio.event
        async def connect(sid, environ, auth):
            """クライアント接続時の認証処理（詳細ログ付き）"""
            auth_start_time = time.time()
            logger.info(f"Socket.IO connection attempt started (sid: {sid})")

            try:
                # 認証情報の詳細ログ
                logger.debug(f"Auth data received (sid: {sid}): {auth}")
                logger.debug(
                    f"Environment data (sid: {sid}): {environ.get('HTTP_ORIGIN', 'Unknown')}"
                )

                # 認証トークンの検証
                token = auth.get("token") if auth else None
                if not token:
                    logger.warning(
                        f"Socket.IO connection rejected: No token provided (sid: {sid})"
                    )
                    await self.sio.disconnect(sid)
                    return False

                if not token.strip():
                    logger.warning(
                        f"Socket.IO connection rejected: Empty token provided (sid: {sid})"
                    )
                    await self.sio.disconnect(sid)
                    return False

                logger.debug(
                    f"Token validation starting (sid: {sid}), token length: {len(token)}"
                )

                # JWTトークンの検証
                try:
                    payload = verify_token(token)
                    if not payload:
                        logger.error(
                            f"Socket.IO connection rejected: Token verification returned None (sid: {sid})"
                        )
                        await self.sio.disconnect(sid)
                        return False
                    logger.debug(
                        f"Token verification successful (sid: {sid}), payload: {payload}"
                    )
                except Exception as token_error:
                    logger.error(
                        f"Socket.IO connection rejected: Token verification failed (sid: {sid}), error: {str(token_error)}"
                    )
                    await self.sio.disconnect(sid)
                    return False

                instructor_email = payload.get("sub")
                if not instructor_email:
                    logger.error(
                        f"Socket.IO connection rejected: No email in token payload (sid: {sid}), payload: {payload}"
                    )
                    await self.sio.disconnect(sid)
                    return False

                logger.debug(
                    f"Instructor email extracted (sid: {sid}): {instructor_email}"
                )

                # 講師情報の取得
                db: Session = next(get_db())
                try:
                    logger.debug(
                        f"Database lookup starting for instructor (sid: {sid}): {instructor_email}"
                    )
                    instructor = get_instructor_by_email(db, instructor_email)

                    if not instructor:
                        logger.warning(
                            f"Socket.IO connection rejected: Instructor not found (sid: {sid}), email: {instructor_email}"
                        )
                        await self.sio.disconnect(sid)
                        return False

                    if not instructor.is_active:
                        logger.warning(
                            f"Socket.IO connection rejected: Instructor inactive (sid: {sid}), instructor_id: {instructor.id}, email: {instructor_email}"
                        )
                        await self.sio.disconnect(sid)
                        return False

                    logger.info(
                        f"Instructor validation successful (sid: {sid}), instructor_id: {instructor.id}, name: {instructor.name}"
                    )

                    # セッション情報の保存
                    self.instructor_sessions[sid] = {
                        "instructor_id": instructor.id,
                        "instructor_email": instructor_email,
                        "instructor_name": instructor.name,
                        "connected_at": asyncio.get_event_loop().time(),
                    }

                    auth_duration = time.time() - auth_start_time
                    logger.info(
                        f"Socket.IO instructor connected successfully: {instructor.name} (sid: {sid}), auth_duration: {auth_duration:.3f}s"
                    )

                    # 接続成功通知
                    await self.sio.emit(
                        "connection_success",
                        {
                            "instructor_id": instructor.id,
                            "instructor_name": instructor.name,
                            "status": "connected",
                            "auth_duration": auth_duration,
                        },
                        room=sid,
                    )

                    logger.debug(f"Connection success event emitted (sid: {sid})")
                    return True

                except Exception as db_error:
                    logger.error(
                        f"Database error during instructor lookup (sid: {sid}): {str(db_error)}"
                    )
                    await self.sio.disconnect(sid)
                    return False
                finally:
                    db.close()
                    logger.debug(f"Database connection closed (sid: {sid})")

            except Exception as e:
                auth_duration = time.time() - auth_start_time
                logger.error(
                    f"Socket.IO connection error (sid: {sid}): {str(e)}, auth_duration: {auth_duration:.3f}s"
                )
                await self.sio.disconnect(sid)
                return False

        @self.sio.event
        async def disconnect(sid):
            """クライアント切断時の処理"""
            if sid in self.instructor_sessions:
                session_info = self.instructor_sessions[sid]
                print(
                    f"Socket.IO instructor disconnected: {session_info['instructor_name']} (sid: {sid})"
                )
                del self.instructor_sessions[sid]
            else:
                print(f"Socket.IO client disconnected: {sid}")

        @self.sio.event
        async def instructor_status_update(sid, data):
            """講師ステータス更新イベント"""
            if sid not in self.instructor_sessions:
                return

            session_info = self.instructor_sessions[sid]
            print(
                f"Instructor status update from {session_info['instructor_name']}: {data}"
            )

            # 他の講師にステータス更新をブロードキャスト
            await self.sio.emit(
                "instructor_status_update",
                {
                    "instructor_id": session_info["instructor_id"],
                    "instructor_name": session_info["instructor_name"],
                    "status": data.get("status"),
                    "location": data.get("location"),
                    "timestamp": asyncio.get_event_loop().time(),
                },
                skip_sid=sid,
            )

        @self.sio.event
        async def student_help_request(sid, data):
            """学生ヘルプ要請イベント"""
            if sid not in self.instructor_sessions:
                return

            print(f"Student help request: {data}")

            # 全講師にヘルプ要請をブロードキャスト
            await self.sio.emit(
                "student_help_request",
                {
                    "student_id": data.get("student_id"),
                    "student_name": data.get("student_name"),
                    "seat_number": data.get("seat_number"),
                    "help_type": data.get("help_type", "general"),
                    "timestamp": asyncio.get_event_loop().time(),
                },
            )

    async def broadcast_to_instructors(self, event: str, data: dict):
        """全講師にメッセージをブロードキャスト"""
        await self.sio.emit(event, data)

    async def send_to_instructor(self, instructor_id: int, event: str, data: dict):
        """特定の講師にメッセージを送信"""
        for sid, session_info in self.instructor_sessions.items():
            if session_info["instructor_id"] == instructor_id:
                await self.sio.emit(event, data, room=sid)
                break

    def get_connected_instructors(self) -> list:
        """接続中の講師一覧を取得"""
        return [
            {
                "instructor_id": info["instructor_id"],
                "instructor_name": info["instructor_name"],
                "instructor_email": info["instructor_email"],
                "connected_at": info["connected_at"],
            }
            for info in self.instructor_sessions.values()
        ]


# グローバルインスタンス
instructor_socketio_manager = InstructorSocketIOManager()
