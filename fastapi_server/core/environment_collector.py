"""
実行環境情報収集ユーティリティ

JupyterLabセル実行時の環境情報を自動収集する機能を提供。
Python環境、システム情報、Jupyter環境の詳細を効率的に取得。
"""

import sys
import os
import platform
import subprocess
import json
import time
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
import logging

try:
    import psutil
except ImportError:
    psutil = None

try:
    import pkg_resources
except ImportError:
    pkg_resources = None

from schemas.environment import (
    PackageInfo,
    PythonEnvironmentInfo,
    SystemEnvironmentInfo,
    JupyterEnvironmentInfo,
    ExecutionEnvironmentSnapshot,
    EnvironmentDiff
)

logger = logging.getLogger(__name__)


class EnvironmentCollector:
    """
    実行環境情報収集クラス
    
    セル実行時の環境情報を効率的に収集し、
    差分検出やキャッシュ機能を提供する。
    """
    
    def __init__(self):
        self._last_snapshot: Optional[ExecutionEnvironmentSnapshot] = None
        self._package_cache: Dict[str, PackageInfo] = {}
        self._cache_timestamp: Optional[datetime] = None
        self._cache_ttl_seconds = 300  # 5分間キャッシュ
        
        # 重要パッケージリスト（優先的に追跡）
        self.key_packages = [
            'numpy', 'pandas', 'matplotlib', 'seaborn', 'scipy',
            'scikit-learn', 'tensorflow', 'torch', 'keras',
            'jupyter', 'jupyterlab', 'ipython', 'notebook',
            'requests', 'flask', 'django', 'fastapi'
        ]
    
    async def collect_environment_snapshot(
        self,
        notebook_path: Optional[str] = None,
        cell_id: Optional[str] = None,
        execution_count: Optional[int] = None,
        force_full_collection: bool = False
    ) -> ExecutionEnvironmentSnapshot:
        """
        環境情報スナップショットを収集する
        
        Args:
            notebook_path: ノートブックパス
            cell_id: セルID
            execution_count: 実行回数
            force_full_collection: 強制的に完全収集を行う
            
        Returns:
            環境情報スナップショット
        """
        start_time = time.time()
        snapshot_id = str(uuid.uuid4())
        
        try:
            # 差分収集か完全収集かを判定
            is_full_snapshot = (
                force_full_collection or 
                self._last_snapshot is None or
                self._should_do_full_collection()
            )
            
            # 各環境情報を収集
            python_env = await self._collect_python_environment(is_full_snapshot)
            system_env = await self._collect_system_environment()
            jupyter_env = await self._collect_jupyter_environment()
            
            # パフォーマンス情報を収集
            memory_usage, cpu_usage = self._collect_performance_info()
            
            # 変更されたパッケージを検出
            changed_packages = []
            if not is_full_snapshot and self._last_snapshot:
                changed_packages = self._detect_package_changes(python_env)
            
            # スナップショットを作成
            snapshot = ExecutionEnvironmentSnapshot(
                snapshot_id=snapshot_id,
                captured_at=datetime.now(),
                python_env=python_env,
                system_env=system_env,
                jupyter_env=jupyter_env,
                notebook_path=notebook_path,
                cell_id=cell_id,
                execution_count=execution_count,
                memory_usage_mb=memory_usage,
                cpu_usage_percent=cpu_usage,
                is_full_snapshot=is_full_snapshot,
                changed_packages=changed_packages,
                collection_duration_ms=(time.time() - start_time) * 1000
            )
            
            # 最後のスナップショットとして保存
            self._last_snapshot = snapshot
            
            logger.info(
                f"Environment snapshot collected: {snapshot_id} "
                f"(full={is_full_snapshot}, duration={snapshot.collection_duration_ms:.1f}ms)"
            )
            
            return snapshot
            
        except Exception as e:
            logger.error(f"Failed to collect environment snapshot: {e}")
            raise
    
    async def _collect_python_environment(self, is_full_snapshot: bool) -> PythonEnvironmentInfo:
        """Python環境情報を収集する"""
        
        # 基本的なPython情報
        python_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        python_implementation = platform.python_implementation()
        python_executable = sys.executable
        
        # 仮想環境情報
        virtual_env = os.environ.get('VIRTUAL_ENV')
        conda_env = os.environ.get('CONDA_DEFAULT_ENV')
        
        # pipバージョン
        pip_version = None
        try:
            import pip
            pip_version = pip.__version__
        except (ImportError, AttributeError):
            pass
        
        # パッケージ情報を収集
        key_packages = []
        total_packages_count = 0
        
        if is_full_snapshot or self._is_package_cache_expired():
            key_packages, total_packages_count = await self._collect_package_info()
            self._cache_timestamp = datetime.now()
        else:
            # キャッシュから取得
            key_packages = list(self._package_cache.values())
            total_packages_count = len(key_packages)  # 簡易的な数
        
        return PythonEnvironmentInfo(
            python_version=python_version,
            python_implementation=python_implementation,
            python_executable=python_executable,
            virtual_env=virtual_env,
            conda_env=conda_env,
            pip_version=pip_version,
            key_packages=key_packages,
            total_packages_count=total_packages_count
        )
    
    async def _collect_system_environment(self) -> SystemEnvironmentInfo:
        """システム環境情報を収集する"""
        
        # 基本システム情報
        os_name = platform.system()
        os_version = platform.release()
        platform_info = platform.platform()
        architecture = platform.machine()
        hostname = platform.node()
        
        # リソース情報
        cpu_count = None
        memory_total_gb = None
        disk_free_gb = None
        
        if psutil:
            try:
                cpu_count = psutil.cpu_count()
                memory_info = psutil.virtual_memory()
                memory_total_gb = memory_info.total / (1024**3)  # GB変換
                
                # ディスク使用量（現在のディレクトリ）
                disk_usage = psutil.disk_usage('.')
                disk_free_gb = disk_usage.free / (1024**3)  # GB変換
                
            except Exception as e:
                logger.warning(f"Failed to collect system resource info: {e}")
        
        return SystemEnvironmentInfo(
            os_name=os_name,
            os_version=os_version,
            platform=platform_info,
            architecture=architecture,
            hostname=hostname,
            cpu_count=cpu_count,
            memory_total_gb=memory_total_gb,
            disk_free_gb=disk_free_gb
        )
    
    async def _collect_jupyter_environment(self) -> JupyterEnvironmentInfo:
        """Jupyter環境情報を収集する"""
        
        # Jupyterバージョン情報
        jupyterlab_version = None
        jupyter_core_version = None
        ipython_version = None
        
        try:
            # JupyterLabバージョン
            try:
                import jupyterlab
                jupyterlab_version = jupyterlab.__version__
            except ImportError:
                pass
            
            # Jupyter Coreバージョン
            try:
                import jupyter_core
                jupyter_core_version = jupyter_core.__version__
            except ImportError:
                pass
            
            # IPythonバージョン
            try:
                import IPython
                ipython_version = IPython.__version__
            except ImportError:
                pass
                
        except Exception as e:
            logger.warning(f"Failed to collect Jupyter version info: {e}")
        
        # カーネル情報（環境変数から取得を試行）
        kernel_name = os.environ.get('KERNEL_NAME')
        kernel_id = os.environ.get('KERNEL_ID')
        
        # 拡張機能情報（簡易版）
        extensions = []
        try:
            # jupyter labextension list の実行を試行
            result = subprocess.run(
                ['jupyter', 'labextension', 'list', '--json'],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                extensions_data = json.loads(result.stdout)
                for ext in extensions_data.get('extensions', []):
                    extensions.append({
                        'name': ext.get('name', ''),
                        'version': ext.get('version', ''),
                        'enabled': ext.get('enabled', False)
                    })
        except Exception as e:
            logger.warning(f"Failed to collect extension info: {e}")
        
        return JupyterEnvironmentInfo(
            jupyterlab_version=jupyterlab_version,
            jupyter_core_version=jupyter_core_version,
            ipython_version=ipython_version,
            kernel_name=kernel_name,
            kernel_id=kernel_id,
            extensions=extensions
        )
    
    async def _collect_package_info(self) -> Tuple[List[PackageInfo], int]:
        """パッケージ情報を収集する"""
        key_packages = []
        total_count = 0
        
        if pkg_resources:
            try:
                # インストール済みパッケージを取得
                installed_packages = {pkg.project_name.lower(): pkg for pkg in pkg_resources.working_set}
                total_count = len(installed_packages)
                
                # 重要パッケージの情報を収集
                for package_name in self.key_packages:
                    pkg = installed_packages.get(package_name.lower())
                    if pkg:
                        package_info = PackageInfo(
                            name=pkg.project_name,
                            version=pkg.version,
                            location=pkg.location
                        )
                        key_packages.append(package_info)
                        self._package_cache[package_name.lower()] = package_info
                
            except Exception as e:
                logger.warning(f"Failed to collect package info: {e}")
        
        return key_packages, total_count
    
    def _collect_performance_info(self) -> Tuple[Optional[float], Optional[float]]:
        """パフォーマンス情報を収集する"""
        memory_usage_mb = None
        cpu_usage_percent = None
        
        if psutil:
            try:
                # 現在のプロセスのメモリ使用量
                process = psutil.Process()
                memory_info = process.memory_info()
                memory_usage_mb = memory_info.rss / (1024**2)  # MB変換
                
                # CPU使用率（短時間サンプリング）
                cpu_usage_percent = psutil.cpu_percent(interval=0.1)
                
            except Exception as e:
                logger.warning(f"Failed to collect performance info: {e}")
        
        return memory_usage_mb, cpu_usage_percent
    
    def _should_do_full_collection(self) -> bool:
        """完全収集が必要かどうかを判定する"""
        if not self._last_snapshot:
            return True
        
        # 前回から一定時間経過している場合
        time_since_last = datetime.now() - self._last_snapshot.captured_at
        if time_since_last.total_seconds() > 3600:  # 1時間
            return True
        
        return False
    
    def _is_package_cache_expired(self) -> bool:
        """パッケージキャッシュが期限切れかどうかを判定する"""
        if not self._cache_timestamp:
            return True
        
        time_since_cache = datetime.now() - self._cache_timestamp
        return time_since_cache.total_seconds() > self._cache_ttl_seconds
    
    def _detect_package_changes(self, current_python_env: PythonEnvironmentInfo) -> List[str]:
        """パッケージの変更を検出する"""
        changed_packages = []
        
        if not self._last_snapshot:
            return changed_packages
        
        # 現在のパッケージ情報をマップに変換
        current_packages = {
            pkg.name.lower(): pkg.version 
            for pkg in current_python_env.key_packages
        }
        
        # 前回のパッケージ情報をマップに変換
        last_packages = {
            pkg.name.lower(): pkg.version 
            for pkg in self._last_snapshot.python_env.key_packages
        }
        
        # 変更を検出
        for pkg_name, version in current_packages.items():
            if pkg_name not in last_packages:
                changed_packages.append(f"{pkg_name} (added: {version})")
            elif last_packages[pkg_name] != version:
                changed_packages.append(f"{pkg_name} (updated: {last_packages[pkg_name]} -> {version})")
        
        # 削除されたパッケージ
        for pkg_name in last_packages:
            if pkg_name not in current_packages:
                changed_packages.append(f"{pkg_name} (removed)")
        
        return changed_packages
    
    def create_environment_diff(
        self, 
        from_snapshot: ExecutionEnvironmentSnapshot,
        to_snapshot: ExecutionEnvironmentSnapshot
    ) -> EnvironmentDiff:
        """2つのスナップショット間の差分を作成する"""
        
        # パッケージ変更を分析
        from_packages = {pkg.name.lower(): pkg for pkg in from_snapshot.python_env.key_packages}
        to_packages = {pkg.name.lower(): pkg for pkg in to_snapshot.python_env.key_packages}
        
        added_packages = []
        removed_packages = []
        updated_packages = []
        
        # 追加されたパッケージ
        for pkg_name, pkg_info in to_packages.items():
            if pkg_name not in from_packages:
                added_packages.append(pkg_info)
        
        # 削除されたパッケージ
        for pkg_name in from_packages:
            if pkg_name not in to_packages:
                removed_packages.append(pkg_name)
        
        # 更新されたパッケージ
        for pkg_name, pkg_info in to_packages.items():
            if pkg_name in from_packages and from_packages[pkg_name].version != pkg_info.version:
                updated_packages.append({
                    'name': pkg_name,
                    'old_version': from_packages[pkg_name].version,
                    'new_version': pkg_info.version
                })
        
        return EnvironmentDiff(
            from_snapshot_id=from_snapshot.snapshot_id,
            to_snapshot_id=to_snapshot.snapshot_id,
            diff_created_at=datetime.now(),
            added_packages=added_packages,
            removed_packages=removed_packages,
            updated_packages=updated_packages,
            system_changes={},  # 今後実装
            jupyter_changes={}   # 今後実装
        )


# グローバルインスタンス
environment_collector = EnvironmentCollector()


async def collect_current_environment(
    notebook_path: Optional[str] = None,
    cell_id: Optional[str] = None,
    execution_count: Optional[int] = None
) -> ExecutionEnvironmentSnapshot:
    """
    現在の環境情報を収集する便利関数
    
    Args:
        notebook_path: ノートブックパス
        cell_id: セルID
        execution_count: 実行回数
        
    Returns:
        環境情報スナップショット
    """
    return await environment_collector.collect_environment_snapshot(
        notebook_path=notebook_path,
        cell_id=cell_id,
        execution_count=execution_count
    )


def get_environment_summary() -> Dict[str, Any]:
    """
    環境情報の簡易サマリーを取得する
    
    Returns:
        環境情報サマリー
    """
    return {
        'python_version': f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        'platform': platform.platform(),
        'virtual_env': os.environ.get('VIRTUAL_ENV'),
        'conda_env': os.environ.get('CONDA_DEFAULT_ENV'),
        'has_psutil': psutil is not None,
        'has_pkg_resources': pkg_resources is not None
    }
