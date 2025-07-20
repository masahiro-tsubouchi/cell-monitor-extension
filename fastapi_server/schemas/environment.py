"""
実行環境情報スキーマ

JupyterLabセル実行時の環境情報を記録するためのデータモデル。
Python版数、インストール済みパッケージ、システム情報などを含む。
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
from datetime import datetime


class PackageInfo(BaseModel):
    """
    インストール済みパッケージ情報
    """
    name: str = Field(..., description="パッケージ名")
    version: str = Field(..., description="パッケージバージョン")
    location: Optional[str] = Field(None, description="インストール場所")


class PythonEnvironmentInfo(BaseModel):
    """
    Python実行環境情報
    """
    python_version: str = Field(..., description="Python版数 (例: 3.9.7)")
    python_implementation: str = Field(..., description="Python実装 (例: CPython)")
    python_executable: str = Field(..., description="Python実行ファイルパス")
    virtual_env: Optional[str] = Field(None, description="仮想環境名・パス")
    conda_env: Optional[str] = Field(None, description="Conda環境名")
    pip_version: Optional[str] = Field(None, description="pipバージョン")
    
    # 重要パッケージの情報
    key_packages: List[PackageInfo] = Field(
        default_factory=list,
        description="重要パッケージ情報 (numpy, pandas, matplotlib等)"
    )
    
    # 全パッケージ数（詳細は別途記録）
    total_packages_count: int = Field(0, description="インストール済み総パッケージ数")


class SystemEnvironmentInfo(BaseModel):
    """
    システム環境情報
    """
    os_name: str = Field(..., description="OS名 (例: Darwin)")
    os_version: str = Field(..., description="OSバージョン")
    platform: str = Field(..., description="プラットフォーム (例: darwin)")
    architecture: str = Field(..., description="アーキテクチャ (例: x86_64)")
    hostname: Optional[str] = Field(None, description="ホスト名")
    
    # リソース情報
    cpu_count: Optional[int] = Field(None, description="CPU数")
    memory_total_gb: Optional[float] = Field(None, description="総メモリ容量(GB)")
    disk_free_gb: Optional[float] = Field(None, description="空きディスク容量(GB)")


class JupyterEnvironmentInfo(BaseModel):
    """
    JupyterLab環境情報
    """
    jupyterlab_version: Optional[str] = Field(None, description="JupyterLabバージョン")
    jupyter_core_version: Optional[str] = Field(None, description="Jupyter Coreバージョン")
    ipython_version: Optional[str] = Field(None, description="IPythonバージョン")
    kernel_name: Optional[str] = Field(None, description="カーネル名")
    kernel_id: Optional[str] = Field(None, description="カーネルID")
    
    # 拡張機能情報
    extensions: List[Dict[str, str]] = Field(
        default_factory=list,
        description="インストール済み拡張機能リスト"
    )


class ExecutionEnvironmentSnapshot(BaseModel):
    """
    セル実行時の環境情報スナップショット
    
    セル実行毎に収集される環境情報の完全なスナップショット。
    初回実行時は全情報を収集し、以降は差分のみを記録する。
    """
    snapshot_id: str = Field(..., description="スナップショットID")
    captured_at: datetime = Field(..., description="情報取得日時")
    
    # 環境情報
    python_env: PythonEnvironmentInfo
    system_env: SystemEnvironmentInfo
    jupyter_env: JupyterEnvironmentInfo
    
    # 実行コンテキスト
    notebook_path: Optional[str] = Field(None, description="ノートブックパス")
    cell_id: Optional[str] = Field(None, description="セルID")
    execution_count: Optional[int] = Field(None, description="実行回数")
    
    # パフォーマンス情報
    memory_usage_mb: Optional[float] = Field(None, description="メモリ使用量(MB)")
    cpu_usage_percent: Optional[float] = Field(None, description="CPU使用率(%)")
    
    # 変更検出フラグ
    is_full_snapshot: bool = Field(True, description="完全スナップショットかどうか")
    changed_packages: List[str] = Field(
        default_factory=list,
        description="前回から変更されたパッケージ名"
    )
    
    # メタデータ
    collection_duration_ms: Optional[float] = Field(
        None, 
        description="環境情報収集にかかった時間(ms)"
    )


class EnvironmentDiff(BaseModel):
    """
    環境情報の差分
    
    前回のスナップショットとの差分を記録する。
    パッケージの追加・削除・更新などを追跡。
    """
    from_snapshot_id: str = Field(..., description="比較元スナップショットID")
    to_snapshot_id: str = Field(..., description="比較先スナップショットID")
    diff_created_at: datetime = Field(..., description="差分作成日時")
    
    # パッケージ変更
    added_packages: List[PackageInfo] = Field(
        default_factory=list,
        description="追加されたパッケージ"
    )
    removed_packages: List[str] = Field(
        default_factory=list,
        description="削除されたパッケージ名"
    )
    updated_packages: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="更新されたパッケージ (old_version, new_version含む)"
    )
    
    # システム変更
    system_changes: Dict[str, Any] = Field(
        default_factory=dict,
        description="システム環境の変更"
    )
    
    # Jupyter環境変更
    jupyter_changes: Dict[str, Any] = Field(
        default_factory=dict,
        description="Jupyter環境の変更"
    )


class EnvironmentAnalytics(BaseModel):
    """
    環境情報分析結果
    
    収集された環境情報から導出される分析結果。
    学習効率や問題の可能性を示唆する指標。
    """
    analysis_id: str = Field(..., description="分析ID")
    analyzed_at: datetime = Field(..., description="分析実行日時")
    snapshot_id: str = Field(..., description="分析対象スナップショットID")
    
    # 環境健全性スコア
    environment_health_score: float = Field(
        ..., 
        ge=0.0, 
        le=1.0,
        description="環境健全性スコア (0.0-1.0)"
    )
    
    # 推奨事項
    recommendations: List[str] = Field(
        default_factory=list,
        description="環境改善の推奨事項"
    )
    
    # 警告・注意事項
    warnings: List[str] = Field(
        default_factory=list,
        description="環境に関する警告"
    )
    
    # パフォーマンス指標
    performance_indicators: Dict[str, Any] = Field(
        default_factory=dict,
        description="パフォーマンス関連指標"
    )
    
    # 互換性情報
    compatibility_info: Dict[str, Any] = Field(
        default_factory=dict,
        description="パッケージ間の互換性情報"
    )
