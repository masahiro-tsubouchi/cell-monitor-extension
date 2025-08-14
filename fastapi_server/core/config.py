from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Union
from pydantic import computed_field, field_validator
import os
import logging


class Settings(BaseSettings):
    PROJECT_NAME: str = "Student Progress Tracker API"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # CORS設定（環境変数で制御可能）
    BACKEND_CORS_ORIGINS: Union[str, List[str]] = ["*"]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """CORS設定のバリデーションと解析"""
        if isinstance(v, str):
            if v == "*":
                logging.warning(
                    "⚠️  CORS設定が全オリジンを許可しています。本番環境では制限してください。"
                )
                return ["*"]
            # カンマ区切りの文字列を配列に変換
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]

    # PostgreSQL
    POSTGRES_USER: str = "admin"
    POSTGRES_PASSWORD: str = "secretpassword"
    POSTGRES_SERVER: str = "postgres"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "progress_db"

    @computed_field
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # InfluxDB
    INFLUXDB_URL: Union[str, None] = None
    INFLUXDB_SERVER: str = "http://influxdb"
    INFLUXDB_PORT: int = 8086

    @computed_field
    @property
    def DYNAMIC_INFLUXDB_URL(self) -> str:
        """環境変数でINFLUXDB_URLが指定されていればそれを使い、なければ組み立てる"""
        if self.INFLUXDB_URL:
            return self.INFLUXDB_URL
        return f"{self.INFLUXDB_SERVER}:{self.INFLUXDB_PORT}"

    INFLUXDB_TOKEN: str = "my-super-secret-token"
    INFLUXDB_ORG: str = "my-org"
    INFLUXDB_BUCKET: str = "progress_bucket"

    # Redis
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379

    # JWT Authentication
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def validate_secret_key(cls, v):
        """本番環境でのシークレットキーの安全性を検証"""
        if (
            os.getenv("NODE_ENV") == "production"
            and v == "your-secret-key-here-change-in-production"
        ):
            raise ValueError(
                "本番環境では必ずSECRET_KEYを変更してください。秘匿性の高いランダムな文字列を使用してください。"
            )
        if len(v) < 32:
            logging.warning(
                "⚠️  SECRET_KEYが短すぎます。セキュリティ向上のため、32文字以上の使用を推奨します。"
            )
        return v

    # 環境変数設定
    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # 未定義の環境変数を無視
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._log_configuration()

    def _log_configuration(self):
        """設定情報のログ出力（機密情報は除外）"""
        if os.getenv("DEBUG", "false").lower() == "true":
            env = os.getenv("NODE_ENV", "development")
            logging.info("🔧 FastAPI Configuration:")
            logging.info(f"  Project: {self.PROJECT_NAME} v{self.PROJECT_VERSION}")
            logging.info(f"  Environment: {env}")
            logging.info(f"  CORS Origins: {len(self.BACKEND_CORS_ORIGINS)} configured")
            logging.info(
                f"  Database: PostgreSQL@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}"
            )
            logging.info(f"  InfluxDB: {self.DYNAMIC_INFLUXDB_URL}")
            logging.info(f"  Redis: {self.REDIS_HOST}:{self.REDIS_PORT}")
            logging.info(
                f"  JWT: {self.ALGORITHM}, Expire: {self.ACCESS_TOKEN_EXPIRE_MINUTES}min"
            )
            if env == "production":
                logging.info("  🔐 Production security checks enabled")
            logging.info("  ⚠️  Sensitive values are hidden")


settings = Settings()
