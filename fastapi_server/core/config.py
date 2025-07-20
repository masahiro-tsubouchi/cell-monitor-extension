from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Union
from pydantic import computed_field


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

    # Pydantic v2 では Config クラスの代わりに model_config を使用
    model_config = SettingsConfigDict(case_sensitive=True)


settings = Settings()
