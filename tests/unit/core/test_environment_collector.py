"""
環境情報収集機能の単体テスト

EnvironmentCollectorクラスの各機能をテストし、
環境情報の収集、キャッシュ、差分検出が正常に動作することを確認。
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta

from core.environment_collector import (
    EnvironmentCollector,
    environment_collector,
    collect_current_environment,
    get_environment_summary
)
from schemas.environment import (
    PackageInfo,
    PythonEnvironmentInfo,
    SystemEnvironmentInfo,
    JupyterEnvironmentInfo,
    ExecutionEnvironmentSnapshot
)


class TestEnvironmentCollector:
    """EnvironmentCollectorクラスのテスト"""

    @pytest.fixture
    def collector(self):
        """テスト用のEnvironmentCollectorインスタンス"""
        return EnvironmentCollector()

    @pytest.fixture
    def mock_package_info(self):
        """テスト用のパッケージ情報"""
        return [
            PackageInfo(name="numpy", version="1.21.0", location="/usr/local/lib/python3.9/site-packages"),
            PackageInfo(name="pandas", version="1.3.0", location="/usr/local/lib/python3.9/site-packages"),
            PackageInfo(name="matplotlib", version="3.4.2", location="/usr/local/lib/python3.9/site-packages")
        ]

    @pytest.fixture
    def mock_python_env(self, mock_package_info):
        """テスト用のPython環境情報"""
        return PythonEnvironmentInfo(
            python_version="3.9.7",
            python_implementation="CPython",
            python_executable="/usr/local/bin/python3",
            virtual_env="/path/to/venv",
            conda_env=None,
            pip_version="21.2.4",
            key_packages=mock_package_info,
            total_packages_count=150
        )

    @pytest.fixture
    def mock_system_env(self):
        """テスト用のシステム環境情報"""
        return SystemEnvironmentInfo(
            os_name="Darwin",
            os_version="21.6.0",
            platform="macOS-12.5-x86_64-i386-64bit",
            architecture="x86_64",
            hostname="test-machine",
            cpu_count=8,
            memory_total_gb=16.0,
            disk_free_gb=100.0
        )

    @pytest.fixture
    def mock_jupyter_env(self):
        """テスト用のJupyter環境情報"""
        return JupyterEnvironmentInfo(
            jupyterlab_version="3.4.5",
            jupyter_core_version="4.11.1",
            ipython_version="8.4.0",
            kernel_name="python3",
            kernel_id="test-kernel-123",
            extensions=[
                {"name": "jupyterlab-git", "version": "0.41.0", "enabled": True},
                {"name": "cell-monitor", "version": "1.0.0", "enabled": True}
            ]
        )

    @pytest.mark.asyncio
    async def test_collect_environment_snapshot_full(self, collector, mock_python_env, mock_system_env, mock_jupyter_env):
        """完全な環境情報スナップショット収集のテスト"""

        with patch.object(collector, '_collect_python_environment', return_value=mock_python_env), \
             patch.object(collector, '_collect_system_environment', return_value=mock_system_env), \
             patch.object(collector, '_collect_jupyter_environment', return_value=mock_jupyter_env), \
             patch.object(collector, '_collect_performance_info', return_value=(512.0, 25.5)):

            snapshot = await collector.collect_environment_snapshot(
                notebook_path="/path/to/notebook.ipynb",
                cell_id="cell-123",
                execution_count=5,
                force_full_collection=True
            )

            # 基本情報の検証
            assert snapshot.notebook_path == "/path/to/notebook.ipynb"
            assert snapshot.cell_id == "cell-123"
            assert snapshot.execution_count == 5
            assert snapshot.is_full_snapshot is True
            assert snapshot.memory_usage_mb == 512.0
            assert snapshot.cpu_usage_percent == 25.5

            # 環境情報の検証
            assert snapshot.python_env == mock_python_env
            assert snapshot.system_env == mock_system_env
            assert snapshot.jupyter_env == mock_jupyter_env

            # 収集時間が記録されていることを確認
            assert snapshot.collection_duration_ms > 0
            assert isinstance(snapshot.captured_at, datetime)

    @pytest.mark.asyncio
    async def test_collect_environment_snapshot_incremental(self, collector, mock_python_env, mock_system_env, mock_jupyter_env):
        """差分収集のテスト"""

        # 最初のスナップショットを設定
        first_snapshot = ExecutionEnvironmentSnapshot(
            snapshot_id="first-snapshot",
            captured_at=datetime.now() - timedelta(minutes=10),
            python_env=mock_python_env,
            system_env=mock_system_env,
            jupyter_env=mock_jupyter_env,
            is_full_snapshot=True,
            changed_packages=[],
            collection_duration_ms=100.0
        )
        collector._last_snapshot = first_snapshot

        # 新しいパッケージ情報（変更あり）
        updated_packages = mock_python_env.key_packages.copy()
        updated_packages[0] = PackageInfo(name="numpy", version="1.22.0", location="/usr/local/lib/python3.9/site-packages")
        updated_python_env = mock_python_env.model_copy()
        updated_python_env.key_packages = updated_packages

        with patch.object(collector, '_collect_python_environment', return_value=updated_python_env), \
             patch.object(collector, '_collect_system_environment', return_value=mock_system_env), \
             patch.object(collector, '_collect_jupyter_environment', return_value=mock_jupyter_env), \
             patch.object(collector, '_collect_performance_info', return_value=(256.0, 15.0)):

            snapshot = await collector.collect_environment_snapshot(
                force_full_collection=False
            )

            # 差分収集であることを確認
            assert snapshot.is_full_snapshot is False

            # パッケージ変更が検出されていることを確認
            assert len(snapshot.changed_packages) > 0
            assert any("numpy" in change for change in snapshot.changed_packages)

    @pytest.mark.asyncio
    async def test_collect_python_environment(self, collector):
        """Python環境情報収集のテスト"""

        with patch('sys.version_info', (3, 9, 7)), \
             patch('platform.python_implementation', return_value="CPython"), \
             patch('sys.executable', "/usr/local/bin/python3"), \
             patch.dict('os.environ', {'VIRTUAL_ENV': '/path/to/venv'}), \
             patch.object(collector, '_collect_package_info', return_value=([], 100)):

            python_env = await collector._collect_python_environment(True)

            assert python_env.python_version == "3.9.7"
            assert python_env.python_implementation == "CPython"
            assert python_env.python_executable == "/usr/local/bin/python3"
            assert python_env.virtual_env == "/path/to/venv"
            assert python_env.total_packages_count == 100

    @pytest.mark.asyncio
    async def test_collect_system_environment(self, collector):
        """システム環境情報収集のテスト"""

        with patch('platform.system', return_value="Darwin"), \
             patch('platform.release', return_value="21.6.0"), \
             patch('platform.platform', return_value="macOS-12.5-x86_64-i386-64bit"), \
             patch('platform.machine', return_value="x86_64"), \
             patch('platform.node', return_value="test-machine"):

            system_env = await collector._collect_system_environment()

            assert system_env.os_name == "Darwin"
            assert system_env.os_version == "21.6.0"
            assert system_env.platform == "macOS-12.5-x86_64-i386-64bit"
            assert system_env.architecture == "x86_64"
            assert system_env.hostname == "test-machine"

    @pytest.mark.asyncio
    async def test_collect_jupyter_environment(self, collector):
        """Jupyter環境情報収集のテスト"""

        mock_jupyterlab = MagicMock()
        mock_jupyterlab.__version__ = "3.4.5"

        mock_jupyter_core = MagicMock()
        mock_jupyter_core.__version__ = "4.11.1"

        mock_ipython = MagicMock()
        mock_ipython.__version__ = "8.4.0"

        with patch.dict('sys.modules', {
            'jupyterlab': mock_jupyterlab,
            'jupyter_core': mock_jupyter_core,
            'IPython': mock_ipython
        }), \
             patch.dict('os.environ', {
                 'KERNEL_NAME': 'python3',
                 'KERNEL_ID': 'test-kernel-123'
             }), \
             patch('subprocess.run') as mock_subprocess:

            # subprocess.runのモック設定
            mock_subprocess.return_value.returncode = 0
            mock_subprocess.return_value.stdout = '{"extensions": []}'

            jupyter_env = await collector._collect_jupyter_environment()

            assert jupyter_env.jupyterlab_version == "3.4.5"
            assert jupyter_env.jupyter_core_version == "4.11.1"
            assert jupyter_env.ipython_version == "8.4.0"
            assert jupyter_env.kernel_name == "python3"
            assert jupyter_env.kernel_id == "test-kernel-123"

    @pytest.mark.asyncio
    async def test_collect_package_info(self, collector):
        """パッケージ情報収集のテスト"""

        # pkg_resourcesのモック
        mock_pkg1 = MagicMock()
        mock_pkg1.project_name = "numpy"
        mock_pkg1.version = "1.21.0"
        mock_pkg1.location = "/usr/local/lib/python3.9/site-packages"

        mock_pkg2 = MagicMock()
        mock_pkg2.project_name = "pandas"
        mock_pkg2.version = "1.3.0"
        mock_pkg2.location = "/usr/local/lib/python3.9/site-packages"

        with patch('core.environment_collector.pkg_resources') as mock_pkg_resources:
            mock_pkg_resources.working_set = [mock_pkg1, mock_pkg2]

            key_packages, total_count = await collector._collect_package_info()

            assert total_count == 2
            assert len(key_packages) == 2

            # numpyパッケージの検証
            numpy_pkg = next((pkg for pkg in key_packages if pkg.name == "numpy"), None)
            assert numpy_pkg is not None
            assert numpy_pkg.version == "1.21.0"

    def test_detect_package_changes(self, collector, mock_python_env):
        """パッケージ変更検出のテスト"""

        # 最初のスナップショットを設定
        first_snapshot = ExecutionEnvironmentSnapshot(
            snapshot_id="first",
            captured_at=datetime.now(),
            python_env=mock_python_env,
            system_env=SystemEnvironmentInfo(
                os_name="Darwin", os_version="21.6.0", platform="test", architecture="x86_64"
            ),
            jupyter_env=JupyterEnvironmentInfo(),
            is_full_snapshot=True,
            changed_packages=[],
            collection_duration_ms=100.0
        )
        collector._last_snapshot = first_snapshot

        # 変更されたPython環境（numpyのバージョンが変更）
        updated_packages = mock_python_env.key_packages.copy()
        updated_packages[0] = PackageInfo(name="numpy", version="1.22.0", location="/usr/local/lib/python3.9/site-packages")
        updated_python_env = mock_python_env.model_copy()
        updated_python_env.key_packages = updated_packages

        changes = collector._detect_package_changes(updated_python_env)

        assert len(changes) > 0
        assert any("numpy" in change and "updated" in change for change in changes)

    def test_create_environment_diff(self, collector, mock_python_env, mock_system_env, mock_jupyter_env):
        """環境差分作成のテスト"""

        # 元のスナップショット
        from_snapshot = ExecutionEnvironmentSnapshot(
            snapshot_id="from",
            captured_at=datetime.now() - timedelta(hours=1),
            python_env=mock_python_env,
            system_env=mock_system_env,
            jupyter_env=mock_jupyter_env,
            is_full_snapshot=True,
            changed_packages=[],
            collection_duration_ms=100.0
        )

        # 変更後のスナップショット（パッケージ追加）
        updated_packages = mock_python_env.key_packages.copy()
        updated_packages.append(PackageInfo(name="scikit-learn", version="1.0.2", location="/usr/local/lib/python3.9/site-packages"))
        updated_python_env = mock_python_env.model_copy()
        updated_python_env.key_packages = updated_packages

        to_snapshot = ExecutionEnvironmentSnapshot(
            snapshot_id="to",
            captured_at=datetime.now(),
            python_env=updated_python_env,
            system_env=mock_system_env,
            jupyter_env=mock_jupyter_env,
            is_full_snapshot=False,
            changed_packages=["scikit-learn (added: 1.0.2)"],
            collection_duration_ms=50.0
        )

        diff = collector.create_environment_diff(from_snapshot, to_snapshot)

        assert diff.from_snapshot_id == "from"
        assert diff.to_snapshot_id == "to"
        assert len(diff.added_packages) == 1
        assert diff.added_packages[0].name == "scikit-learn"
        assert len(diff.removed_packages) == 0
        assert len(diff.updated_packages) == 0


class TestEnvironmentCollectorUtilities:
    """環境情報収集ユーティリティ関数のテスト"""

    @pytest.mark.asyncio
    async def test_collect_current_environment(self):
        """現在環境情報収集の便利関数テスト"""

        with patch.object(environment_collector, 'collect_environment_snapshot') as mock_collect:
            mock_snapshot = MagicMock()
            mock_snapshot.snapshot_id = "test-snapshot"
            mock_collect.return_value = mock_snapshot

            result = await collect_current_environment(
                notebook_path="/test/notebook.ipynb",
                cell_id="test-cell",
                execution_count=10
            )

            assert result == mock_snapshot
            mock_collect.assert_called_once_with(
                notebook_path="/test/notebook.ipynb",
                cell_id="test-cell",
                execution_count=10
            )

    def test_get_environment_summary(self):
        """環境サマリー取得のテスト"""

        with patch('sys.version_info', (3, 9, 7)), \
             patch('platform.platform', return_value="macOS-12.5-x86_64"), \
             patch.dict('os.environ', {'VIRTUAL_ENV': '/test/venv'}):

            summary = get_environment_summary()

            assert summary['python_version'] == "3.9.7"
            assert summary['platform'] == "macOS-12.5-x86_64"
            assert summary['virtual_env'] == "/test/venv"
            assert 'has_psutil' in summary
            assert 'has_pkg_resources' in summary


class TestEnvironmentCollectorEdgeCases:
    """環境情報収集のエッジケースのテスト"""

    @pytest.fixture
    def collector(self):
        return EnvironmentCollector()

    @pytest.mark.asyncio
    async def test_collect_environment_with_missing_dependencies(self, collector):
        """依存関係が不足している場合のテスト"""

        with patch('core.environment_collector.psutil', None), \
             patch('core.environment_collector.pkg_resources', None):

            # エラーが発生せずに基本情報のみ収集されることを確認
            snapshot = await collector.collect_environment_snapshot()

            assert snapshot.python_env.python_version is not None
            assert snapshot.system_env.os_name is not None
            assert snapshot.memory_usage_mb is None  # psutilがないため

    @pytest.mark.asyncio
    async def test_collect_environment_with_subprocess_error(self, collector):
        """subprocess実行エラーのテスト"""

        with patch('subprocess.run', side_effect=Exception("Command failed")):

            # エラーが発生してもJupyter環境情報の基本部分は収集されることを確認
            jupyter_env = await collector._collect_jupyter_environment()

            assert jupyter_env is not None
            assert jupyter_env.extensions == []  # エラー時は空リスト

    def test_package_cache_expiration(self, collector):
        """パッケージキャッシュの期限切れテスト"""

        # キャッシュタイムスタンプを古い時刻に設定
        collector._cache_timestamp = datetime.now() - timedelta(seconds=400)

        assert collector._is_package_cache_expired() is True

        # 新しいタイムスタンプに設定
        collector._cache_timestamp = datetime.now()

        assert collector._is_package_cache_expired() is False

    def test_should_do_full_collection_logic(self, collector):
        """完全収集判定ロジックのテスト"""

        # 最初のスナップショットがない場合
        collector._last_snapshot = None
        assert collector._should_do_full_collection() is True

        # 最近のスナップショットがある場合
        recent_snapshot = MagicMock()
        recent_snapshot.captured_at = datetime.now() - timedelta(minutes=30)
        collector._last_snapshot = recent_snapshot
        assert collector._should_do_full_collection() is False

        # 古いスナップショットがある場合
        old_snapshot = MagicMock()
        old_snapshot.captured_at = datetime.now() - timedelta(hours=2)
        collector._last_snapshot = old_snapshot
        assert collector._should_do_full_collection() is True
