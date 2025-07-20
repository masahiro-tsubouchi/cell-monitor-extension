"""
ノートブックバージョン管理API 統合テスト

Git風の差分管理システム、バージョン履歴、
変更追跡機能のAPIエンドポイントの統合テスト。
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime
import json

from main import app

client = TestClient(app)


class TestNotebookVersionAPI:
    """ノートブックバージョン管理API統合テスト"""
    
    def setup_method(self):
        """各テストメソッド実行前のセットアップ"""
        self.test_notebook_path = "test_notebooks/integration_test.ipynb"
        self.test_author_id = "test_user_001"
        self.test_author_name = "Integration Test User"
        self.test_branch_name = "main"
        
        # テスト用ノートブック内容
        self.test_notebook_content = {
            "cells": [
                {
                    "id": "cell_001",
                    "cell_type": "markdown",
                    "source": [
                        "# Integration Test Notebook\n",
                        "\n",
                        "This notebook is used for integration testing."
                    ],
                    "metadata": {}
                },
                {
                    "id": "cell_002",
                    "cell_type": "code",
                    "source": [
                        "import pandas as pd\n",
                        "print('Hello, Integration Test!')"
                    ],
                    "metadata": {},
                    "execution_count": 1,
                    "outputs": [
                        {
                            "output_type": "stream",
                            "name": "stdout",
                            "text": ["Hello, Integration Test!\n"]
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
        
        # 変更後のノートブック内容
        self.modified_notebook_content = {
            "cells": [
                {
                    "id": "cell_001",
                    "cell_type": "markdown",
                    "source": [
                        "# Integration Test Notebook (Modified)\n",
                        "\n",
                        "This notebook is used for integration testing.\n",
                        "This line was added in the modification."
                    ],
                    "metadata": {}
                },
                {
                    "id": "cell_002",
                    "cell_type": "code",
                    "source": [
                        "import pandas as pd\n",
                        "import numpy as np\n",
                        "print('Hello, Modified Integration Test!')"
                    ],
                    "metadata": {},
                    "execution_count": 2,
                    "outputs": [
                        {
                            "output_type": "stream",
                            "name": "stdout",
                            "text": ["Hello, Modified Integration Test!\n"]
                        }
                    ]
                },
                {
                    "id": "cell_003",
                    "cell_type": "code",
                    "source": [
                        "# New cell added\n",
                        "data = np.random.randn(10, 2)\n",
                        "df = pd.DataFrame(data, columns=['X', 'Y'])\n",
                        "print(df.head())"
                    ],
                    "metadata": {},
                    "execution_count": 3,
                    "outputs": []
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
    
    def teardown_method(self):
        """各テストメソッド実行後のクリーンアップ"""
        # テスト用ノートブックの履歴をリセット
        response = client.delete(f"/api/v1/notebook-version/reset/{self.test_notebook_path}")
        # リセットが失敗してもテストは継続（履歴が存在しない場合など）
    
    def test_create_snapshot_success(self):
        """スナップショット作成の正常系テスト"""
        
        response = client.post(
            "/api/v1/notebook-version/snapshot",
            json={
                "notebook_path": self.test_notebook_path,
                "notebook_content": self.test_notebook_content,
                "author_id": self.test_author_id,
                "author_name": self.test_author_name
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["message"] == "Notebook snapshot created successfully"
        assert "snapshot" in data
        assert "created_at" in data
        
        snapshot = data["snapshot"]
        assert snapshot["notebook_path"] == self.test_notebook_path
        assert len(snapshot["cells"]) == 2
        assert snapshot["cells"][0]["cell_type"] == "markdown"
        assert snapshot["cells"][1]["cell_type"] == "code"
    
    def test_commit_direct_success(self):
        """直接コミットの正常系テスト"""
        
        response = client.post(
            "/api/v1/notebook-version/commit-direct",
            json={
                "notebook_path": self.test_notebook_path,
                "notebook_content": self.test_notebook_content,
                "commit_message": "Initial commit for integration test",
                "author_id": self.test_author_id,
                "author_name": self.test_author_name,
                "branch_name": self.test_branch_name
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["message"] == "Notebook committed successfully"
        assert "version" in data
        assert "snapshot" in data
        assert "version_id" in data
        assert "version_number" in data
        
        version = data["version"]
        assert version["notebook_path"] == self.test_notebook_path
        assert version["commit_message"] == "Initial commit for integration test"
        assert version["author_id"] == self.test_author_id
        assert version["status"] == "committed"
    
    def test_get_history_success(self):
        """バージョン履歴取得の正常系テスト"""
        
        # 最初にコミットを作成
        client.post(
            "/api/v1/notebook-version/commit-direct",
            json={
                "notebook_path": self.test_notebook_path,
                "notebook_content": self.test_notebook_content,
                "commit_message": "Initial commit",
                "author_id": self.test_author_id,
                "author_name": self.test_author_name
            }
        )
        
        # 履歴を取得
        response = client.get(f"/api/v1/notebook-version/history/{self.test_notebook_path}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["message"] == "Notebook history retrieved successfully"
        assert "history" in data
        assert data["notebook_path"] == self.test_notebook_path
        
        history = data["history"]
        assert len(history["versions"]) == 1
        assert len(history["branches"]) == 1
        assert history["branches"][0]["branch_name"] == "main"
    
    def test_get_history_not_found(self):
        """存在しないノートブックの履歴取得エラーテスト"""
        
        non_existent_path = "non_existent_notebook.ipynb"
        response = client.get(f"/api/v1/notebook-version/history/{non_existent_path}")
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()
    
    def test_get_latest_version_success(self):
        """最新バージョン取得の正常系テスト"""
        
        # コミットを作成
        client.post(
            "/api/v1/notebook-version/commit-direct",
            json={
                "notebook_path": self.test_notebook_path,
                "notebook_content": self.test_notebook_content,
                "commit_message": "Test commit",
                "author_id": self.test_author_id,
                "author_name": self.test_author_name
            }
        )
        
        # 最新バージョンを取得
        response = client.get(
            f"/api/v1/notebook-version/latest/{self.test_notebook_path}",
            params={"branch_name": "main"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["message"] == "Latest version retrieved successfully"
        assert "version" in data
        assert data["notebook_path"] == self.test_notebook_path
        assert data["branch_name"] == "main"
        
        version = data["version"]
        assert version["commit_message"] == "Test commit"
    
    def test_get_latest_version_not_found(self):
        """存在しないノートブックの最新バージョン取得エラーテスト"""
        
        non_existent_path = "non_existent_notebook.ipynb"
        response = client.get(f"/api/v1/notebook-version/latest/{non_existent_path}")
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()
    
    def test_create_branch_success(self):
        """ブランチ作成の正常系テスト"""
        
        # 最初にコミットを作成
        commit_response = client.post(
            "/api/v1/notebook-version/commit-direct",
            json={
                "notebook_path": self.test_notebook_path,
                "notebook_content": self.test_notebook_content,
                "commit_message": "Base commit for branching",
                "author_id": self.test_author_id,
                "author_name": self.test_author_name
            }
        )
        
        version_id = commit_response.json()["version_id"]
        
        # ブランチを作成
        response = client.post(
            "/api/v1/notebook-version/branch",
            json={
                "notebook_path": self.test_notebook_path,
                "branch_name": "feature-branch",
                "from_version_id": version_id,
                "author_id": self.test_author_id,
                "description": "Feature development branch"
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["message"] == "Branch created successfully"
        assert "branch" in data
        assert data["branch_name"] == "feature-branch"
        
        branch = data["branch"]
        assert branch["branch_name"] == "feature-branch"
        assert branch["description"] == "Feature development branch"
        assert branch["branched_from_version_id"] == version_id
    
    def test_compare_versions_success(self):
        """バージョン比較の正常系テスト"""
        
        # 最初のコミット
        first_commit_response = client.post(
            "/api/v1/notebook-version/commit-direct",
            json={
                "notebook_path": self.test_notebook_path,
                "notebook_content": self.test_notebook_content,
                "commit_message": "First commit",
                "author_id": self.test_author_id,
                "author_name": self.test_author_name
            }
        )
        
        first_version_id = first_commit_response.json()["version_id"]
        
        # 変更後のコミット
        second_commit_response = client.post(
            "/api/v1/notebook-version/commit-direct",
            json={
                "notebook_path": self.test_notebook_path,
                "notebook_content": self.modified_notebook_content,
                "commit_message": "Modified commit",
                "author_id": self.test_author_id,
                "author_name": self.test_author_name
            }
        )
        
        second_version_id = second_commit_response.json()["version_id"]
        
        # バージョン比較
        response = client.get(
            f"/api/v1/notebook-version/compare/{first_version_id}/{second_version_id}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["message"] == "Version comparison completed successfully"
        assert "comparison" in data
        assert data["from_version_id"] == first_version_id
        assert data["to_version_id"] == second_version_id
        
        comparison = data["comparison"]
        assert "cell_diffs" in comparison
        assert "summary" in comparison
        assert "similarity_score" in comparison
        
        # 変更の検証
        summary = comparison["summary"]
        assert summary["total_changes"] > 0
        assert summary["cells_added"] >= 1  # 新しいセルが追加された
        assert summary["cells_modified"] >= 1  # 既存セルが変更された
    
    def test_get_version_success(self):
        """バージョン詳細取得の正常系テスト"""
        
        # コミットを作成
        commit_response = client.post(
            "/api/v1/notebook-version/commit-direct",
            json={
                "notebook_path": self.test_notebook_path,
                "notebook_content": self.test_notebook_content,
                "commit_message": "Test version",
                "author_id": self.test_author_id,
                "author_name": self.test_author_name
            }
        )
        
        version_id = commit_response.json()["version_id"]
        
        # バージョン詳細を取得
        response = client.get(f"/api/v1/notebook-version/version/{version_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["message"] == "Notebook version retrieved successfully"
        assert "version" in data
        assert data["version_id"] == version_id
        
        version = data["version"]
        assert version["version_id"] == version_id
        assert version["commit_message"] == "Test version"
    
    def test_get_version_not_found(self):
        """存在しないバージョン取得エラーテスト"""
        
        non_existent_version_id = "non_existent_version_123"
        response = client.get(f"/api/v1/notebook-version/version/{non_existent_version_id}")
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()
    
    def test_get_snapshot_success(self):
        """スナップショット取得の正常系テスト"""
        
        # スナップショットを作成
        snapshot_response = client.post(
            "/api/v1/notebook-version/snapshot",
            json={
                "notebook_path": self.test_notebook_path,
                "notebook_content": self.test_notebook_content,
                "author_id": self.test_author_id,
                "author_name": self.test_author_name
            }
        )
        
        snapshot_id = snapshot_response.json()["snapshot"]["snapshot_id"]
        
        # スナップショットを取得
        response = client.get(f"/api/v1/notebook-version/snapshot/{snapshot_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["message"] == "Notebook snapshot retrieved successfully"
        assert "snapshot" in data
        assert data["snapshot_id"] == snapshot_id
        
        snapshot = data["snapshot"]
        assert snapshot["snapshot_id"] == snapshot_id
        assert snapshot["notebook_path"] == self.test_notebook_path
    
    def test_get_snapshot_not_found(self):
        """存在しないスナップショット取得エラーテスト"""
        
        non_existent_snapshot_id = "non_existent_snapshot_123"
        response = client.get(f"/api/v1/notebook-version/snapshot/{non_existent_snapshot_id}")
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()
    
    def test_get_stats_success(self):
        """統計情報取得の正常系テスト"""
        
        response = client.get("/api/v1/notebook-version/stats")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["message"] == "Version system stats retrieved successfully"
        assert "stats" in data
        
        stats = data["stats"]
        assert "total_notebooks" in stats
        assert "total_versions" in stats
        assert "total_commits" in stats
        assert "total_branches" in stats
        assert "system_health" in stats
        assert "average_versions_per_notebook" in stats
        assert "average_branches_per_notebook" in stats
    
    def test_simulate_commit_success(self):
        """コミットシミュレーションの正常系テスト"""
        
        response = client.post(
            "/api/v1/notebook-version/simulate-commit",
            json={
                "notebook_path": "simulation_test.ipynb",
                "author_id": "sim_user_001",
                "author_name": "Simulation User",
                "branch_name": "main"
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["message"] == "Notebook commit simulated successfully"
        assert "simulation_result" in data
        assert "simulated_at" in data
        
        simulation_result = data["simulation_result"]
        assert "version" in simulation_result
        assert "snapshot" in simulation_result
    
    def test_reset_history_success(self):
        """履歴リセットの正常系テスト"""
        
        # 最初にコミットを作成
        client.post(
            "/api/v1/notebook-version/commit-direct",
            json={
                "notebook_path": self.test_notebook_path,
                "notebook_content": self.test_notebook_content,
                "commit_message": "Commit to be reset",
                "author_id": self.test_author_id,
                "author_name": self.test_author_name
            }
        )
        
        # 履歴をリセット
        response = client.delete(f"/api/v1/notebook-version/reset/{self.test_notebook_path}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["message"] == "Notebook history reset successfully"
        assert data["notebook_path"] == self.test_notebook_path
        assert "warning" in data
        
        # リセット後に履歴が存在しないことを確認
        history_response = client.get(f"/api/v1/notebook-version/history/{self.test_notebook_path}")
        assert history_response.status_code == 404
    
    def test_workflow_integration(self):
        """ワークフロー統合テスト（スナップショット→コミット→ブランチ→比較）"""
        
        # 1. スナップショット作成
        snapshot_response = client.post(
            "/api/v1/notebook-version/snapshot",
            json={
                "notebook_path": self.test_notebook_path,
                "notebook_content": self.test_notebook_content,
                "author_id": self.test_author_id,
                "author_name": self.test_author_name
            }
        )
        
        assert snapshot_response.status_code == 201
        snapshot_id = snapshot_response.json()["snapshot"]["snapshot_id"]
        
        # 2. コミット
        commit_response = client.post(
            "/api/v1/notebook-version/commit",
            json={
                "notebook_path": self.test_notebook_path,
                "snapshot_id": snapshot_id,
                "commit_message": "Integration workflow test",
                "author_id": self.test_author_id,
                "author_name": self.test_author_name,
                "branch_name": "main"
            }
        )
        
        assert commit_response.status_code == 201
        first_version_id = commit_response.json()["version_id"]
        
        # 3. ブランチ作成
        branch_response = client.post(
            "/api/v1/notebook-version/branch",
            json={
                "notebook_path": self.test_notebook_path,
                "branch_name": "integration-test-branch",
                "from_version_id": first_version_id,
                "author_id": self.test_author_id,
                "description": "Integration test branch"
            }
        )
        
        assert branch_response.status_code == 201
        branch_id = branch_response.json()["branch_id"]
        
        # 4. 変更後のコミット
        second_commit_response = client.post(
            "/api/v1/notebook-version/commit-direct",
            json={
                "notebook_path": self.test_notebook_path,
                "notebook_content": self.modified_notebook_content,
                "commit_message": "Modified version for integration test",
                "author_id": self.test_author_id,
                "author_name": self.test_author_name,
                "branch_name": "integration-test-branch"
            }
        )
        
        assert second_commit_response.status_code == 201
        second_version_id = second_commit_response.json()["version_id"]
        
        # 5. バージョン比較
        compare_response = client.get(
            f"/api/v1/notebook-version/compare/{first_version_id}/{second_version_id}"
        )
        
        assert compare_response.status_code == 200
        comparison_data = compare_response.json()
        
        # 6. 履歴確認
        history_response = client.get(f"/api/v1/notebook-version/history/{self.test_notebook_path}")
        
        assert history_response.status_code == 200
        history_data = history_response.json()
        
        # 検証
        history = history_data["history"]
        assert len(history["versions"]) == 2  # 2つのバージョン
        assert len(history["branches"]) == 2  # mainとintegration-test-branch
        
        # 比較結果の検証
        comparison = comparison_data["comparison"]
        assert comparison["summary"]["total_changes"] > 0
        assert comparison["similarity_score"] < 1.0  # 変更があるので類似度は1.0未満
        
        # ブランチ情報の検証
        branch_response = client.get(f"/api/v1/notebook-version/branch/{branch_id}")
        assert branch_response.status_code == 200
        branch_data = branch_response.json()
        assert branch_data["branch"]["branch_name"] == "integration-test-branch"


if __name__ == "__main__":
    pytest.main([__file__])
