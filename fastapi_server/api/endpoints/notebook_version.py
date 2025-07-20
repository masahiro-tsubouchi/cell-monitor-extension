"""
ノートブックバージョン管理API エンドポイント

Git風の差分管理システム、バージョン履歴、
変更追跡機能を提供するAPIエンドポイント群。
"""

from fastapi import APIRouter, HTTPException, Query, Body
from typing import Dict, Any, List, Optional
from datetime import datetime

from core.notebook_version_manager import notebook_version_manager
from schemas.notebook_version import (
    NotebookSnapshot,
    NotebookVersion,
    NotebookBranch,
    VersionHistory,
    VersionComparison,
    VersionTag,
    VersionAnalytics
)

router = APIRouter()


@router.post("/snapshot", status_code=201)
async def create_notebook_snapshot(
    notebook_path: str,
    notebook_content: Dict[str, Any] = Body(...),
    author_id: str = Body(...),
    author_name: str = Body(...)
):
    """
    ノートブックスナップショットを作成する
    
    指定されたノートブック内容からスナップショットを作成し、
    バージョン管理システムに登録する。
    
    - **notebook_path**: ノートブックパス
    - **notebook_content**: ノートブック内容（Jupyter形式）
    - **author_id**: 作成者ID
    - **author_name**: 作成者名
    """
    try:
        snapshot = await notebook_version_manager.create_snapshot(
            notebook_path=notebook_path,
            notebook_content=notebook_content,
            author_id=author_id,
            author_name=author_name
        )
        
        return {
            "message": "Notebook snapshot created successfully",
            "snapshot": snapshot.model_dump(),
            "created_at": snapshot.created_at.isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create notebook snapshot: {str(e)}"
        )


@router.post("/commit", status_code=201)
async def commit_notebook_version(
    notebook_path: str = Body(...),
    snapshot_id: str = Body(...),
    commit_message: str = Body(...),
    author_id: str = Body(...),
    author_name: str = Body(...),
    branch_name: str = Body("main")
):
    """
    ノートブックバージョンをコミットする
    
    スナップショットを基に新しいバージョンをコミットし、
    バージョン履歴に追加する。
    
    - **notebook_path**: ノートブックパス
    - **snapshot_id**: スナップショットID
    - **commit_message**: コミットメッセージ
    - **author_id**: 作成者ID
    - **author_name**: 作成者名
    - **branch_name**: ブランチ名（デフォルト: main）
    """
    try:
        # スナップショットを取得
        snapshot = notebook_version_manager.get_snapshot(snapshot_id)
        if not snapshot:
            raise HTTPException(
                status_code=404,
                detail=f"Snapshot {snapshot_id} not found"
            )
        
        # バージョンをコミット
        version = await notebook_version_manager.commit_version(
            notebook_path=notebook_path,
            snapshot=snapshot,
            commit_message=commit_message,
            author_id=author_id,
            author_name=author_name,
            branch_name=branch_name
        )
        
        return {
            "message": "Notebook version committed successfully",
            "version": version.model_dump(),
            "version_id": version.version_id,
            "version_number": version.version_number
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to commit notebook version: {str(e)}"
        )


@router.post("/commit-direct", status_code=201)
async def commit_notebook_direct(
    notebook_path: str = Body(...),
    notebook_content: Dict[str, Any] = Body(...),
    commit_message: str = Body(...),
    author_id: str = Body(...),
    author_name: str = Body(...),
    branch_name: str = Body("main")
):
    """
    ノートブックを直接コミットする（スナップショット作成＋コミット）
    
    ノートブック内容から直接スナップショットを作成し、
    バージョンとしてコミットする便利メソッド。
    
    - **notebook_path**: ノートブックパス
    - **notebook_content**: ノートブック内容（Jupyter形式）
    - **commit_message**: コミットメッセージ
    - **author_id**: 作成者ID
    - **author_name**: 作成者名
    - **branch_name**: ブランチ名（デフォルト: main）
    """
    try:
        # スナップショットを作成
        snapshot = await notebook_version_manager.create_snapshot(
            notebook_path=notebook_path,
            notebook_content=notebook_content,
            author_id=author_id,
            author_name=author_name
        )
        
        # バージョンをコミット
        version = await notebook_version_manager.commit_version(
            notebook_path=notebook_path,
            snapshot=snapshot,
            commit_message=commit_message,
            author_id=author_id,
            author_name=author_name,
            branch_name=branch_name
        )
        
        return {
            "message": "Notebook committed successfully",
            "version": version.model_dump(),
            "snapshot": snapshot.model_dump(),
            "version_id": version.version_id,
            "version_number": version.version_number
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to commit notebook directly: {str(e)}"
        )


