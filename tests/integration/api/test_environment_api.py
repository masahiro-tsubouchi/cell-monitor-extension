"""
環境情報API統合テスト

環境情報収集・分析APIエンドポイントの統合テストを実行し、
実際のHTTPリクエスト/レスポンスの動作を検証する。
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from datetime import datetime

from main import app
from schemas.environment import (
    PackageInfo,
    PythonEnvironmentInfo,
    SystemEnvironmentInfo,
    JupyterEnvironmentInfo,
    ExecutionEnvironmentSnapshot
)


class TestEnvironmentAPI:
    """環境情報APIエンドポイントの統合テスト"""
    
    @pytest.fixture
    def client(self):
        """テスト用HTTPクライアント"""
        return TestClient(app)
    
    @pytest.fixture
    def mock_environment_snapshot(self):
        """テスト用環境スナップショット"""
        return ExecutionEnvironmentSnapshot(
            snapshot_id="test-snapshot-123",
            captured_at=datetime.now(),
            python_env=PythonEnvironmentInfo(
                python_version="3.9.7",
                python_implementation="CPython",
                python_executable="/usr/local/bin/python3",
                virtual_env="/path/to/venv",
                conda_env=None,
                pip_version="21.2.4",
                key_packages=[
                    PackageInfo(name="numpy", version="1.21.0", location="/usr/local/lib/python3.9/site-packages"),
                    PackageInfo(name="pandas", version="1.3.0", location="/usr/local/lib/python3.9/site-packages")
                ],
                total_packages_count=150
            ),
            system_env=SystemEnvironmentInfo(
                os_name="Darwin",
                os_version="21.6.0",
                platform="macOS-12.5-x86_64-i386-64bit",
                architecture="x86_64",
                hostname="test-machine",
                cpu_count=8,
                memory_total_gb=16.0,
                disk_free_gb=100.0
            ),
            jupyter_env=JupyterEnvironmentInfo(
                jupyterlab_version="3.4.5",
                jupyter_core_version="4.11.1",
                ipython_version="8.4.0",
                kernel_name="python3",
                kernel_id="test-kernel-123",
                extensions=[
                    {"name": "jupyterlab-git", "version": "0.41.0", "enabled": True}
                ]
            ),
            memory_usage_mb=512.0,
            cpu_usage_percent=25.5,
            is_full_snapshot=True,
            changed_packages=[],
            collection_duration_ms=150.0
        )
    
    def test_get_current_environment_success(self, client, mock_environment_snapshot):
        """現在環境情報取得の正常系テスト"""
        
        with patch('api.endpoints.environment.collect_current_environment', return_value=mock_environment_snapshot):
            response = client.get("/api/v1/environment/current")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["message"] == "Current environment information collected successfully"
            assert data["collection_time_ms"] == 150.0
            assert data["is_full_snapshot"] is True
            
            # スナップショット内容の検証
            snapshot = data["snapshot"]
            assert snapshot["snapshot_id"] == "test-snapshot-123"
            assert snapshot["python_env"]["python_version"] == "3.9.7"
            assert snapshot["system_env"]["os_name"] == "Darwin"
            assert snapshot["jupyter_env"]["jupyterlab_version"] == "3.4.5"
    
    def test_get_current_environment_error(self, client):
        """現在環境情報取得のエラー系テスト"""
        
        with patch('api.endpoints.environment.collect_current_environment', side_effect=Exception("Collection failed")):
            response = client.get("/api/v1/environment/current")
            
            assert response.status_code == 500
            data = response.json()
            assert "Failed to collect current environment" in data["detail"]
    
    def test_get_environment_summary_success(self, client):
        """環境サマリー取得の正常系テスト"""
        
        mock_summary = {
            'python_version': "3.9.7",
            'platform': "macOS-12.5-x86_64",
            'virtual_env': "/path/to/venv",
            'conda_env': None,
            'has_psutil': True,
            'has_pkg_resources': True
        }
        
        with patch('api.endpoints.environment.get_environment_summary', return_value=mock_summary):
            response = client.get("/api/v1/environment/summary")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["message"] == "Environment summary retrieved successfully"
            assert data["summary"]["python_version"] == "3.9.7"
            assert data["summary"]["platform"] == "macOS-12.5-x86_64"
            assert "timestamp" in data
    
    def test_create_environment_snapshot_success(self, client, mock_environment_snapshot):
        """環境スナップショット作成の正常系テスト"""
        
        with patch('api.endpoints.environment.environment_collector.collect_environment_snapshot', return_value=mock_environment_snapshot):
            response = client.post(
                "/api/v1/environment/snapshot",
                params={
                    "notebook_path": "/test/notebook.ipynb",
                    "cell_id": "cell-123",
                    "execution_count": 5,
                    "force_full_collection": True
                }
            )
            
            assert response.status_code == 201
            data = response.json()
            
            assert data["message"] == "Environment snapshot created successfully"
            assert data["snapshot_id"] == "test-snapshot-123"
            assert data["collection_time_ms"] == 150.0
            assert data["changed_packages_count"] == 0
    
    def test_create_environment_snapshot_minimal_params(self, client, mock_environment_snapshot):
        """環境スナップショット作成の最小パラメータテスト"""
        
        with patch('api.endpoints.environment.environment_collector.collect_environment_snapshot', return_value=mock_environment_snapshot):
            response = client.post("/api/v1/environment/snapshot")
            
            assert response.status_code == 201
            data = response.json()
            assert data["snapshot_id"] == "test-snapshot-123"
    
    def test_get_package_information_specific_packages(self, client, mock_environment_snapshot):
        """特定パッケージ情報取得のテスト"""
        
        with patch('api.endpoints.environment.collect_current_environment', return_value=mock_environment_snapshot):
            response = client.get(
                "/api/v1/environment/packages",
                params={"package_names": ["numpy", "pandas"]}
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["message"] == "Package information retrieved successfully"
            assert len(data["packages"]) == 2
            assert data["total_packages_count"] == 150
            
            # パッケージ情報の検証
            package_names = [pkg["name"] for pkg in data["packages"]]
            assert "numpy" in package_names
            assert "pandas" in package_names
    
    def test_get_package_information_all_packages(self, client, mock_environment_snapshot):
        """全パッケージ情報取得のテスト"""
        
        with patch('api.endpoints.environment.collect_current_environment', return_value=mock_environment_snapshot):
            response = client.get(
                "/api/v1/environment/packages",
                params={"include_all": True}
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["message"] == "Package information retrieved successfully"
            assert len(data["packages"]) == 2  # mock_environment_snapshotには2つのパッケージ
            assert data["snapshot_id"] == "test-snapshot-123"
    
    def test_check_environment_health_excellent(self, client, mock_environment_snapshot):
        """環境健全性チェック（優秀）のテスト"""
        
        with patch('api.endpoints.environment.collect_current_environment', return_value=mock_environment_snapshot), \
             patch('api.endpoints.environment._calculate_environment_health_score', return_value=0.95), \
             patch('api.endpoints.environment._generate_environment_recommendations', return_value=["Environment appears to be well-configured"]), \
             patch('api.endpoints.environment._detect_environment_warnings', return_value=[]):
            
            response = client.get("/api/v1/environment/health")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["message"] == "Environment health check completed"
            assert data["health_score"] == 0.95
            assert data["health_level"] == "excellent"
            assert len(data["recommendations"]) == 1
            assert len(data["warnings"]) == 0
    
    def test_check_environment_health_warning(self, client, mock_environment_snapshot):
        """環境健全性チェック（警告）のテスト"""
        
        with patch('api.endpoints.environment.collect_current_environment', return_value=mock_environment_snapshot), \
             patch('api.endpoints.environment._calculate_environment_health_score', return_value=0.6), \
             patch('api.endpoints.environment._generate_environment_recommendations', return_value=["Consider upgrading Python version"]), \
             patch('api.endpoints.environment._detect_environment_warnings', return_value=["Low disk space detected"]):
            
            response = client.get("/api/v1/environment/health")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["health_level"] == "warning"
            assert len(data["recommendations"]) == 1
            assert len(data["warnings"]) == 1
            assert "Low disk space detected" in data["warnings"]
    
    def test_get_environment_diff_with_changes(self, client, mock_environment_snapshot):
        """環境差分取得（変更あり）のテスト"""
        
        mock_diff = MagicMock()
        mock_diff.model_dump.return_value = {
            "from_snapshot_id": "old-snapshot",
            "to_snapshot_id": "test-snapshot-123",
            "added_packages": [{"name": "scikit-learn", "version": "1.0.2"}],
            "removed_packages": [],
            "updated_packages": [{"name": "numpy", "old_version": "1.20.0", "new_version": "1.21.0"}]
        }
        mock_diff.from_snapshot_id = "old-snapshot"
        mock_diff.to_snapshot_id = "test-snapshot-123"
        mock_diff.added_packages = [MagicMock()]
        mock_diff.removed_packages = []
        mock_diff.updated_packages = [MagicMock()]
        
        with patch('api.endpoints.environment.collect_current_environment', return_value=mock_environment_snapshot), \
             patch('api.endpoints.environment.environment_collector._last_snapshot') as mock_last_snapshot, \
             patch('api.endpoints.environment.environment_collector.create_environment_diff', return_value=mock_diff):
            
            mock_last_snapshot.snapshot_id = "old-snapshot"
            
            response = client.get("/api/v1/environment/diff")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["message"] == "Environment diff calculated successfully"
            assert data["changes_detected"] is True
            assert data["from_snapshot_id"] == "old-snapshot"
            assert data["to_snapshot_id"] == "test-snapshot-123"
    
    def test_get_environment_diff_no_previous_snapshot(self, client, mock_environment_snapshot):
        """環境差分取得（前回スナップショットなし）のテスト"""
        
        with patch('api.endpoints.environment.collect_current_environment', return_value=mock_environment_snapshot), \
             patch('api.endpoints.environment.environment_collector._last_snapshot', None):
            
            response = client.get("/api/v1/environment/diff")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["message"] == "No previous snapshot available for comparison"
            assert data["changes_detected"] is False
            assert data["current_snapshot_id"] == "test-snapshot-123"
    
    def test_analyze_environment_success(self, client, mock_environment_snapshot):
        """環境分析の正常系テスト"""
        
        mock_analysis = {
            "performance_indicators": {
                "python_version_score": 0.8,
                "memory_efficiency": 0.7,
                "package_optimization": 0.9
            },
            "compatibility_info": {
                "python_compatibility": {"version": "3.9.7", "is_supported": True},
                "package_conflicts": [],
                "jupyter_compatibility": {"jupyterlab_version": "3.4.5", "is_compatible": True}
            },
            "overall_score": 0.8,
            "analysis_summary": "Environment analysis completed with detailed metrics"
        }
        
        with patch('api.endpoints.environment.collect_current_environment', return_value=mock_environment_snapshot), \
             patch('api.endpoints.environment._perform_environment_analysis', return_value=mock_analysis):
            
            response = client.post("/api/v1/environment/analyze")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["message"] == "Environment analysis completed successfully"
            assert data["analysis"]["overall_score"] == 0.8
            assert data["analysis"]["performance_indicators"]["python_version_score"] == 0.8
            assert data["snapshot_id"] == "test-snapshot-123"


class TestEnvironmentAPIErrorHandling:
    """環境情報APIのエラーハンドリングテスト"""
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    def test_get_current_environment_collection_error(self, client):
        """環境情報収集エラーのテスト"""
        
        with patch('api.endpoints.environment.collect_current_environment', side_effect=RuntimeError("System error")):
            response = client.get("/api/v1/environment/current")
            
            assert response.status_code == 500
            data = response.json()
            assert "Failed to collect current environment" in data["detail"]
            assert "System error" in data["detail"]
    
    def test_create_snapshot_collection_error(self, client):
        """スナップショット作成エラーのテスト"""
        
        with patch('api.endpoints.environment.environment_collector.collect_environment_snapshot', side_effect=ValueError("Invalid parameters")):
            response = client.post("/api/v1/environment/snapshot")
            
            assert response.status_code == 500
            data = response.json()
            assert "Failed to create environment snapshot" in data["detail"]
    
    def test_get_package_information_error(self, client):
        """パッケージ情報取得エラーのテスト"""
        
        with patch('api.endpoints.environment.collect_current_environment', side_effect=ImportError("Package not found")):
            response = client.get("/api/v1/environment/packages")
            
            assert response.status_code == 500
            data = response.json()
            assert "Failed to get package information" in data["detail"]
    
    def test_check_environment_health_error(self, client):
        """環境健全性チェックエラーのテスト"""
        
        with patch('api.endpoints.environment.collect_current_environment', side_effect=OSError("System access denied")):
            response = client.get("/api/v1/environment/health")
            
            assert response.status_code == 500
            data = response.json()
            assert "Failed to check environment health" in data["detail"]
    
    def test_get_environment_diff_error(self, client):
        """環境差分取得エラーのテスト"""
        
        with patch('api.endpoints.environment.collect_current_environment', side_effect=MemoryError("Out of memory")):
            response = client.get("/api/v1/environment/diff")
            
            assert response.status_code == 500
            data = response.json()
            assert "Failed to get environment diff" in data["detail"]
    
    def test_analyze_environment_error(self, client):
        """環境分析エラーのテスト"""
        
        with patch('api.endpoints.environment.collect_current_environment', side_effect=Exception("Analysis failed")):
            response = client.post("/api/v1/environment/analyze")
            
            assert response.status_code == 500
            data = response.json()
            assert "Failed to analyze environment" in data["detail"]


class TestEnvironmentAPIParameterValidation:
    """環境情報APIのパラメータ検証テスト"""
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    def test_get_environment_diff_invalid_hours_back(self, client):
        """環境差分取得の無効な時間パラメータテスト"""
        
        # 範囲外の値（0時間）
        response = client.get("/api/v1/environment/diff", params={"hours_back": 0})
        assert response.status_code == 422
        
        # 範囲外の値（200時間）
        response = client.get("/api/v1/environment/diff", params={"hours_back": 200})
        assert response.status_code == 422
    
    def test_get_package_information_empty_package_names(self, client):
        """パッケージ情報取得の空のパッケージ名リストテスト"""
        
        mock_snapshot = MagicMock()
        mock_snapshot.python_env.key_packages = []
        mock_snapshot.python_env.total_packages_count = 0
        mock_snapshot.snapshot_id = "test"
        mock_snapshot.captured_at = datetime.now()
        
        with patch('api.endpoints.environment.collect_current_environment', return_value=mock_snapshot):
            response = client.get(
                "/api/v1/environment/packages",
                params={"package_names": []}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert len(data["packages"]) == 0
