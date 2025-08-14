"""
教室MAP管理API エンドポイント
"""

import os
import uuid
import shutil
from typing import Optional
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from PIL import Image

from db.session import get_db
from crud.crud_classroom import classroom_map_crud, team_position_crud
from schemas.classroom import (
    ClassroomMap,
    ClassroomMapWithPositions,
    ClassroomMapCreate,
    TeamPositionBulkUpdate,
    MapUploadResponse,
    ErrorResponse,
)
from core.config import settings

router = APIRouter()

# MAP画像保存ディレクトリ
UPLOAD_DIR = Path("static/maps")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 許可する画像形式とサイズ
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_IMAGE_DIMENSION = 2048  # 最大幅・高さ


def optimize_image(image_path: Path, max_size: int = MAX_IMAGE_DIMENSION) -> None:
    """画像を最適化（リサイズ・圧縮）"""
    try:
        with Image.open(image_path) as img:
            # RGBA to RGB変換（必要に応じて）
            if img.mode in ("RGBA", "LA"):
                background = Image.new("RGB", img.size, (255, 255, 255))
                background.paste(
                    img, mask=img.split()[-1] if img.mode == "RGBA" else None
                )
                img = background

            # リサイズ処理（アスペクト比維持）
            if img.width > max_size or img.height > max_size:
                img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

            # 高品質で保存（JPEG）
            img.save(image_path, "JPEG", quality=85, optimize=True)

    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"画像の最適化に失敗しました: {str(e)}"
        )


@router.get("/map", response_model=ClassroomMapWithPositions)
async def get_classroom_map(db: Session = Depends(get_db)):
    """
    アクティブな教室MAPと配置情報を取得
    """
    classroom_map = classroom_map_crud.get_active_map(db)

    if not classroom_map:
        return ClassroomMapWithPositions(
            map_info=None, team_positions={}, is_visible=False
        )

    # チーム配置情報を辞書形式に変換
    team_positions_dict = {}
    for position in classroom_map.team_positions:
        team_positions_dict[position.team_name] = position.position_dict

    return ClassroomMapWithPositions(
        map_info=classroom_map, team_positions=team_positions_dict, is_visible=True
    )


@router.post("/map/upload", response_model=MapUploadResponse)
async def upload_classroom_map(
    file: UploadFile = File(...),
    uploaded_by: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    教室MAP画像をアップロード
    """
    try:
        # ファイル検証
        if not file.filename:
            raise HTTPException(status_code=400, detail="ファイル名が必要です")

        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"サポートされていない形式です。対応形式: {', '.join(ALLOWED_EXTENSIONS)}",
            )

        # ファイルサイズチェック
        file_size = 0
        content = await file.read()
        file_size = len(content)

        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"ファイルサイズが大きすぎます。最大サイズ: {MAX_FILE_SIZE // (1024*1024)}MB",
            )

        # 一意のファイル名生成
        file_id = str(uuid.uuid4())
        filename = f"classroom_map_{file_id}.jpg"  # 常にJPEG形式で保存
        file_path = UPLOAD_DIR / filename

        # ファイル保存
        with open(file_path, "wb") as buffer:
            buffer.write(content)

        # 画像最適化
        optimize_image(file_path)

        # 最適化後のファイルサイズ取得
        optimized_size = file_path.stat().st_size

        # データベースに保存
        map_data = ClassroomMapCreate(
            image_filename=filename,
            image_url=f"/static/maps/{filename}",
            original_filename=file.filename,
            uploaded_by=uploaded_by,
            file_size_bytes=optimized_size,
            content_type="image/jpeg",
        )

        classroom_map = classroom_map_crud.create_map(db, map_data)

        return MapUploadResponse(
            success=True,
            message="MAPが正常にアップロードされました",
            map_id=classroom_map.id,
            image_url=classroom_map.image_url,
        )

    except HTTPException:
        # クリーンアップ
        if "file_path" in locals() and file_path.exists():
            file_path.unlink()
        raise
    except Exception as e:
        # クリーンアップ
        if "file_path" in locals() and file_path.exists():
            file_path.unlink()
        raise HTTPException(
            status_code=500, detail=f"アップロードに失敗しました: {str(e)}"
        )


@router.get("/map/image/{filename}")
async def get_map_image(filename: str):
    """
    MAP画像ファイルを配信
    """
    file_path = UPLOAD_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="画像が見つかりません")

    return FileResponse(path=file_path, media_type="image/jpeg", filename=filename)


@router.put("/map/{map_id}/positions", response_model=dict)
async def update_team_positions(
    map_id: int, positions_update: TeamPositionBulkUpdate, db: Session = Depends(get_db)
):
    """
    チーム配置情報を一括更新
    """
    # MAP存在チェック
    classroom_map = classroom_map_crud.get_map_by_id(db, map_id)
    if not classroom_map:
        raise HTTPException(status_code=404, detail="指定されたMAPが見つかりません")

    try:
        updated_positions = team_position_crud.bulk_update_positions(
            db, map_id, positions_update
        )

        return {
            "success": True,
            "message": f"{len(updated_positions)}チームの配置を更新しました",
            "updated_teams": [pos.team_name for pos in updated_positions],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"配置更新に失敗しました: {str(e)}")


@router.delete("/map/{map_id}", response_model=dict)
async def delete_classroom_map(map_id: int, db: Session = Depends(get_db)):
    """
    教室MAPを削除（画像ファイルも削除）
    """
    # MAP情報取得
    classroom_map = classroom_map_crud.get_map_by_id(db, map_id)
    if not classroom_map:
        raise HTTPException(status_code=404, detail="指定されたMAPが見つかりません")

    try:
        # 画像ファイル削除
        file_path = UPLOAD_DIR / classroom_map.image_filename
        if file_path.exists():
            file_path.unlink()

        # データベースから削除
        success = classroom_map_crud.delete_map(db, map_id)

        if success:
            return {"success": True, "message": "MAPが正常に削除されました"}
        else:
            raise HTTPException(status_code=500, detail="MAP削除に失敗しました")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MAP削除に失敗しました: {str(e)}")


@router.get("/maps", response_model=list[ClassroomMap])
async def get_all_maps(limit: int = 10, db: Session = Depends(get_db)):
    """
    全MAP一覧を取得（管理用）
    """
    return classroom_map_crud.get_all_maps(db, limit=limit)
