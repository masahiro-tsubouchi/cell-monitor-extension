"""
教室MAP管理用Pydanticスキーマ
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal


class TeamPositionBase(BaseModel):
    """チーム配置情報ベーススキーマ"""

    team_name: str = Field(..., description="チーム名")
    position_x: float = Field(..., ge=0, le=100, description="X座標(パーセント 0-100)")
    position_y: float = Field(..., ge=0, le=100, description="Y座標(パーセント 0-100)")


class TeamPositionCreate(TeamPositionBase):
    """チーム配置情報作成スキーマ"""

    updated_by: Optional[str] = Field(None, description="更新者メールアドレス")


class TeamPositionUpdate(BaseModel):
    """チーム配置情報更新スキーマ"""

    position_x: Optional[float] = Field(
        None, ge=0, le=100, description="X座標(パーセント 0-100)"
    )
    position_y: Optional[float] = Field(
        None, ge=0, le=100, description="Y座標(パーセント 0-100)"
    )
    updated_by: Optional[str] = Field(None, description="更新者メールアドレス")


class TeamPosition(TeamPositionBase):
    """チーム配置情報レスポンススキーマ"""

    id: int
    map_id: int
    updated_at: datetime
    updated_by: Optional[str]

    class Config:
        from_attributes = True


class ClassroomMapBase(BaseModel):
    """教室MAPベーススキーマ"""

    original_filename: Optional[str] = Field(None, description="オリジナルファイル名")
    uploaded_by: Optional[str] = Field(None, description="アップロード者メールアドレス")


class ClassroomMapCreate(ClassroomMapBase):
    """教室MAP作成スキーマ"""

    image_filename: str = Field("", description="保存されたファイル名（デフォルトMAPの場合は空文字）")
    image_url: str = Field("", description="画像URL（デフォルトMAPの場合は空文字）")
    file_size_bytes: Optional[int] = Field(0, description="ファイルサイズ(バイト)")
    content_type: Optional[str] = Field(None, description="コンテンツタイプ")


class ClassroomMapUpdate(BaseModel):
    """教室MAP更新スキーマ"""

    is_active: Optional[bool] = Field(None, description="アクティブ状態")


class ClassroomMap(ClassroomMapBase):
    """教室MAPレスポンススキーマ"""

    id: int
    image_filename: str
    image_url: str
    uploaded_at: datetime
    is_active: bool
    file_size_bytes: Optional[int]
    content_type: Optional[str]
    team_positions: List[TeamPosition] = Field(
        default_factory=list, description="チーム配置情報"
    )

    class Config:
        from_attributes = True


class ClassroomMapWithPositions(BaseModel):
    """MAP情報とチーム配置を含む完全スキーマ"""

    map_info: Optional[ClassroomMap] = Field(None, description="MAP情報")
    team_positions: Dict[str, Dict[str, float]] = Field(
        default_factory=dict,
        description="チーム配置情報 {team_name: {x: float, y: float}}",
    )
    is_visible: bool = Field(True, description="MAP表示状態")

    class Config:
        from_attributes = True


class TeamPositionBulkUpdate(BaseModel):
    """チーム配置一括更新スキーマ"""

    positions: Dict[str, Dict[str, float]] = Field(
        ..., description="チーム配置情報 {team_name: {x: float, y: float}}"
    )
    updated_by: Optional[str] = Field(None, description="更新者メールアドレス")


class MapUploadResponse(BaseModel):
    """MAPアップロードレスポンススキーマ"""

    success: bool
    message: str
    map_id: Optional[int] = None
    image_url: Optional[str] = None


class ErrorResponse(BaseModel):
    """エラーレスポンススキーマ"""

    success: bool = False
    error: str
    details: Optional[str] = None
