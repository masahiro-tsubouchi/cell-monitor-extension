from sqlalchemy.orm import Session

from db import models
from schemas.event import EventData
import os


def get_notebook_by_path(db: Session, path: str) -> models.Notebook | None:
    """指定されたパスでノートブックを検索する"""
    return db.query(models.Notebook).filter(models.Notebook.path == path).first()


def create_notebook(db: Session, path: str) -> models.Notebook:
    """新しいノートブックを作成する"""
    notebook_name = os.path.basename(path)
    db_notebook = models.Notebook(path=path, name=notebook_name)
    db.add(db_notebook)
    db.commit()
    db.refresh(db_notebook)
    return db_notebook


def get_or_create_notebook(db: Session, path: str) -> models.Notebook:
    """指定されたパスでノートブックを取得、存在しない場合は作成する"""
    db_notebook = get_notebook_by_path(db, path=path)
    if not db_notebook:
        db_notebook = create_notebook(db, path=path)
    return db_notebook


def get_cell_by_cell_id(
    db: Session, notebook_id: int, cell_id: str
) -> models.Cell | None:
    """ノートブックIDとセルIDでセルを検索する"""
    return (
        db.query(models.Cell)
        .filter(models.Cell.notebook_id == notebook_id, models.Cell.cell_id == cell_id)
        .first()
    )


def create_cell(db: Session, notebook_id: int, event: EventData) -> models.Cell:
    """新しいセルを作成する"""
    db_cell = models.Cell(
        notebook_id=notebook_id,
        cell_id=event.cellId,
        cell_type=event.cellType,
        content=event.code,
        position=event.cellIndex,
    )
    db.add(db_cell)
    db.commit()
    db.refresh(db_cell)
    return db_cell


def get_or_create_cell(db: Session, notebook_id: int, event: EventData) -> models.Cell:
    """指定された情報でセルを取得、存在しない場合は作成する"""
    if not event.cellId:
        raise ValueError("cellId is required")
    db_cell = get_cell_by_cell_id(db, notebook_id=notebook_id, cell_id=event.cellId)
    if not db_cell:
        db_cell = create_cell(db, notebook_id=notebook_id, event=event)
    # セルの内容が更新されている可能性を考慮
    elif event.code and db_cell.content != event.code:
        if isinstance(db_cell.content, str):
            db_cell.content = event.code
        else:
            db_cell.content = event.code
        db.commit()
        db.refresh(db_cell)

    return db_cell