@router.get("/history/{notebook_path:path}", status_code=200)
async def get_notebook_history(notebook_path: str):
    """
    ノートブックのバージョン履歴を取得する
    
    指定されたノートブックの全バージョン履歴、
    ブランチ情報、統計データを返す。
    
    - **notebook_path**: ノートブックパス
    """
    try:
        history = notebook_version_manager.get_version_history(notebook_path)
        
        if not history:
            raise HTTPException(
                status_code=404,
                detail=f"Version history not found for notebook: {notebook_path}"
            )
        
        return {
            "message": "Notebook history retrieved successfully",
            "history": history.model_dump(),
            "notebook_path": notebook_path,
            "retrieved_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get notebook history: {str(e)}"
        )


@router.get("/version/{version_id}", status_code=200)
async def get_notebook_version(version_id: str):
    """
    特定バージョンの詳細情報を取得する
    
    バージョンID を指定して、そのバージョンの
    詳細情報（スナップショット、差分情報等）を取得する。
    
    - **version_id**: バージョンID
    """
    try:
        version = notebook_version_manager.get_version(version_id)
        
        if not version:
            raise HTTPException(
                status_code=404,
                detail=f"Version {version_id} not found"
            )
        
        return {
            "message": "Notebook version retrieved successfully",
            "version": version.model_dump(),
            "version_id": version_id,
            "retrieved_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get notebook version: {str(e)}"
        )


@router.get("/latest/{notebook_path:path}", status_code=200)
async def get_latest_version(
    notebook_path: str,
    branch_name: str = Query("main", description="ブランチ名")
):
    """
    最新バージョンを取得する
    
    指定されたノートブックとブランチの
    最新バージョンを取得する。
    
    - **notebook_path**: ノートブックパス
    - **branch_name**: ブランチ名
    """
    try:
        version = notebook_version_manager.get_latest_version(notebook_path, branch_name)
        
        if not version:
            raise HTTPException(
                status_code=404,
                detail=f"No versions found for notebook: {notebook_path} on branch: {branch_name}"
            )
        
        return {
            "message": "Latest version retrieved successfully",
            "version": version.model_dump(),
            "notebook_path": notebook_path,
            "branch_name": branch_name,
            "retrieved_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get latest version: {str(e)}"
        )


@router.post("/branch", status_code=201)
async def create_notebook_branch(
    notebook_path: str = Body(...),
    branch_name: str = Body(...),
    from_version_id: str = Body(...),
    author_id: str = Body(...),
    description: Optional[str] = Body(None)
):
    """
    新しいブランチを作成する
    
    指定されたバージョンから新しいブランチを作成し、
    独立した開発ラインを開始する。
    
    - **notebook_path**: ノートブックパス
    - **branch_name**: ブランチ名
    - **from_version_id**: 分岐元バージョンID
    - **author_id**: 作成者ID
    - **description**: ブランチ説明
    """
    try:
        branch = await notebook_version_manager.create_branch(
            notebook_path=notebook_path,
            branch_name=branch_name,
            from_version_id=from_version_id,
            author_id=author_id,
            description=description
        )
        
        return {
            "message": "Branch created successfully",
            "branch": branch.model_dump(),
            "branch_id": branch.branch_id,
            "branch_name": branch_name
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create branch: {str(e)}"
        )


