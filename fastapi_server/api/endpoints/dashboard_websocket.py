from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import List, Dict
import json
import asyncio
import logging

from core.connection_manager import ConnectionManager
from db.redis_client import get_redis_client
import redis.asyncio as redis

router = APIRouter()
logger = logging.getLogger(__name__)

# Dashboard WebSocket接続管理
dashboard_manager = ConnectionManager()


@router.websocket("/ws/dashboard")
async def dashboard_websocket_endpoint(websocket: WebSocket):
    """
    ダッシュボード用WebSocketエンドポイント
    学習進捗の リアルタイム更新を配信
    """
    connection_id = f"dashboard_{id(websocket)}"

    try:
        await dashboard_manager.connect(websocket)
        logger.info(f"Dashboard WebSocket connected: {connection_id}")

        # Redis Pub/Sub接続を開始
        redis_client = redis.Redis(host="redis", port=6379, decode_responses=True)
        pubsub = redis_client.pubsub()
        await pubsub.subscribe("dashboard_updates")

        # Redis購読とWebSocket送信を並行処理
        await asyncio.gather(
            listen_for_dashboard_updates(websocket, pubsub),
            handle_websocket_messages(websocket),
            return_exceptions=True,
        )

    except WebSocketDisconnect:
        logger.info(f"Dashboard WebSocket disconnected: {connection_id}")
    except Exception as e:
        logger.error(f"Dashboard WebSocket error: {e}")
    finally:
        dashboard_manager.disconnect(websocket)
        try:
            await pubsub.close()
            await redis_client.close()
        except:
            pass


async def listen_for_dashboard_updates(websocket: WebSocket, pubsub):
    """
    Redis Pub/Subからダッシュボード更新イベントを受信し、WebSocket経由で送信
    """
    try:
        while True:
            message = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=1.0
            )
            if message:
                logger.info(f"Dashboard update received from Redis: {message['data']}")

                try:
                    # JSONデータをパース
                    update_data = json.loads(message["data"])

                    # WebSocket経由でダッシュボードに送信
                    await websocket.send_text(
                        json.dumps({"type": "progress_update", "data": update_data})
                    )
                    logger.info(
                        f"Sent dashboard update via WebSocket: {update_data['userId']}"
                    )

                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse dashboard update JSON: {e}")
                except Exception as e:
                    logger.error(f"Failed to send dashboard update: {e}")
                    break

    except Exception as e:
        logger.error(f"Dashboard updates listener error: {e}")


async def handle_websocket_messages(websocket: WebSocket):
    """
    WebSocketからのメッセージを処理（ping/pong, コマンド等）
    """
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                message_type = message.get("type")

                if message_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                elif message_type == "refresh_request":
                    # ダッシュボードリフレッシュ要求
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "refresh_required",
                                "message": "Please refresh dashboard data",
                            }
                        )
                    )
                else:
                    logger.info(f"Unknown message type: {message_type}")

            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON received: {data}")

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket message handler error: {e}")


@router.get("/ws/dashboard/status")
async def dashboard_websocket_status():
    """
    ダッシュボードWebSocket接続の状況を取得
    """
    return {
        "connected_clients": len(dashboard_manager.active_connections),
        "connection_ids": list(dashboard_manager.active_connections.keys()),
    }


# ダッシュボードへのブロードキャスト機能
class DashboardNotifier:
    """ダッシュボードへの通知管理"""

    @staticmethod
    async def broadcast_student_update(user_id: str, update_data: dict):
        """特定の学生の更新をダッシュボードにブロードキャスト"""
        try:
            message = {
                "type": "student_update",
                "userId": user_id,
                "data": update_data,
                "timestamp": update_data.get("timestamp"),
            }

            await dashboard_manager.broadcast(json.dumps(message))
            logger.info(f"Broadcasted student update: {user_id}")

        except Exception as e:
            logger.error(f"Failed to broadcast student update: {e}")

    @staticmethod
    async def broadcast_metrics_update(metrics: dict):
        """クラス全体のメトリクス更新をダッシュボードにブロードキャスト"""
        try:
            message = {
                "type": "metrics_update",
                "data": metrics,
                "timestamp": metrics.get("timestamp"),
            }

            await dashboard_manager.broadcast(json.dumps(message))
            logger.info("Broadcasted metrics update")

        except Exception as e:
            logger.error(f"Failed to broadcast metrics update: {e}")


# グローバルインスタンス
dashboard_notifier = DashboardNotifier()
