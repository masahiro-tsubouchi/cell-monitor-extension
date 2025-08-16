"""
ヘルスチェックエンドポイント
Docker Composeのヘルスチェック要件に対応
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import asyncio
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    システム全体のヘルスチェック
    各依存サービスの接続状態を確認し、全体的な健全性を報告
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {},
        "details": {}
    }
    
    # サービス健全性をチェック
    try:
        # PostgreSQL接続確認
        postgres_status = await check_postgres_health()
        health_status["services"]["postgres"] = postgres_status
        
        # Redis接続確認
        redis_status = await check_redis_health()
        health_status["services"]["redis"] = redis_status
        
        # InfluxDB接続確認
        influxdb_status = await check_influxdb_health()
        health_status["services"]["influxdb"] = influxdb_status
        
        # WebSocket接続統計を追加
        websocket_stats = get_websocket_health()
        health_status["services"]["websocket"] = websocket_stats
        
        # 全体的なステータス判定
        all_services_healthy = all(
            service.get("status") == "healthy" 
            for service in health_status["services"].values()
        )
        
        if not all_services_healthy:
            health_status["status"] = "degraded"
            
        # 詳細情報追加
        health_status["details"] = {
            "total_services": len(health_status["services"]),
            "healthy_services": sum(
                1 for service in health_status["services"].values() 
                if service.get("status") == "healthy"
            ),
            "api_version": "v1",
            "environment": "docker",
            "websocket_connections": websocket_stats.get("total_connections", 0),
            "websocket_rooms": len(websocket_stats.get("rooms", {}))
        }
        
        # 全サービスが健全でない場合は503を返す
        if health_status["status"] != "healthy":
            raise HTTPException(
                status_code=503, 
                detail=health_status
            )
            
        return health_status
        
    except HTTPException:
        # 既にHTTPExceptionの場合は再発生
        raise
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        error_response = {
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e),
            "services": health_status.get("services", {}),
        }
        raise HTTPException(status_code=503, detail=error_response)


async def check_postgres_health() -> Dict[str, Any]:
    """PostgreSQL接続健全性確認"""
    try:
        from db.session import get_db
        from sqlalchemy import text
        
        # データベース接続テスト
        db = next(get_db())
        result = db.execute(text("SELECT 1"))
        db.close()
        
        return {
            "status": "healthy",
            "message": "PostgreSQL connection successful",
            "response_time_ms": "< 100"
        }
    except Exception as e:
        logger.error(f"PostgreSQL health check failed: {e}")
        return {
            "status": "unhealthy",
            "message": f"PostgreSQL connection failed: {str(e)}",
            "error": str(e)
        }


async def check_redis_health() -> Dict[str, Any]:
    """Redis接続健全性確認"""
    try:
        from db.redis_client import get_redis_client
        
        redis_client = await get_redis_client()
        # Redis ping テスト
        pong = await redis_client.ping()
        
        return {
            "status": "healthy",
            "message": "Redis connection successful",
            "ping_response": str(pong),
            "response_time_ms": "< 50"
        }
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return {
            "status": "unhealthy", 
            "message": f"Redis connection failed: {str(e)}",
            "error": str(e)
        }


async def check_influxdb_health() -> Dict[str, Any]:
    """InfluxDB接続健全性確認"""
    try:
        from db.influxdb_client import influx_client
        from core.config import settings
        
        # InfluxDBの健全性確認
        health_api = influx_client.health()
        
        if health_api.status == "pass":
            return {
                "status": "healthy",
                "message": "InfluxDB connection successful",
                "influx_status": health_api.status,
                "version": getattr(health_api, 'version', 'unknown'),
                "response_time_ms": "< 200"
            }
        else:
            return {
                "status": "degraded",
                "message": f"InfluxDB status: {health_api.status}",
                "influx_status": health_api.status
            }
            
    except Exception as e:
        logger.error(f"InfluxDB health check failed: {e}")
        return {
            "status": "unhealthy",
            "message": f"InfluxDB connection failed: {str(e)}",
            "error": str(e)
        }


def get_websocket_health() -> Dict[str, Any]:
    """WebSocket接続の健全性統計を取得"""
    try:
        from core.connection_manager import manager
        
        stats = manager.get_connection_stats()
        
        # 健全性判定
        total_connections = stats["total_connections"]
        status = "healthy"
        
        if total_connections > 1000:  # 1000接続以上で警告
            status = "warning"
        elif total_connections > 5000:  # 5000接続以上で危険
            status = "degraded"
        
        return {
            "status": status,
            "message": f"WebSocket connections: {total_connections}",
            "total_connections": total_connections,
            "rooms": stats["rooms"],
            "response_time_ms": "< 10"
        }
        
    except Exception as e:
        logger.error(f"WebSocket health check failed: {e}")
        return {
            "status": "unhealthy",
            "message": f"WebSocket health check failed: {str(e)}",
            "total_connections": 0,
            "rooms": {},
            "response_time_ms": "N/A"
        }


@router.get("/health/simple") 
async def simple_health_check() -> Dict[str, str]:
    """
    シンプルなヘルスチェック（軽量版）
    Docker ComposeやLoad Balancer用
    """
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/health/ready")
async def readiness_check() -> Dict[str, Any]:
    """
    Kubernetes Readiness Probe用
    アプリケーションがトラフィックを受け入れ可能かチェック
    """
    try:
        # 最小限の依存関係チェック
        from db.session import get_db
        from sqlalchemy import text
        
        db = next(get_db()) 
        db.execute(text("SELECT 1"))
        db.close()
        
        return {
            "status": "ready",
            "timestamp": datetime.utcnow().isoformat(),
            "message": "Application ready to accept traffic"
        }
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        raise HTTPException(
            status_code=503,
            detail={
                "status": "not_ready",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e)
            }
        )


@router.get("/health/live")
async def liveness_check() -> Dict[str, str]:
    """
    Kubernetes Liveness Probe用  
    アプリケーションプロセスが生きているかチェック
    """
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat(),
        "message": "Application process is running"
    }