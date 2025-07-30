"""
実行環境情報API エンドポイント

JupyterLabセル実行時の環境情報を管理するAPIエンドポイント群。
環境情報の収集、分析、履歴管理機能を提供。
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from core.environment_collector import (
    environment_collector,
    collect_current_environment,
    get_environment_summary,
)
from schemas.environment import (
    ExecutionEnvironmentSnapshot,
    EnvironmentDiff,
    EnvironmentAnalytics,
)

router = APIRouter()


@router.get("/current", status_code=200)
async def get_current_environment():
    """
    現在の実行環境情報を取得する

    JupyterLabの現在の実行環境（Python版数、パッケージ、システム情報）
    を収集して返す。初回アクセス時は完全な情報を収集する。
    """
    try:
        snapshot = await collect_current_environment()

        return {
            "message": "Current environment information collected successfully",
            "snapshot": snapshot.model_dump(),
            "collection_time_ms": snapshot.collection_duration_ms,
            "is_full_snapshot": snapshot.is_full_snapshot,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to collect current environment: {str(e)}"
        )


@router.get("/summary", status_code=200)
async def get_environment_summary_endpoint():
    """
    環境情報の簡易サマリーを取得する

    軽量な環境情報（Python版数、プラットフォーム、仮想環境など）
    を高速で取得する。頻繁なアクセスに適している。
    """
    try:
        summary = get_environment_summary()

        return {
            "message": "Environment summary retrieved successfully",
            "summary": summary,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get environment summary: {str(e)}"
        )


@router.post("/snapshot", status_code=201)
async def create_environment_snapshot(
    notebook_path: Optional[str] = None,
    cell_id: Optional[str] = None,
    execution_count: Optional[int] = None,
    force_full_collection: bool = False,
):
    """
    環境情報スナップショットを作成する

    指定されたコンテキスト（ノートブック、セル）での環境情報を
    収集してスナップショットとして保存する。

    - **notebook_path**: ノートブックパス
    - **cell_id**: セルID
    - **execution_count**: 実行回数
    - **force_full_collection**: 強制的に完全収集を行う
    """
    try:
        snapshot = await environment_collector.collect_environment_snapshot(
            notebook_path=notebook_path,
            cell_id=cell_id,
            execution_count=execution_count,
            force_full_collection=force_full_collection,
        )

        return {
            "message": "Environment snapshot created successfully",
            "snapshot_id": snapshot.snapshot_id,
            "snapshot": snapshot.model_dump(),
            "collection_time_ms": snapshot.collection_duration_ms,
            "changed_packages_count": len(snapshot.changed_packages),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to create environment snapshot: {str(e)}"
        )


@router.get("/packages", status_code=200)
async def get_package_information(
    package_names: Optional[List[str]] = Query(
        None, description="取得するパッケージ名のリスト"
    ),
    include_all: bool = Query(False, description="全パッケージ情報を含める"),
):
    """
    パッケージ情報を取得する

    インストール済みパッケージの詳細情報を取得する。
    特定のパッケージのみ、または全パッケージの情報を取得可能。

    - **package_names**: 取得するパッケージ名のリスト
    - **include_all**: 全パッケージ情報を含める
    """
    try:
        # 現在の環境情報を収集（キャッシュ利用）
        snapshot = await collect_current_environment()

        # パッケージ情報を抽出
        all_packages = snapshot.python_env.key_packages

        if package_names:
            # 指定されたパッケージのみフィルタリング
            package_names_lower = [name.lower() for name in package_names]
            filtered_packages = [
                pkg for pkg in all_packages if pkg.name.lower() in package_names_lower
            ]
            packages_info = filtered_packages
        else:
            packages_info = all_packages

        return {
            "message": "Package information retrieved successfully",
            "packages": [pkg.model_dump() for pkg in packages_info],
            "total_packages_count": snapshot.python_env.total_packages_count,
            "snapshot_id": snapshot.snapshot_id,
            "collected_at": snapshot.captured_at.isoformat(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get package information: {str(e)}"
        )


@router.get("/health", status_code=200)
async def check_environment_health():
    """
    環境健全性をチェックする

    現在の実行環境の健全性を評価し、
    問題や改善提案があれば報告する。
    """
    try:
        snapshot = await collect_current_environment()

        # 健全性チェック
        health_score = _calculate_environment_health_score(snapshot)
        recommendations = _generate_environment_recommendations(snapshot)
        warnings = _detect_environment_warnings(snapshot)

        # 健全性レベルを決定
        if health_score >= 0.9:
            health_level = "excellent"
        elif health_score >= 0.7:
            health_level = "good"
        elif health_score >= 0.5:
            health_level = "warning"
        else:
            health_level = "critical"

        return {
            "message": "Environment health check completed",
            "health_score": health_score,
            "health_level": health_level,
            "recommendations": recommendations,
            "warnings": warnings,
            "snapshot_id": snapshot.snapshot_id,
            "checked_at": datetime.now().isoformat(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to check environment health: {str(e)}"
        )


@router.get("/diff", status_code=200)
async def get_environment_diff(
    from_snapshot_id: Optional[str] = Query(
        None, description="比較元スナップショットID"
    ),
    hours_back: int = Query(24, description="何時間前と比較するか", ge=1, le=168),
):
    """
    環境情報の差分を取得する

    指定されたスナップショット間、または指定時間前との
    環境情報の差分を分析して返す。

    - **from_snapshot_id**: 比較元スナップショットID
    - **hours_back**: 何時間前と比較するか（1-168時間）
    """
    try:
        current_snapshot = await collect_current_environment()

        # 比較対象のスナップショットを取得
        # 注意: 実際の実装では、データベースから過去のスナップショットを取得する
        # ここでは簡易的な実装として、前回のスナップショットとの比較を行う

        if (
            environment_collector._last_snapshot
            and environment_collector._last_snapshot.snapshot_id
            != current_snapshot.snapshot_id
        ):
            diff = environment_collector.create_environment_diff(
                environment_collector._last_snapshot, current_snapshot
            )

            return {
                "message": "Environment diff calculated successfully",
                "diff": diff.model_dump(),
                "from_snapshot_id": diff.from_snapshot_id,
                "to_snapshot_id": diff.to_snapshot_id,
                "changes_detected": (
                    len(diff.added_packages) > 0
                    or len(diff.removed_packages) > 0
                    or len(diff.updated_packages) > 0
                ),
            }
        else:
            return {
                "message": "No previous snapshot available for comparison",
                "current_snapshot_id": current_snapshot.snapshot_id,
                "changes_detected": False,
            }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get environment diff: {str(e)}"
        )


@router.post("/analyze", status_code=200)
async def analyze_environment():
    """
    環境情報を分析する

    現在の環境情報を詳細に分析し、
    パフォーマンス、互換性、セキュリティの観点から
    評価結果と改善提案を返す。
    """
    try:
        snapshot = await collect_current_environment()

        # 環境分析を実行
        analysis = _perform_environment_analysis(snapshot)

        return {
            "message": "Environment analysis completed successfully",
            "analysis": analysis,
            "snapshot_id": snapshot.snapshot_id,
            "analyzed_at": datetime.now().isoformat(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to analyze environment: {str(e)}"
        )


def _calculate_environment_health_score(
    snapshot: ExecutionEnvironmentSnapshot,
) -> float:
    """環境健全性スコアを計算する"""
    score = 1.0

    # Python版数チェック
    python_version = snapshot.python_env.python_version
    major, minor = map(int, python_version.split(".")[:2])

    if major < 3 or (major == 3 and minor < 8):
        score -= 0.3  # 古いPython版数
    elif major == 3 and minor < 10:
        score -= 0.1  # やや古い版数

    # メモリ使用量チェック
    if snapshot.memory_usage_mb and snapshot.memory_usage_mb > 1000:  # 1GB以上
        score -= 0.2

    # CPU使用率チェック
    if snapshot.cpu_usage_percent and snapshot.cpu_usage_percent > 80:
        score -= 0.1

    # パッケージ数チェック（多すぎる場合）
    if snapshot.python_env.total_packages_count > 500:
        score -= 0.1

    return max(0.0, score)


def _generate_environment_recommendations(
    snapshot: ExecutionEnvironmentSnapshot,
) -> List[str]:
    """環境改善の推奨事項を生成する"""
    recommendations = []

    # Python版数の推奨
    python_version = snapshot.python_env.python_version
    major, minor = map(int, python_version.split(".")[:2])

    if major < 3 or (major == 3 and minor < 9):
        recommendations.append(
            f"Consider upgrading Python from {python_version} to 3.10+ for better performance and security"
        )

    # メモリ使用量の推奨
    if snapshot.memory_usage_mb and snapshot.memory_usage_mb > 2000:  # 2GB以上
        recommendations.append(
            "High memory usage detected. Consider optimizing data structures or using memory-efficient libraries"
        )

    # 仮想環境の推奨
    if not snapshot.python_env.virtual_env and not snapshot.python_env.conda_env:
        recommendations.append(
            "Consider using a virtual environment (venv or conda) for better dependency management"
        )

    # パッケージ管理の推奨
    if snapshot.python_env.total_packages_count > 300:
        recommendations.append(
            "Large number of packages detected. Consider creating separate environments for different projects"
        )

    if not recommendations:
        recommendations.append("Environment appears to be well-configured")

    return recommendations


def _detect_environment_warnings(snapshot: ExecutionEnvironmentSnapshot) -> List[str]:
    """環境に関する警告を検出する"""
    warnings = []

    # 重要パッケージの欠落チェック
    package_names = {pkg.name.lower() for pkg in snapshot.python_env.key_packages}

    if "numpy" not in package_names:
        warnings.append(
            "NumPy not detected - many data science operations may not work"
        )

    if "pandas" not in package_names and "numpy" in package_names:
        warnings.append(
            "Pandas not detected - data manipulation capabilities may be limited"
        )

    # システムリソースの警告
    if snapshot.system_env.memory_total_gb and snapshot.system_env.memory_total_gb < 4:
        warnings.append(
            "Low system memory detected (< 4GB) - performance may be limited"
        )

    if snapshot.system_env.disk_free_gb and snapshot.system_env.disk_free_gb < 1:
        warnings.append("Low disk space detected (< 1GB) - consider freeing up space")

    return warnings


def _perform_environment_analysis(
    snapshot: ExecutionEnvironmentSnapshot,
) -> Dict[str, Any]:
    """環境情報の詳細分析を実行する"""

    # パフォーマンス指標
    performance_indicators = {
        "python_version_score": _score_python_version(
            snapshot.python_env.python_version
        ),
        "memory_efficiency": _calculate_memory_efficiency(snapshot),
        "package_optimization": _analyze_package_optimization(snapshot),
    }

    # 互換性情報
    compatibility_info = {
        "python_compatibility": _check_python_compatibility(snapshot),
        "package_conflicts": _detect_package_conflicts(snapshot),
        "jupyter_compatibility": _check_jupyter_compatibility(snapshot),
    }

    return {
        "performance_indicators": performance_indicators,
        "compatibility_info": compatibility_info,
        "overall_score": _calculate_environment_health_score(snapshot),
        "analysis_summary": "Environment analysis completed with detailed metrics",
    }


def _score_python_version(python_version: str) -> float:
    """Python版数のスコアを計算する"""
    try:
        major, minor = map(int, python_version.split(".")[:2])

        if major >= 3 and minor >= 11:
            return 1.0
        elif major >= 3 and minor >= 9:
            return 0.8
        elif major >= 3 and minor >= 8:
            return 0.6
        else:
            return 0.3
    except:
        return 0.5


def _calculate_memory_efficiency(snapshot: ExecutionEnvironmentSnapshot) -> float:
    """メモリ効率を計算する"""
    if not snapshot.memory_usage_mb:
        return 0.5  # 不明

    if snapshot.memory_usage_mb < 100:
        return 1.0
    elif snapshot.memory_usage_mb < 500:
        return 0.8
    elif snapshot.memory_usage_mb < 1000:
        return 0.6
    else:
        return 0.3


def _analyze_package_optimization(snapshot: ExecutionEnvironmentSnapshot) -> float:
    """パッケージ最適化レベルを分析する"""
    total_packages = snapshot.python_env.total_packages_count

    if total_packages < 50:
        return 1.0
    elif total_packages < 150:
        return 0.8
    elif total_packages < 300:
        return 0.6
    else:
        return 0.3


def _check_python_compatibility(
    snapshot: ExecutionEnvironmentSnapshot,
) -> Dict[str, Any]:
    """Python互換性をチェックする"""
    return {
        "version": snapshot.python_env.python_version,
        "implementation": snapshot.python_env.python_implementation,
        "is_supported": True,  # 簡易実装
        "eol_date": None,  # 実際の実装では版数別のEOL日付を返す
    }


def _detect_package_conflicts(snapshot: ExecutionEnvironmentSnapshot) -> List[str]:
    """パッケージ競合を検出する"""
    # 簡易実装 - 実際にはより詳細な競合検出を行う
    conflicts = []

    package_names = {pkg.name.lower() for pkg in snapshot.python_env.key_packages}

    # 既知の競合パターンをチェック
    if "tensorflow" in package_names and "torch" in package_names:
        conflicts.append(
            "TensorFlow and PyTorch both installed - may cause memory issues"
        )

    return conflicts


def _check_jupyter_compatibility(
    snapshot: ExecutionEnvironmentSnapshot,
) -> Dict[str, Any]:
    """Jupyter互換性をチェックする"""
    return {
        "jupyterlab_version": snapshot.jupyter_env.jupyterlab_version,
        "ipython_version": snapshot.jupyter_env.ipython_version,
        "is_compatible": True,  # 簡易実装
        "recommended_versions": {"jupyterlab": ">=3.0.0", "ipython": ">=7.0.0"},
    }
