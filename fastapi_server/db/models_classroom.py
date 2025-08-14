"""
教室MAP管理用データベースモデル
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
    DECIMAL,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base


class ClassroomMap(Base):
    """教室MAPテーブル"""

    __tablename__ = "classroom_maps"

    id = Column(Integer, primary_key=True, index=True)
    image_filename = Column(String(255), nullable=False)
    image_url = Column(Text, nullable=False)
    original_filename = Column(String(255), nullable=True)
    uploaded_at = Column(DateTime, default=func.now(), nullable=False, index=True)
    uploaded_by = Column(String(255), nullable=True)  # 講師メールアドレス
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    file_size_bytes = Column(Integer, default=0)
    content_type = Column(String(100), default="image/jpeg")

    # リレーション
    team_positions = relationship(
        "TeamPosition", back_populates="classroom_map", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<ClassroomMap(id={self.id}, filename='{self.image_filename}', active={self.is_active})>"


class TeamPosition(Base):
    """チーム配置情報テーブル"""

    __tablename__ = "team_positions"

    id = Column(Integer, primary_key=True, index=True)
    map_id = Column(
        Integer,
        ForeignKey("classroom_maps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    team_name = Column(String(100), nullable=False, index=True)
    position_x = Column(DECIMAL(5, 2), nullable=False)  # パーセント座標 0-100
    position_y = Column(DECIMAL(5, 2), nullable=False)  # パーセント座標 0-100
    updated_at = Column(
        DateTime, default=func.now(), onupdate=func.now(), nullable=False
    )
    updated_by = Column(String(255), nullable=True)  # 更新者メールアドレス

    # リレーション
    classroom_map = relationship("ClassroomMap", back_populates="team_positions")

    def __repr__(self):
        return f"<TeamPosition(id={self.id}, team='{self.team_name}', pos=({self.position_x}, {self.position_y}))>"

    @property
    def position_dict(self):
        """座標を辞書形式で返す"""
        return {"x": float(self.position_x), "y": float(self.position_y)}
