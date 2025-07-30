"""
ノートブックバージョン管理マネージャー

Git風の差分管理システム、バージョン履歴、
変更追跡機能を提供するコアモジュール。
"""

import hashlib
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
import logging
from collections import defaultdict
import difflib

from schemas.notebook_version import (
    CellContent,
    CellDiff,
    NotebookSnapshot,
    NotebookVersion,
    NotebookBranch,
    VersionHistory,
    VersionComparison,
    VersionTag,
    VersionAnalytics,
    ChangeType,
    CellType,
    VersionStatus,
)

logger = logging.getLogger(__name__)


class NotebookVersionManager:
    """
    ノートブックバージョン管理マネージャー

    Git風のバージョン管理機能を提供し、
    ノートブックの変更履歴を追跡・管理する。
    """

    def __init__(self):
        # バージョン履歴ストレージ
        self.version_histories: Dict[str, VersionHistory] = (
            {}
        )  # notebook_path -> VersionHistory
        self.versions: Dict[str, NotebookVersion] = {}  # version_id -> NotebookVersion
        self.snapshots: Dict[str, NotebookSnapshot] = (
            {}
        )  # snapshot_id -> NotebookSnapshot
        self.branches: Dict[str, NotebookBranch] = {}  # branch_id -> NotebookBranch
        self.tags: Dict[str, VersionTag] = {}  # tag_id -> VersionTag

        # 分析データ
        self.analytics: Dict[str, VersionAnalytics] = (
            {}
        )  # notebook_path -> VersionAnalytics

        # 設定
        self.max_versions_per_notebook = 100
        self.auto_commit_interval_minutes = 30
        self.diff_context_lines = 3

        # 統計情報
        self.stats = {
            "total_notebooks": 0,
            "total_versions": 0,
            "total_commits": 0,
            "total_branches": 0,
            "last_cleanup": datetime.now(),
        }

    async def create_snapshot(
        self,
        notebook_path: str,
        notebook_content: Dict[str, Any],
        author_id: str,
        author_name: str,
    ) -> NotebookSnapshot:
        """
        ノートブックスナップショットを作成する

        Args:
            notebook_path: ノートブックパス
            notebook_content: ノートブック内容（Jupyter形式）
            author_id: 作成者ID
            author_name: 作成者名

        Returns:
            作成されたスナップショット
        """
        try:
            snapshot_id = self._generate_snapshot_id(notebook_content)

            # セル内容を解析
            cells = []
            for cell_data in notebook_content.get("cells", []):
                cell_content = CellContent(
                    cell_id=cell_data.get("id", str(uuid.uuid4())),
                    cell_type=CellType(cell_data.get("cell_type", "code")),
                    source=cell_data.get("source", []),
                    metadata=cell_data.get("metadata", {}),
                    execution_count=cell_data.get("execution_count"),
                    outputs=cell_data.get("outputs", []),
                )
                cells.append(cell_content)

            # スナップショットを作成
            snapshot = NotebookSnapshot(
                snapshot_id=snapshot_id,
                notebook_path=notebook_path,
                created_at=datetime.now(),
                notebook_metadata=notebook_content.get("metadata", {}),
                kernel_spec=notebook_content.get("metadata", {}).get("kernelspec", {}),
                cells=cells,
            )

            # ストレージに保存
            self.snapshots[snapshot_id] = snapshot

            logger.info(f"Created snapshot {snapshot_id} for {notebook_path}")
            return snapshot

        except Exception as e:
            logger.error(f"Failed to create snapshot for {notebook_path}: {e}")
            raise

    async def commit_version(
        self,
        notebook_path: str,
        snapshot: NotebookSnapshot,
        commit_message: str,
        author_id: str,
        author_name: str,
        branch_name: str = "main",
    ) -> NotebookVersion:
        """
        新しいバージョンをコミットする

        Args:
            notebook_path: ノートブックパス
            snapshot: ノートブックスナップショット
            commit_message: コミットメッセージ
            author_id: 作成者ID
            author_name: 作成者名
            branch_name: ブランチ名

        Returns:
            作成されたバージョン
        """
        try:
            # バージョンIDを生成
            version_id = self._generate_version_id(snapshot, commit_message, author_id)

            # バージョン履歴を取得または作成
            if notebook_path not in self.version_histories:
                await self._initialize_version_history(notebook_path, author_id)

            history = self.version_histories[notebook_path]

            # 現在のブランチを取得
            current_branch = self._get_or_create_branch(
                notebook_path, branch_name, author_id
            )

            # 親バージョンを特定
            parent_version_id = None
            parent_version_number = None
            if current_branch.current_version_id:
                parent_version_id = current_branch.current_version_id
                parent_version = self.versions.get(parent_version_id)
                if parent_version:
                    parent_version_number = parent_version.version_number

            # バージョン番号を生成
            version_number = self._generate_version_number(history, branch_name)

            # 差分を計算
            diffs = []
            if parent_version_id:
                parent_snapshot = self.versions[parent_version_id].snapshot
                diffs = await self._calculate_diffs(parent_snapshot, snapshot)

            # バージョンを作成
            version = NotebookVersion(
                version_id=version_id,
                notebook_path=notebook_path,
                created_at=datetime.now(),
                version_number=version_number,
                status=VersionStatus.COMMITTED,
                commit_message=commit_message,
                author_id=author_id,
                author_name=author_name,
                parent_version_id=parent_version_id,
                parent_version_number=parent_version_number,
                snapshot=snapshot,
                diffs=diffs,
            )

            # ストレージに保存
            self.versions[version_id] = version
            history.versions.append(version)

            # ブランチを更新
            current_branch.current_version_id = version_id
            current_branch.current_version_number = version_number
            current_branch.total_versions += 1
            current_branch.last_commit_at = datetime.now()

            # 履歴を更新
            history.current_version_id = version_id
            history.last_updated_at = datetime.now()

            # 統計を更新
            self.stats["total_versions"] += 1
            self.stats["total_commits"] += 1

            logger.info(
                f"Committed version {version_number} ({version_id}) for {notebook_path}"
            )
            return version

        except Exception as e:
            logger.error(f"Failed to commit version for {notebook_path}: {e}")
            raise

    async def create_branch(
        self,
        notebook_path: str,
        branch_name: str,
        from_version_id: str,
        author_id: str,
        description: Optional[str] = None,
    ) -> NotebookBranch:
        """
        新しいブランチを作成する

        Args:
            notebook_path: ノートブックパス
            branch_name: ブランチ名
            from_version_id: 分岐元バージョンID
            author_id: 作成者ID
            description: ブランチ説明

        Returns:
            作成されたブランチ
        """
        try:
            branch_id = str(uuid.uuid4())

            # 分岐元バージョンを確認
            if from_version_id not in self.versions:
                raise ValueError(f"Source version {from_version_id} not found")

            from_version = self.versions[from_version_id]

            # ブランチを作成
            branch = NotebookBranch(
                branch_id=branch_id,
                branch_name=branch_name,
                notebook_path=notebook_path,
                created_at=datetime.now(),
                created_by=author_id,
                description=description,
                current_version_id=from_version_id,
                current_version_number=from_version.version_number,
                branched_from_version_id=from_version_id,
            )

            # ストレージに保存
            self.branches[branch_id] = branch

            # バージョン履歴に追加
            if notebook_path in self.version_histories:
                self.version_histories[notebook_path].branches.append(branch)

            # 統計を更新
            self.stats["total_branches"] += 1

            logger.info(
                f"Created branch {branch_name} ({branch_id}) for {notebook_path}"
            )
            return branch

        except Exception as e:
            logger.error(
                f"Failed to create branch {branch_name} for {notebook_path}: {e}"
            )
            raise

    async def compare_versions(
        self, from_version_id: str, to_version_id: str
    ) -> VersionComparison:
        """
        2つのバージョンを比較する

        Args:
            from_version_id: 比較元バージョンID
            to_version_id: 比較先バージョンID

        Returns:
            比較結果
        """
        try:
            if (
                from_version_id not in self.versions
                or to_version_id not in self.versions
            ):
                raise ValueError("One or both versions not found")

            from_version = self.versions[from_version_id]
            to_version = self.versions[to_version_id]

            # 差分を計算
            diffs = await self._calculate_diffs(
                from_version.snapshot, to_version.snapshot
            )

            # 変更統計を計算
            summary = {
                "total_changes": len(diffs),
                "cells_added": sum(
                    1 for d in diffs if d.change_type == ChangeType.ADDED
                ),
                "cells_deleted": sum(
                    1 for d in diffs if d.change_type == ChangeType.DELETED
                ),
                "cells_modified": sum(
                    1 for d in diffs if d.change_type == ChangeType.MODIFIED
                ),
                "cells_moved": sum(
                    1 for d in diffs if d.change_type == ChangeType.MOVED
                ),
                "lines_added": sum(d.lines_added for d in diffs),
                "lines_deleted": sum(d.lines_deleted for d in diffs),
                "lines_modified": sum(d.lines_modified for d in diffs),
            }

            # 類似度スコアを計算
            similarity_score = self._calculate_similarity_score(
                from_version.snapshot, to_version.snapshot
            )

            # 変更の重要度を判定
            change_significance = self._assess_change_significance(
                summary, similarity_score
            )

            # 推奨アクションを生成
            recommended_actions = self._generate_comparison_recommendations(
                summary, similarity_score
            )

            comparison = VersionComparison(
                comparison_id=str(uuid.uuid4()),
                compared_at=datetime.now(),
                from_version_id=from_version_id,
                to_version_id=to_version_id,
                from_version_number=from_version.version_number,
                to_version_number=to_version.version_number,
                cell_diffs=diffs,
                summary=summary,
                similarity_score=similarity_score,
                change_significance=change_significance,
                recommended_actions=recommended_actions,
            )

            logger.info(
                f"Compared versions {from_version.version_number} -> {to_version.version_number}"
            )
            return comparison

        except Exception as e:
            logger.error(
                f"Failed to compare versions {from_version_id} -> {to_version_id}: {e}"
            )
            raise

    async def _calculate_diffs(
        self, from_snapshot: NotebookSnapshot, to_snapshot: NotebookSnapshot
    ) -> List[CellDiff]:
        """2つのスナップショット間の差分を計算する"""

        diffs = []

        try:
            # セルをIDでマッピング
            from_cells = {cell.cell_id: cell for cell in from_snapshot.cells}
            to_cells = {cell.cell_id: cell for cell in to_snapshot.cells}

            # 全セルIDを取得
            all_cell_ids = set(from_cells.keys()) | set(to_cells.keys())

            for cell_id in all_cell_ids:
                from_cell = from_cells.get(cell_id)
                to_cell = to_cells.get(cell_id)

                if from_cell and to_cell:
                    # セルが両方に存在する場合：変更チェック
                    if self._cells_are_different(from_cell, to_cell):
                        diff = await self._create_cell_diff(
                            cell_id, ChangeType.MODIFIED, from_cell, to_cell
                        )
                        diffs.append(diff)

                elif from_cell and not to_cell:
                    # セルが削除された場合
                    diff = await self._create_cell_diff(
                        cell_id, ChangeType.DELETED, from_cell, None
                    )
                    diffs.append(diff)

                elif not from_cell and to_cell:
                    # セルが追加された場合
                    diff = await self._create_cell_diff(
                        cell_id, ChangeType.ADDED, None, to_cell
                    )
                    diffs.append(diff)

            # セルの移動を検出
            await self._detect_cell_moves(from_snapshot, to_snapshot, diffs)

            return diffs

        except Exception as e:
            logger.error(f"Failed to calculate diffs: {e}")
            return []

    def _cells_are_different(self, cell1: CellContent, cell2: CellContent) -> bool:
        """2つのセルが異なるかどうかを判定する"""

        # セルタイプが異なる
        if cell1.cell_type != cell2.cell_type:
            return True

        # ソースコードが異なる
        if cell1.source != cell2.source:
            return True

        # メタデータが異なる（重要な項目のみ）
        important_metadata_keys = ["tags", "collapsed", "scrolled"]
        for key in important_metadata_keys:
            if cell1.metadata.get(key) != cell2.metadata.get(key):
                return True

        return False

    async def _create_cell_diff(
        self,
        cell_id: str,
        change_type: ChangeType,
        old_content: Optional[CellContent],
        new_content: Optional[CellContent],
    ) -> CellDiff:
        """セル差分を作成する"""

        diff = CellDiff(
            cell_id=cell_id,
            change_type=change_type,
            old_content=old_content,
            new_content=new_content,
        )

        # 行単位の差分を計算（変更の場合）
        if change_type == ChangeType.MODIFIED and old_content and new_content:
            old_lines = old_content.source
            new_lines = new_content.source

            # difflib を使用して行差分を計算
            differ = difflib.unified_diff(
                old_lines,
                new_lines,
                fromfile=f"cell_{cell_id}_old",
                tofile=f"cell_{cell_id}_new",
                lineterm="",
                n=self.diff_context_lines,
            )

            diff.line_diffs = list(differ)

            # 変更統計を計算
            diff.lines_added = sum(1 for line in new_lines if line not in old_lines)
            diff.lines_deleted = sum(1 for line in old_lines if line not in new_lines)
            diff.lines_modified = min(len(old_lines), len(new_lines)) - max(
                0,
                len(old_lines) + len(new_lines) - diff.lines_added - diff.lines_deleted,
            )

        elif change_type == ChangeType.ADDED and new_content:
            diff.lines_added = len(new_content.source)

        elif change_type == ChangeType.DELETED and old_content:
            diff.lines_deleted = len(old_content.source)

        return diff

    async def _detect_cell_moves(
        self,
        from_snapshot: NotebookSnapshot,
        to_snapshot: NotebookSnapshot,
        diffs: List[CellDiff],
    ) -> None:
        """セルの移動を検出する（簡易実装）"""

        # セルのインデックスマッピングを作成
        from_indices = {cell.cell_id: i for i, cell in enumerate(from_snapshot.cells)}
        to_indices = {cell.cell_id: i for i, cell in enumerate(to_snapshot.cells)}

        # 既存の差分から移動候補を特定
        for diff in diffs:
            if (
                diff.change_type == ChangeType.MODIFIED
                and diff.cell_id in from_indices
                and diff.cell_id in to_indices
            ):

                old_index = from_indices[diff.cell_id]
                new_index = to_indices[diff.cell_id]

                if old_index != new_index:
                    # セルが移動している
                    diff.old_index = old_index
                    diff.new_index = new_index

                    # 内容が同じ場合は移動のみ
                    if (
                        diff.old_content
                        and diff.new_content
                        and diff.old_content.source == diff.new_content.source
                    ):
                        diff.change_type = ChangeType.MOVED

    def _calculate_similarity_score(
        self, from_snapshot: NotebookSnapshot, to_snapshot: NotebookSnapshot
    ) -> float:
        """2つのスナップショット間の類似度スコアを計算する"""

        try:
            # 基本統計の類似度
            total_cells_similarity = 1.0 - abs(
                from_snapshot.total_cells - to_snapshot.total_cells
            ) / max(from_snapshot.total_cells, to_snapshot.total_cells, 1)
            total_lines_similarity = 1.0 - abs(
                from_snapshot.total_lines - to_snapshot.total_lines
            ) / max(from_snapshot.total_lines, to_snapshot.total_lines, 1)

            # セル内容の類似度
            from_cell_sources = [" ".join(cell.source) for cell in from_snapshot.cells]
            to_cell_sources = [" ".join(cell.source) for cell in to_snapshot.cells]

            # 簡易的な文字列類似度計算
            from_text = "\n".join(from_cell_sources)
            to_text = "\n".join(to_cell_sources)

            if not from_text and not to_text:
                content_similarity = 1.0
            elif not from_text or not to_text:
                content_similarity = 0.0
            else:
                # レーベンシュタイン距離ベースの類似度（簡易版）
                max_len = max(len(from_text), len(to_text))
                if max_len == 0:
                    content_similarity = 1.0
                else:
                    # 簡易的な差分計算
                    diff_ratio = difflib.SequenceMatcher(
                        None, from_text, to_text
                    ).ratio()
                    content_similarity = diff_ratio

            # 重み付き平均
            similarity_score = (
                total_cells_similarity * 0.2
                + total_lines_similarity * 0.3
                + content_similarity * 0.5
            )

            return max(0.0, min(1.0, similarity_score))

        except Exception as e:
            logger.warning(f"Failed to calculate similarity score: {e}")
            return 0.5  # デフォルト値

    def _assess_change_significance(
        self, summary: Dict[str, int], similarity_score: float
    ) -> str:
        """変更の重要度を評価する"""

        total_changes = summary.get("total_changes", 0)
        lines_added = summary.get("lines_added", 0)
        lines_deleted = summary.get("lines_deleted", 0)

        # 大きな変更の判定
        if (
            total_changes > 10
            or lines_added > 100
            or lines_deleted > 100
            or similarity_score < 0.3
        ):
            return "breaking"

        # 中程度の変更の判定
        if (
            total_changes > 3
            or lines_added > 20
            or lines_deleted > 20
            or similarity_score < 0.7
        ):
            return "major"

        # 小さな変更
        return "minor"

    def _generate_comparison_recommendations(
        self, summary: Dict[str, int], similarity_score: float
    ) -> List[str]:
        """比較結果に基づく推奨事項を生成する"""

        recommendations = []

        total_changes = summary.get("total_changes", 0)
        lines_added = summary.get("lines_added", 0)
        lines_deleted = summary.get("lines_deleted", 0)

        if total_changes == 0:
            recommendations.append("No changes detected between versions")

        if lines_added > lines_deleted * 2:
            recommendations.append(
                "Significant code expansion detected - consider reviewing for complexity"
            )

        if lines_deleted > lines_added * 2:
            recommendations.append(
                "Significant code reduction detected - verify functionality is preserved"
            )

        if similarity_score < 0.5:
            recommendations.append(
                "Major structural changes detected - thorough testing recommended"
            )

        if total_changes > 20:
            recommendations.append(
                "Many changes detected - consider breaking into smaller commits"
            )

        if not recommendations:
            recommendations.append("Changes appear reasonable and well-structured")

        return recommendations

    def _generate_snapshot_id(self, notebook_content: Dict[str, Any]) -> str:
        """ノートブック内容からスナップショットIDを生成する"""

        # 内容のハッシュを計算
        content_str = json.dumps(notebook_content, sort_keys=True, ensure_ascii=False)
        hash_obj = hashlib.sha256(content_str.encode("utf-8"))
        return hash_obj.hexdigest()[:16]  # 16文字に短縮

    def _generate_version_id(
        self, snapshot: NotebookSnapshot, commit_message: str, author_id: str
    ) -> str:
        """バージョンIDを生成する"""

        # スナップショットID、コミットメッセージ、作成者、タイムスタンプからハッシュを生成
        content = f"{snapshot.snapshot_id}:{commit_message}:{author_id}:{datetime.now().isoformat()}"
        hash_obj = hashlib.sha256(content.encode("utf-8"))
        return hash_obj.hexdigest()[:12]  # 12文字に短縮

    def _generate_version_number(
        self, history: VersionHistory, branch_name: str
    ) -> str:
        """バージョン番号を生成する"""

        # ブランチ別のバージョン数を計算
        branch_versions = [
            v
            for v in history.versions
            if v.version_number.startswith(f"{branch_name}-")
            or (branch_name == "main" and not "-" in v.version_number)
        ]

        next_number = len(branch_versions) + 1

        if branch_name == "main":
            return f"v{next_number}.0.0"
        else:
            return f"{branch_name}-v{next_number}.0.0"

    async def _initialize_version_history(
        self, notebook_path: str, author_id: str
    ) -> None:
        """バージョン履歴を初期化する"""

        # メインブランチを作成
        main_branch = NotebookBranch(
            branch_id=str(uuid.uuid4()),
            branch_name="main",
            notebook_path=notebook_path,
            created_at=datetime.now(),
            created_by=author_id,
            current_version_id="",
            current_version_number="",
        )

        # バージョン履歴を作成
        history = VersionHistory(
            notebook_path=notebook_path,
            created_at=datetime.now(),
            last_updated_at=datetime.now(),
            current_branch_id=main_branch.branch_id,
            current_version_id="",
            branches=[main_branch],
        )

        # ストレージに保存
        self.version_histories[notebook_path] = history
        self.branches[main_branch.branch_id] = main_branch

        # 統計を更新
        self.stats["total_notebooks"] += 1
        self.stats["total_branches"] += 1

    def _get_or_create_branch(
        self, notebook_path: str, branch_name: str, author_id: str
    ) -> NotebookBranch:
        """ブランチを取得または作成する"""

        history = self.version_histories[notebook_path]

        # 既存ブランチを検索
        for branch in history.branches:
            if branch.branch_name == branch_name:
                return branch

        # 新しいブランチを作成
        branch = NotebookBranch(
            branch_id=str(uuid.uuid4()),
            branch_name=branch_name,
            notebook_path=notebook_path,
            created_at=datetime.now(),
            created_by=author_id,
            current_version_id="",
            current_version_number="",
        )

        # ストレージに保存
        history.branches.append(branch)
        self.branches[branch.branch_id] = branch

        # 統計を更新
        self.stats["total_branches"] += 1

        return branch

    # データ取得メソッド
    def get_version_history(self, notebook_path: str) -> Optional[VersionHistory]:
        """バージョン履歴を取得する"""
        return self.version_histories.get(notebook_path)

    def get_version(self, version_id: str) -> Optional[NotebookVersion]:
        """バージョンを取得する"""
        return self.versions.get(version_id)

    def get_snapshot(self, snapshot_id: str) -> Optional[NotebookSnapshot]:
        """スナップショットを取得する"""
        return self.snapshots.get(snapshot_id)

    def get_branch(self, branch_id: str) -> Optional[NotebookBranch]:
        """ブランチを取得する"""
        return self.branches.get(branch_id)

    def get_latest_version(
        self, notebook_path: str, branch_name: str = "main"
    ) -> Optional[NotebookVersion]:
        """最新バージョンを取得する"""

        history = self.version_histories.get(notebook_path)
        if not history:
            return None

        # ブランチを検索
        target_branch = None
        for branch in history.branches:
            if branch.branch_name == branch_name:
                target_branch = branch
                break

        if not target_branch or not target_branch.current_version_id:
            return None

        return self.versions.get(target_branch.current_version_id)

    def get_stats(self) -> Dict[str, Any]:
        """統計情報を取得する"""
        return self.stats.copy()


# グローバルインスタンス
notebook_version_manager = NotebookVersionManager()
