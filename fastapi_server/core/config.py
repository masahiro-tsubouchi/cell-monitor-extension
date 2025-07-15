from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Union

class Settings(BaseSettings):
    PROJECT_NAME: str = "Student Progress Tracker API"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # 開発中は["*"]で全てのオリジンを許可
    BACKEND_CORS_ORIGINS: List[str] = ["*"]

    # PostgreSQL
    POSTGRES_USER: str = "admin"
    POSTGRES_PASSWORD: str = "secretpassword"
    POSTGRES_SERVER: str = "postgres"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "progress_db"
    DATABASE_URL: str = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_SERVER}:{POSTGRES_PORT}/{POSTGRES_DB}"

    # InfluxDB
    INFLUXDB_URL: str = "http://influxdb:8086"
    INFLUXDB_TOKEN: str = "my-super-secret-token"
    INFLUXDB_ORG: str = "my-org"
    INFLUXDB_BUCKET: str = "progress_bucket"

    # Redis
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379

    # Pydantic v2 では Config クラスの代わりに model_config を使用
    model_config = SettingsConfigDict(case_sensitive=True)

settings = Settings()