@router.get("/compare/{from_version_id}/{to_version_id}", status_code=200)
async def compare_notebook_versions(from_version_id: str, to_version_id: str):
    """
    2つのバージョンを比較する
    
    指定された2つのバージョン間の差分を分析し、
    詳細な比較結果を返す。
    
    - **from_version_id**: 比較元バージョンID
    - **to_version_id**: 比較先バージョンID
    """
    try:
        comparison = await notebook_version_manager.compare_versions(
            from_version_id=from_version_id,
            to_version_id=to_version_id
        )
        
        return {
            "message": "Version comparison completed successfully",
            "comparison": comparison.model_dump(),
            "from_version_id": from_version_id,
            "to_version_id": to_version_id,
            "compared_at": comparison.compared_at.isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to compare versions: {str(e)}"
        )


@router.get("/snapshot/{snapshot_id}", status_code=200)
async def get_notebook_snapshot(snapshot_id: str):
    """
    スナップショットの詳細情報を取得する
    
    スナップショットIDを指定して、その時点での
    ノートブック全体の状態を取得する。
    
    - **snapshot_id**: スナップショットID
    """
    try:
        snapshot = notebook_version_manager.get_snapshot(snapshot_id)
        
        if not snapshot:
            raise HTTPException(
                status_code=404,
                detail=f"Snapshot {snapshot_id} not found"
            )
        
        return {
            "message": "Notebook snapshot retrieved successfully",
            "snapshot": snapshot.model_dump(),
            "snapshot_id": snapshot_id,
            "retrieved_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get notebook snapshot: {str(e)}"
        )


@router.get("/branch/{branch_id}", status_code=200)
async def get_notebook_branch(branch_id: str):
    """
    ブランチの詳細情報を取得する
    
    ブランチIDを指定して、そのブランチの
    詳細情報と現在の状態を取得する。
    
    - **branch_id**: ブランチID
    """
    try:
        branch = notebook_version_manager.get_branch(branch_id)
        
        if not branch:
            raise HTTPException(
                status_code=404,
                detail=f"Branch {branch_id} not found"
            )
        
        return {
            "message": "Branch information retrieved successfully",
            "branch": branch.model_dump(),
            "branch_id": branch_id,
            "retrieved_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get branch information: {str(e)}"
        )


@router.get("/stats", status_code=200)
async def get_version_system_stats():
    """
    バージョン管理システムの統計情報を取得する
    
    システム全体の統計情報（総ノートブック数、
    バージョン数、ブランチ数等）を返す。
    """
    try:
        stats = notebook_version_manager.get_stats()
        
        # 追加統計を計算
        enhanced_stats = {
            **stats,
            "system_health": "healthy" if stats.get('total_versions', 0) > 0 else "idle",
            "average_versions_per_notebook": (
                stats.get('total_versions', 0) / max(stats.get('total_notebooks', 1), 1)
            ),
            "average_branches_per_notebook": (
                stats.get('total_branches', 0) / max(stats.get('total_notebooks', 1), 1)
            )
        }
        
        return {
            "message": "Version system stats retrieved successfully",
            "stats": enhanced_stats,
            "retrieved_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get version system stats: {str(e)}"
        )


