"""
Notebook Version API 包括的テストスイート

AI駆動TDDによるNotebook Version APIの完全テストカバレッジ。
Environment APIの成功パターン（19個全成功）を適用。
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta
from typing import Dict, Any, List

from main import app
from schemas.notebook_version import (
    NotebookSnapshot,
    NotebookVersion,
    NotebookBranch,
    VersionHistory,
    VersionComparison,
    VersionTag,
    VersionAnalytics,
    CellContent,
    CellDiff,
    ChangeType,
    CellType,
    VersionStatus,
)

client = TestClient(app)


class TestNotebookSnapshotAPI:
    """ノートブックスナップショットAPI テスト"""

    @patch("api.endpoints.notebook_version.notebook_version_manager.create_snapshot")
    def test_create_notebook_snapshot_success(self, mock_create_snapshot):
        """スナップショット作成成功テスト"""
        # モックスナップショットデータ
        mock_snapshot = NotebookSnapshot(
            snapshot_id="snap_123",
            notebook_path="test_notebook.ipynb",
            created_at=datetime.now(),
            notebook_metadata={"kernelspec": {"name": "python3"}},
            kernel_spec={"name": "python3", "display_name": "Python 3"},
            cells=[
                CellContent(
                    cell_id="cell_1",
                    cell_type=CellType.CODE,
                    source=["print('hello world')"],
                    metadata={},
                    execution_count=1,
                    outputs=[],
                )
            ],
            total_cells=1,
            total_lines=1,
            total_characters=20,
            code_cells_count=1,
            markdown_cells_count=0,
            execution_count=1,
        )

        mock_create_snapshot.return_value = mock_snapshot

        # テストリクエスト（正しいリクエスト形式：notebook_pathはクエリパラメータ）
        response = client.post(
            "/api/v1/v1/notebook-version/snapshot?notebook_path=test_notebook.ipynb",
            json={
                "notebook_content": {
                    "cells": [
                        {"cell_type": "code", "source": ["print('hello world')"]}
                    ],
                    "metadata": {"kernelspec": {"name": "python3"}},
                },
                "author_id": "user_123",
                "author_name": "Test User",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["message"] == "Notebook snapshot created successfully"
        assert data["snapshot"]["snapshot_id"] == "snap_123"
        assert data["snapshot"]["notebook_path"] == "test_notebook.ipynb"
        assert data["snapshot"]["total_cells"] == 1

        mock_create_snapshot.assert_called_once()

    @patch("api.endpoints.notebook_version.notebook_version_manager.create_snapshot")
    def test_create_notebook_snapshot_error(self, mock_create_snapshot):
        """スナップショット作成エラーテスト"""
        mock_create_snapshot.side_effect = Exception("Failed to create snapshot")

        response = client.post(
            "/api/v1/v1/notebook-version/snapshot?notebook_path=test_notebook.ipynb",
            json={
                "notebook_content": {"cells": []},
                "author_id": "user_123",
                "author_name": "Test User",
            },
        )

        assert response.status_code == 500
        data = response.json()
        assert "Failed to create notebook snapshot" in data["detail"]


class TestNotebookVersionAPI:
    """ノートブックバージョンAPI テスト"""

    @patch("api.endpoints.notebook_version.notebook_version_manager.get_snapshot")
    @patch("api.endpoints.notebook_version.notebook_version_manager.commit_version")
    def test_commit_notebook_version_success(
        self, mock_commit_version, mock_get_snapshot
    ):
        """バージョンコミット成功テスト"""
        # モックスナップショット（get_snapshot用）
        mock_snapshot = NotebookSnapshot(
            snapshot_id="snap_123",
            notebook_path="test_notebook.ipynb",
            created_at=datetime.now(),
            cells=[],
            notebook_metadata={},
            kernel_spec={},
        )

        mock_version = NotebookVersion(
            version_id="ver_123",
            notebook_path="test_notebook.ipynb",
            created_at=datetime.now(),
            version_number="v1.0.0",
            status=VersionStatus.COMMITTED,
            commit_message="Initial commit",
            author_id="user_123",
            author_name="Test User",
            snapshot=mock_snapshot,
            diffs=[],
            total_changes=0,
            cells_added=1,
            cells_deleted=0,
            cells_modified=0,
            cells_moved=0,
        )

        mock_get_snapshot.return_value = mock_snapshot
        mock_commit_version.return_value = mock_version

        response = client.post(
            "/api/v1/v1/notebook-version/commit",
            json={
                "notebook_path": "test_notebook.ipynb",
                "snapshot_id": "snap_123",
                "commit_message": "Initial commit",
                "author_id": "user_123",
                "author_name": "Test User",
                "branch_name": "main",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["message"] == "Notebook version committed successfully"
        assert data["version"]["version_id"] == "ver_123"
        assert data["version"]["commit_message"] == "Initial commit"
        assert data["version"]["status"] == "committed"

    @patch("api.endpoints.notebook_version.notebook_version_manager.commit_version")
    def test_commit_notebook_direct_success(self, mock_commit_direct):
        """直接コミット成功テスト"""
        mock_version = NotebookVersion(
            version_id="ver_124",
            notebook_path="test_notebook.ipynb",
            created_at=datetime.now(),
            version_number="v1.0.1",
            status=VersionStatus.COMMITTED,
            commit_message="Direct commit",
            author_id="user_123",
            author_name="Test User",
            snapshot=NotebookSnapshot(
                snapshot_id="snap_124",
                notebook_path="test_notebook.ipynb",
                created_at=datetime.now(),
                cells=[],
                notebook_metadata={},
                kernel_spec={},
            ),
            diffs=[],
        )

        mock_commit_direct.return_value = mock_version

        response = client.post(
            "/api/v1/v1/notebook-version/commit-direct",
            json={
                "notebook_path": "test_notebook.ipynb",
                "notebook_content": {"cells": []},
                "commit_message": "Direct commit",
                "author_id": "user_123",
                "author_name": "Test User",
                "branch_name": "main",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["message"] == "Notebook committed successfully"
        assert data["version"]["version_id"] == "ver_124"

    @patch("api.endpoints.notebook_version.notebook_version_manager.get_snapshot")
    @patch("api.endpoints.notebook_version.notebook_version_manager.commit_version")
    def test_commit_notebook_version_error(
        self, mock_commit_version, mock_get_snapshot
    ):
        """バージョンコミットエラーテスト"""
        # モックスナップショット（get_snapshot用）
        mock_snapshot = NotebookSnapshot(
            snapshot_id="snap_123",
            notebook_path="test_notebook.ipynb",
            created_at=datetime.now(),
            cells=[],
            notebook_metadata={},
            kernel_spec={},
        )

        mock_get_snapshot.return_value = mock_snapshot
        mock_commit_version.side_effect = Exception("Failed to commit version")

        response = client.post(
            "/api/v1/v1/notebook-version/commit",
            json={
                "notebook_path": "test_notebook.ipynb",
                "snapshot_id": "snap_123",
                "commit_message": "Test commit",
                "author_id": "user_123",
                "author_name": "Test User",
            },
        )

        assert response.status_code == 500
        data = response.json()
        assert "Failed to commit notebook version" in data["detail"]


class TestNotebookHistoryAPI:
    """ノートブック履歴API テスト"""

    @patch(
        "api.endpoints.notebook_version.notebook_version_manager.get_version_history"
    )
    def test_get_notebook_history_success(self, mock_get_history):
        """履歴取得成功テスト"""
        mock_history = VersionHistory(
            notebook_path="test_notebook.ipynb",
            created_at=datetime.now(),
            last_updated_at=datetime.now(),
            versions=[],
            branches=[],
            current_branch_id="branch_main",
            current_version_id="ver_123",
            total_versions=1,
            total_branches=1,
            total_commits=1,
            contributors=[],
        )

        mock_get_history.return_value = mock_history

        response = client.get("/api/v1/v1/notebook-version/history/test_notebook.ipynb")

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Notebook history retrieved successfully"
        assert data["history"]["notebook_path"] == "test_notebook.ipynb"
        assert data["history"]["total_versions"] == 1

    @patch("api.endpoints.notebook_version.notebook_version_manager.get_version")
    def test_get_notebook_version_success(self, mock_get_version):
        """特定バージョン取得成功テスト"""
        mock_version = NotebookVersion(
            version_id="ver_123",
            notebook_path="test_notebook.ipynb",
            created_at=datetime.now(),
            version_number="v1.0.0",
            status=VersionStatus.COMMITTED,
            commit_message="Test commit",
            author_id="user_123",
            author_name="Test User",
            snapshot=NotebookSnapshot(
                snapshot_id="snap_123",
                notebook_path="test_notebook.ipynb",
                created_at=datetime.now(),
                cells=[],
                notebook_metadata={},
                kernel_spec={},
            ),
            diffs=[],
        )

        mock_get_version.return_value = mock_version

        response = client.get("/api/v1/v1/notebook-version/version/ver_123")

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Notebook version retrieved successfully"
        assert data["version"]["version_id"] == "ver_123"

    @patch("api.endpoints.notebook_version.notebook_version_manager.get_latest_version")
    def test_get_latest_version_success(self, mock_get_latest):
        """最新バージョン取得成功テスト"""
        mock_version = NotebookVersion(
            version_id="ver_latest",
            notebook_path="test_notebook.ipynb",
            created_at=datetime.now(),
            version_number="v1.0.2",
            status=VersionStatus.COMMITTED,
            commit_message="Latest commit",
            author_id="user_123",
            author_name="Test User",
            snapshot=NotebookSnapshot(
                snapshot_id="snap_latest",
                notebook_path="test_notebook.ipynb",
                created_at=datetime.now(),
                cells=[],
                notebook_metadata={},
                kernel_spec={},
            ),
            diffs=[],
        )

        mock_get_latest.return_value = mock_version

        response = client.get(
            "/api/v1/v1/notebook-version/latest?notebook_path=test_notebook.ipynb&branch_name=main"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Latest version retrieved successfully"
        assert data["version"]["version_id"] == "ver_latest"

    @patch(
        "api.endpoints.notebook_version.notebook_version_manager.get_version_history"
    )
    def test_get_notebook_history_error(self, mock_get_history):
        """履歴取得エラーテスト"""
        mock_get_history.side_effect = Exception("Failed to get history")

        response = client.get("/api/v1/v1/notebook-version/history/test_notebook.ipynb")

        assert response.status_code == 500
        data = response.json()
        assert "Failed to get notebook history" in data["detail"]


class TestNotebookBranchAPI:
    """ノートブックブランチAPI テスト"""

    @patch("api.endpoints.notebook_version.notebook_version_manager.create_branch")
    def test_create_notebook_branch_success(self, mock_create_branch):
        """ブランチ作成成功テスト"""
        mock_branch = NotebookBranch(
            branch_id="branch_feature",
            branch_name="feature-branch",
            notebook_path="test_notebook.ipynb",
            created_at=datetime.now(),
            created_by="user_123",
            description="Feature development branch",
            current_version_id="ver_123",
            current_version_number="v1.0.0",
            parent_branch_id="branch_main",
            parent_branch_name="main",
            branched_from_version_id="ver_123",
            total_versions=1,
            last_commit_at=datetime.now(),
            is_merged=False,
        )

        mock_create_branch.return_value = mock_branch

        response = client.post(
            "/api/v1/v1/notebook-version/branch",
            json={
                "notebook_path": "test_notebook.ipynb",
                "branch_name": "feature-branch",
                "from_version_id": "ver_123",
                "author_id": "user_123",
                "description": "Feature development branch",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["message"] == "Branch created successfully"
        assert data["branch"]["branch_name"] == "feature-branch"
        assert data["branch"]["description"] == "Feature development branch"

    @patch("api.endpoints.notebook_version.notebook_version_manager.get_branch")
    def test_get_notebook_branch_success(self, mock_get_branch):
        """ブランチ取得成功テスト"""
        mock_branch = NotebookBranch(
            branch_id="branch_main",
            branch_name="main",
            notebook_path="test_notebook.ipynb",
            created_at=datetime.now(),
            created_by="user_123",
            current_version_id="ver_123",
            current_version_number="v1.0.0",
            total_versions=3,
            last_commit_at=datetime.now(),
            is_merged=False,
        )

        mock_get_branch.return_value = mock_branch

        response = client.get("/api/v1/v1/notebook-version/branch/branch_main")

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Branch information retrieved successfully"
        assert data["branch"]["branch_name"] == "main"
        assert data["branch"]["total_versions"] == 3

    @patch("api.endpoints.notebook_version.notebook_version_manager.create_branch")
    def test_create_notebook_branch_error(self, mock_create_branch):
        """ブランチ作成エラーテスト"""
        mock_create_branch.side_effect = Exception("Failed to create branch")

        response = client.post(
            "/api/v1/v1/notebook-version/branch",
            json={
                "notebook_path": "test_notebook.ipynb",
                "branch_name": "feature-branch",
                "from_version_id": "ver_123",
                "author_id": "user_123",
            },
        )

        assert response.status_code == 500
        data = response.json()
        assert "Failed to create branch" in data["detail"]


class TestNotebookComparisonAPI:
    """ノートブック比較API テスト"""

    @patch("api.endpoints.notebook_version.notebook_version_manager.compare_versions")
    def test_compare_notebook_versions_success(self, mock_compare_versions):
        """バージョン比較成功テスト"""
        mock_comparison = VersionComparison(
            comparison_id="comp_123",
            compared_at=datetime.now(),
            from_version_id="ver_123",
            to_version_id="ver_124",
            from_version_number="v1.0.0",
            to_version_number="v1.0.1",
            cell_diffs=[],
            summary={"added": 1, "modified": 0, "deleted": 0},
            similarity_score=0.95,
            change_significance="minor",
            recommended_actions=["Review added cell"],
        )

        mock_compare_versions.return_value = mock_comparison

        response = client.get("/api/v1/v1/notebook-version/compare/ver_123/ver_124")

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Version comparison completed successfully"
        assert data["comparison"]["from_version_id"] == "ver_123"
        assert data["comparison"]["to_version_id"] == "ver_124"
        assert data["comparison"]["similarity_score"] == 0.95

    @patch("api.endpoints.notebook_version.notebook_version_manager.compare_versions")
    def test_compare_notebook_versions_error(self, mock_compare_versions):
        """バージョン比較エラーテスト"""
        mock_compare_versions.side_effect = Exception("Failed to compare versions")

        response = client.get("/api/v1/v1/notebook-version/compare/ver_123/ver_124")

        assert response.status_code == 500
        data = response.json()
        assert "Failed to compare versions" in data["detail"]


class TestNotebookSnapshotDetailAPI:
    """ノートブックスナップショット詳細API テスト"""

    @patch("api.endpoints.notebook_version.notebook_version_manager.get_snapshot")
    def test_get_notebook_snapshot_success(self, mock_get_snapshot):
        """スナップショット取得成功テスト"""
        mock_snapshot = NotebookSnapshot(
            snapshot_id="snap_123",
            notebook_path="test_notebook.ipynb",
            created_at=datetime.now(),
            notebook_metadata={"kernelspec": {"name": "python3"}},
            kernel_spec={"name": "python3"},
            cells=[
                CellContent(
                    cell_id="cell_1",
                    cell_type=CellType.CODE,
                    source=["print('hello')"],
                    metadata={},
                    execution_count=1,
                    outputs=[],
                )
            ],
            total_cells=1,
            total_lines=1,
            code_cells_count=1,
            markdown_cells_count=0,
        )

        mock_get_snapshot.return_value = mock_snapshot

        response = client.get("/api/v1/v1/notebook-version/snapshot/snap_123")

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Notebook snapshot retrieved successfully"
        assert data["snapshot"]["snapshot_id"] == "snap_123"
        assert data["snapshot"]["total_cells"] == 1

    @patch("api.endpoints.notebook_version.notebook_version_manager.get_snapshot")
    def test_get_notebook_snapshot_error(self, mock_get_snapshot):
        """スナップショット取得エラーテスト"""
        mock_get_snapshot.side_effect = Exception("Snapshot not found")

        response = client.get("/api/v1/v1/notebook-version/snapshot/snap_nonexistent")

        assert response.status_code == 500
        data = response.json()
        assert "Failed to get notebook snapshot" in data["detail"]


class TestVersionSystemAPI:
    """バージョンシステムAPI テスト"""

    @patch("api.endpoints.notebook_version.notebook_version_manager.get_stats")
    def test_get_version_system_stats_success(self, mock_get_stats):
        """システム統計取得成功テスト"""
        # get_stats()は辞書を返すことを期待
        mock_stats = {
            "total_notebooks": 5,
            "total_versions": 15,
            "total_branches": 8,
            "total_snapshots": 20,
            "active_branches": 3,
        }

        mock_get_stats.return_value = mock_stats

        response = client.get("/api/v1/v1/notebook-version/stats")

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Version system stats retrieved successfully"
        assert data["stats"]["total_notebooks"] == 5
        assert data["stats"]["total_versions"] == 15
        assert "system_health" in data["stats"]
        assert "average_versions_per_notebook" in data["stats"]

    @patch("api.endpoints.notebook_version.notebook_version_manager.get_stats")
    def test_get_version_system_stats_error(self, mock_get_stats):
        """システム統計取得エラーテスト"""
        mock_get_stats.side_effect = Exception("Failed to get system stats")

        response = client.get("/api/v1/v1/notebook-version/stats")

        assert response.status_code == 500
        data = response.json()
        assert "Failed to get version system stats" in data["detail"]


class TestNotebookVersionIntegration:
    """ノートブックバージョン統合テスト"""

    @patch("api.endpoints.notebook_version.notebook_version_manager.get_snapshot")
    @patch("api.endpoints.notebook_version.notebook_version_manager.create_snapshot")
    @patch("api.endpoints.notebook_version.notebook_version_manager.commit_version")
    @patch(
        "api.endpoints.notebook_version.notebook_version_manager.get_version_history"
    )
    def test_full_version_workflow(
        self,
        mock_get_history,
        mock_commit_version,
        mock_create_snapshot,
        mock_get_snapshot,
    ):
        """完全バージョン管理ワークフローテスト"""
        # スナップショット作成
        mock_snapshot = NotebookSnapshot(
            snapshot_id="snap_workflow",
            notebook_path="workflow_notebook.ipynb",
            created_at=datetime.now(),
            cells=[],
            notebook_metadata={},
            kernel_spec={},
        )
        mock_create_snapshot.return_value = mock_snapshot

        # バージョンコミット
        mock_version = NotebookVersion(
            version_id="ver_workflow",
            notebook_path="workflow_notebook.ipynb",
            created_at=datetime.now(),
            version_number="v1.0.0",
            status=VersionStatus.COMMITTED,
            commit_message="Workflow test",
            author_id="user_workflow",
            author_name="Workflow User",
            snapshot=mock_snapshot,
            diffs=[],
        )
        mock_commit_version.return_value = mock_version

        # 履歴取得
        mock_history = VersionHistory(
            notebook_path="workflow_notebook.ipynb",
            created_at=datetime.now(),
            last_updated_at=datetime.now(),
            versions=[mock_version],
            branches=[],
            current_branch_id="branch_main",
            current_version_id="ver_workflow",
            total_versions=1,
            total_branches=1,
            total_commits=1,
            contributors=[],
        )
        mock_get_history.return_value = mock_history

        # get_snapshot用のモック（コミット時に必要）
        mock_get_snapshot.return_value = mock_snapshot

        # 1. スナップショット作成
        snapshot_response = client.post(
            "/api/v1/v1/notebook-version/snapshot?notebook_path=workflow_notebook.ipynb",
            json={
                "notebook_content": {"cells": []},
                "author_id": "user_workflow",
                "author_name": "Workflow User",
            },
        )
        assert snapshot_response.status_code == 201

        # 2. バージョンコミット
        commit_response = client.post(
            "/api/v1/v1/notebook-version/commit",
            json={
                "notebook_path": "workflow_notebook.ipynb",
                "snapshot_id": "snap_workflow",
                "commit_message": "Workflow test",
                "author_id": "user_workflow",
                "author_name": "Workflow User",
            },
        )
        assert commit_response.status_code == 201

        # 3. 履歴確認
        history_response = client.get(
            "/api/v1/v1/notebook-version/history/workflow_notebook.ipynb"
        )
        assert history_response.status_code == 200

        history_data = history_response.json()
        assert history_data["history"]["total_versions"] == 1
        assert history_data["history"]["total_commits"] == 1

    def test_test_utility_workflow(self):
        """テストユーティリティワークフローテスト"""
        # 統計情報の取得テスト（実際に存在するエンドポイント）
        stats_response = client.get("/api/v1/v1/notebook-version/stats")
        assert stats_response.status_code == 200

        stats_data = stats_response.json()
        assert "message" in stats_data
        assert "stats" in stats_data
