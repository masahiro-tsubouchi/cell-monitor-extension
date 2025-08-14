"""
教室MAP管理用CRUD操作
"""

from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, and_

from db.models_classroom import ClassroomMap, TeamPosition
from schemas.classroom import (
    ClassroomMapCreate,
    ClassroomMapUpdate,
    TeamPositionCreate,
    TeamPositionUpdate,
    TeamPositionBulkUpdate,
)


class ClassroomMapCRUD:
    """教室MAP CRUD操作"""

    @staticmethod
    def get_active_map(db: Session) -> Optional[ClassroomMap]:
        """アクティブなMAP情報を取得"""
        return (
            db.query(ClassroomMap)
            .options(joinedload(ClassroomMap.team_positions))
            .filter(ClassroomMap.is_active == True)
            .order_by(desc(ClassroomMap.uploaded_at))
            .first()
        )

    @staticmethod
    def get_map_by_id(db: Session, map_id: int) -> Optional[ClassroomMap]:
        """MAP IDでMAP情報を取得"""
        return (
            db.query(ClassroomMap)
            .options(joinedload(ClassroomMap.team_positions))
            .filter(ClassroomMap.id == map_id)
            .first()
        )

    @staticmethod
    def get_all_maps(db: Session, limit: int = 10) -> List[ClassroomMap]:
        """全MAP情報を取得（最新順）"""
        return (
            db.query(ClassroomMap)
            .options(joinedload(ClassroomMap.team_positions))
            .order_by(desc(ClassroomMap.uploaded_at))
            .limit(limit)
            .all()
        )

    @staticmethod
    def create_map(db: Session, map_data: ClassroomMapCreate) -> ClassroomMap:
        """新しいMAPを作成"""
        # 既存のアクティブMAPを非アクティブ化
        db.query(ClassroomMap).filter(ClassroomMap.is_active == True).update(
            {ClassroomMap.is_active: False}
        )

        # 新しいMAPを作成
        db_map = ClassroomMap(**map_data.dict())
        db_map.is_active = True

        db.add(db_map)
        db.commit()
        db.refresh(db_map)
        return db_map

    @staticmethod
    def update_map(
        db: Session, map_id: int, map_update: ClassroomMapUpdate
    ) -> Optional[ClassroomMap]:
        """MAP情報を更新"""
        db_map = db.query(ClassroomMap).filter(ClassroomMap.id == map_id).first()
        if not db_map:
            return None

        # アクティブ状態の変更の場合、他のMAPの状態も調整
        if map_update.is_active is not None:
            if map_update.is_active:
                # 新しいアクティブMAPに設定する場合、他を非アクティブ化
                db.query(ClassroomMap).filter(
                    ClassroomMap.id != map_id, ClassroomMap.is_active == True
                ).update({ClassroomMap.is_active: False})

            db_map.is_active = map_update.is_active

        db.commit()
        db.refresh(db_map)
        return db_map

    @staticmethod
    def delete_map(db: Session, map_id: int) -> bool:
        """MAPを削除（関連するチーム配置も削除される）"""
        db_map = db.query(ClassroomMap).filter(ClassroomMap.id == map_id).first()
        if not db_map:
            return False

        db.delete(db_map)
        db.commit()
        return True


class TeamPositionCRUD:
    """チーム配置情報 CRUD操作"""

    @staticmethod
    def get_positions_by_map_id(db: Session, map_id: int) -> List[TeamPosition]:
        """MAP IDでチーム配置情報を取得"""
        return db.query(TeamPosition).filter(TeamPosition.map_id == map_id).all()

    @staticmethod
    def get_position_by_team(
        db: Session, map_id: int, team_name: str
    ) -> Optional[TeamPosition]:
        """特定チームの配置情報を取得"""
        return (
            db.query(TeamPosition)
            .filter(
                and_(TeamPosition.map_id == map_id, TeamPosition.team_name == team_name)
            )
            .first()
        )

    @staticmethod
    def create_position(
        db: Session, map_id: int, position_data: TeamPositionCreate
    ) -> TeamPosition:
        """チーム配置情報を作成"""
        db_position = TeamPosition(map_id=map_id, **position_data.dict())

        db.add(db_position)
        db.commit()
        db.refresh(db_position)
        return db_position

    @staticmethod
    def update_position(
        db: Session, map_id: int, team_name: str, position_update: TeamPositionUpdate
    ) -> Optional[TeamPosition]:
        """チーム配置情報を更新"""
        db_position = (
            db.query(TeamPosition)
            .filter(
                and_(TeamPosition.map_id == map_id, TeamPosition.team_name == team_name)
            )
            .first()
        )

        if not db_position:
            return None

        # 更新データを適用
        update_data = position_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_position, field, value)

        db.commit()
        db.refresh(db_position)
        return db_position

    @staticmethod
    def upsert_position(
        db: Session,
        map_id: int,
        team_name: str,
        position_x: float,
        position_y: float,
        updated_by: Optional[str] = None,
    ) -> TeamPosition:
        """チーム配置情報をUpsert（存在しなければ作成、存在すれば更新）"""
        db_position = (
            db.query(TeamPosition)
            .filter(
                and_(TeamPosition.map_id == map_id, TeamPosition.team_name == team_name)
            )
            .first()
        )

        if db_position:
            # 更新
            db_position.position_x = position_x
            db_position.position_y = position_y
            if updated_by:
                db_position.updated_by = updated_by
        else:
            # 新規作成
            db_position = TeamPosition(
                map_id=map_id,
                team_name=team_name,
                position_x=position_x,
                position_y=position_y,
                updated_by=updated_by,
            )
            db.add(db_position)

        db.commit()
        db.refresh(db_position)
        return db_position

    @staticmethod
    def bulk_update_positions(
        db: Session, map_id: int, bulk_update: TeamPositionBulkUpdate
    ) -> List[TeamPosition]:
        """チーム配置情報を一括更新"""
        updated_positions = []

        for team_name, position in bulk_update.positions.items():
            db_position = TeamPositionCRUD.upsert_position(
                db=db,
                map_id=map_id,
                team_name=team_name,
                position_x=position["x"],
                position_y=position["y"],
                updated_by=bulk_update.updated_by,
            )
            updated_positions.append(db_position)

        return updated_positions

    @staticmethod
    def delete_position(db: Session, map_id: int, team_name: str) -> bool:
        """チーム配置情報を削除"""
        db_position = (
            db.query(TeamPosition)
            .filter(
                and_(TeamPosition.map_id == map_id, TeamPosition.team_name == team_name)
            )
            .first()
        )

        if not db_position:
            return False

        db.delete(db_position)
        db.commit()
        return True


# シングルトンインスタンス
classroom_map_crud = ClassroomMapCRUD()
team_position_crud = TeamPositionCRUD()