@router.post("/simulate-commit", status_code=201)
async def simulate_notebook_commit(
    notebook_path: str = "test_notebook.ipynb",
    author_id: str = "test_user_001",
    author_name: str = "Test User",
    branch_name: str = "main"
):
    """
    ノートブックコミットをシミュレートする（テスト用）
    
    開発・テスト目的でサンプルノートブックの
    コミットをシミュレートする。
    
    - **notebook_path**: ノートブックパス
    - **author_id**: 作成者ID
    - **author_name**: 作成者名
    - **branch_name**: ブランチ名
    """
    try:
        # テスト用のノートブック内容を生成
        test_notebook_content = {
            "cells": [
                {
                    "id": "cell_001",
                    "cell_type": "markdown",
                    "source": [
                        "# Test Notebook\n",
                        "\n",
                        "This is a test notebook for version management simulation."
                    ],
                    "metadata": {}
                },
                {
                    "id": "cell_002",
                    "cell_type": "code",
                    "source": [
                        "import numpy as np\n",
                        "import pandas as pd\n",
                        "\n",
                        "print('Hello, Version Control!')"
                    ],
                    "metadata": {},
                    "execution_count": 1,
                    "outputs": [
                        {
                            "output_type": "stream",
                            "name": "stdout",
                            "text": ["Hello, Version Control!\n"]
                        }
                    ]
                },
                {
                    "id": "cell_003",
                    "cell_type": "code",
                    "source": [
                        "# Generate some test data\n",
                        "data = np.random.randn(100, 3)\n",
                        "df = pd.DataFrame(data, columns=['A', 'B', 'C'])\n",
                        "print(f'Data shape: {df.shape}')"
                    ],
                    "metadata": {},
                    "execution_count": 2,
                    "outputs": [
                        {
                            "output_type": "stream",
                            "name": "stdout",
                            "text": ["Data shape: (100, 3)\n"]
                        }
                    ]
                }
            ],
            "metadata": {
                "kernelspec": {
                    "display_name": "Python 3",
                    "language": "python",
                    "name": "python3"
                },
                "language_info": {
                    "name": "python",
                    "version": "3.9.7"
                }
            },
            "nbformat": 4,
            "nbformat_minor": 4
        }
        
        # 直接コミット
        result = await commit_notebook_direct(
            notebook_path=notebook_path,
            notebook_content=test_notebook_content,
            commit_message=f"Simulated commit at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            author_id=author_id,
            author_name=author_name,
            branch_name=branch_name
        )
        
        return {
            "message": "Notebook commit simulated successfully",
            "simulation_result": result,
            "simulated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to simulate notebook commit: {str(e)}"
        )


@router.delete("/reset/{notebook_path:path}", status_code=200)
async def reset_notebook_history(notebook_path: str):
    """
    ノートブックのバージョン履歴をリセットする（テスト用）
    
    開発・テスト目的で指定されたノートブックの
    全バージョン履歴をクリアする。
    
    ⚠️ 注意: この操作は取り消せません。
    
    - **notebook_path**: ノートブックパス
    """
    try:
        # バージョン履歴を削除
        if notebook_path in notebook_version_manager.version_histories:
            history = notebook_version_manager.version_histories[notebook_path]
            
            # 関連するバージョンとスナップショットを削除
            versions_to_delete = []
            snapshots_to_delete = []
            branches_to_delete = []
            
            for version in history.versions:
                versions_to_delete.append(version.version_id)
                snapshots_to_delete.append(version.snapshot.snapshot_id)
            
            for branch in history.branches:
                branches_to_delete.append(branch.branch_id)
            
            # 削除実行
            for version_id in versions_to_delete:
                notebook_version_manager.versions.pop(version_id, None)
            
            for snapshot_id in snapshots_to_delete:
                notebook_version_manager.snapshots.pop(snapshot_id, None)
            
            for branch_id in branches_to_delete:
                notebook_version_manager.branches.pop(branch_id, None)
            
            # 履歴を削除
            del notebook_version_manager.version_histories[notebook_path]
            
            # 統計を更新
            notebook_version_manager.stats['total_notebooks'] -= 1
            notebook_version_manager.stats['total_versions'] -= len(versions_to_delete)
            notebook_version_manager.stats['total_branches'] -= len(branches_to_delete)
        
        return {
            "message": "Notebook history reset successfully",
            "notebook_path": notebook_path,
            "reset_at": datetime.now().isoformat(),
            "warning": "This operation cannot be undone"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reset notebook history: {str(e)}"
        )
