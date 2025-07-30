"""
ノートブックバージョン管理スキーマ

Git風の差分管理システム、バージョン履歴、
変更追跡のためのデータモデル定義。
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any, Union
from datetime import datetime
from enum import Enum


class ChangeType(str, Enum):
    """変更タイプ"""

    ADDED = "added"
    MODIFIED = "modified"
    DELETED = "deleted"
    MOVED = "moved"
    RENAMED = "renamed"


class CellType(str, Enum):
    """セルタイプ"""

    CODE = "code"
    MARKDOWN = "markdown"
    RAW = "raw"


class VersionStatus(str, Enum):
    """バージョンステータス"""

    DRAFT = "draft"
    COMMITTED = "committed"
    TAGGED = "tagged"
    ARCHIVED = "archived"


class CellContent(BaseModel):
    """
    セル内容
    """

    cell_id: str = Field(..., description="セルID")
    cell_type: CellType = Field(..., description="セルタイプ")
    source: List[str] = Field(..., description="セルソースコード（行単位）")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="セルメタデータ")

    # 実行結果（コードセルのみ）
    execution_count: Optional[int] = Field(None, description="実行回数")
    outputs: List[Dict[str, Any]] = Field(default_factory=list, description="実行結果")

    # 統計情報
    line_count: int = Field(0, description="行数")
    character_count: int = Field(0, description="文字数")

    def __init__(self, **data):
        super().__init__(**data)
        # 統計情報を自動計算
        if self.source:
            self.line_count = len(self.source)
            self.character_count = sum(len(line) for line in self.source)


class CellDiff(BaseModel):
    """
    セル差分情報
    """

    cell_id: str = Field(..., description="セルID")
    change_type: ChangeType = Field(..., description="変更タイプ")

    # 変更前後の内容
    old_content: Optional[CellContent] = Field(None, description="変更前の内容")
    new_content: Optional[CellContent] = Field(None, description="変更後の内容")

    # 行単位の差分（コードセルの場合）
    line_diffs: List[Dict[str, Any]] = Field(
        default_factory=list, description="行単位の差分情報"
    )

    # 変更統計
    lines_added: int = Field(0, description="追加行数")
    lines_deleted: int = Field(0, description="削除行数")
    lines_modified: int = Field(0, description="変更行数")

    # 移動情報（セル移動の場合）
    old_index: Optional[int] = Field(None, description="変更前のインデックス")
    new_index: Optional[int] = Field(None, description="変更後のインデックス")


class NotebookSnapshot(BaseModel):
    """
    ノートブックスナップショット

    特定時点でのノートブック全体の状態を記録。
    """

    snapshot_id: str = Field(..., description="スナップショットID")
    notebook_path: str = Field(..., description="ノートブックパス")
    created_at: datetime = Field(..., description="作成日時")

    # ノートブック情報
    notebook_metadata: Dict[str, Any] = Field(
        default_factory=dict, description="ノートブックメタデータ"
    )
    kernel_spec: Dict[str, Any] = Field(
        default_factory=dict, description="カーネル仕様"
    )

    # セル情報
    cells: List[CellContent] = Field(..., description="セル一覧")
    total_cells: int = Field(0, description="総セル数")

    # 統計情報
    total_lines: int = Field(0, description="総行数")
    total_characters: int = Field(0, description="総文字数")
    code_cells_count: int = Field(0, description="コードセル数")
    markdown_cells_count: int = Field(0, description="Markdownセル数")

    # 実行情報
    last_execution_time: Optional[datetime] = Field(None, description="最終実行日時")
    execution_count: int = Field(0, description="総実行回数")

    def __init__(self, **data):
        super().__init__(**data)
        # 統計情報を自動計算
        if self.cells:
            self.total_cells = len(self.cells)
            self.total_lines = sum(cell.line_count for cell in self.cells)
            self.total_characters = sum(cell.character_count for cell in self.cells)
            self.code_cells_count = sum(
                1 for cell in self.cells if cell.cell_type == CellType.CODE
            )
            self.markdown_cells_count = sum(
                1 for cell in self.cells if cell.cell_type == CellType.MARKDOWN
            )


class NotebookVersion(BaseModel):
    """
    ノートブックバージョン

    Git風のコミット情報とスナップショットを組み合わせた
    バージョン管理エントリ。
    """

    version_id: str = Field(..., description="バージョンID（ハッシュ値）")
    notebook_path: str = Field(..., description="ノートブックパス")
    created_at: datetime = Field(..., description="作成日時")

    # バージョン情報
    version_number: str = Field(..., description="バージョン番号 (例: v1.0.0)")
    status: VersionStatus = Field(
        VersionStatus.DRAFT, description="バージョンステータス"
    )

    # コミット情報
    commit_message: str = Field(..., description="コミットメッセージ")
    author_id: str = Field(..., description="作成者ID")
    author_name: str = Field(..., description="作成者名")

    # 親バージョン
    parent_version_id: Optional[str] = Field(None, description="親バージョンID")
    parent_version_number: Optional[str] = Field(None, description="親バージョン番号")

    # スナップショット
    snapshot: NotebookSnapshot = Field(..., description="ノートブックスナップショット")

    # 差分情報（親バージョンとの比較）
    diffs: List[CellDiff] = Field(default_factory=list, description="差分情報")

    # 変更統計
    total_changes: int = Field(0, description="総変更数")
    cells_added: int = Field(0, description="追加セル数")
    cells_deleted: int = Field(0, description="削除セル数")
    cells_modified: int = Field(0, description="変更セル数")
    cells_moved: int = Field(0, description="移動セル数")

    # タグ情報
    tags: List[str] = Field(default_factory=list, description="タグ一覧")

    # メタデータ
    metadata: Dict[str, Any] = Field(default_factory=dict, description="追加メタデータ")

    def __init__(self, **data):
        super().__init__(**data)
        # 変更統計を自動計算
        if self.diffs:
            self.total_changes = len(self.diffs)
            self.cells_added = sum(
                1 for diff in self.diffs if diff.change_type == ChangeType.ADDED
            )
            self.cells_deleted = sum(
                1 for diff in self.diffs if diff.change_type == ChangeType.DELETED
            )
            self.cells_modified = sum(
                1 for diff in self.diffs if diff.change_type == ChangeType.MODIFIED
            )
            self.cells_moved = sum(
                1 for diff in self.diffs if diff.change_type == ChangeType.MOVED
            )


class NotebookBranch(BaseModel):
    """
    ノートブックブランチ

    Git風のブランチ管理機能。
    """

    branch_id: str = Field(..., description="ブランチID")
    branch_name: str = Field(..., description="ブランチ名")
    notebook_path: str = Field(..., description="ノートブックパス")

    # ブランチ情報
    created_at: datetime = Field(..., description="作成日時")
    created_by: str = Field(..., description="作成者ID")
    description: Optional[str] = Field(None, description="ブランチ説明")

    # 現在のバージョン
    current_version_id: str = Field(..., description="現在のバージョンID")
    current_version_number: str = Field(..., description="現在のバージョン番号")

    # 親ブランチ
    parent_branch_id: Optional[str] = Field(None, description="親ブランチID")
    parent_branch_name: Optional[str] = Field(None, description="親ブランチ名")
    branched_from_version_id: Optional[str] = Field(
        None, description="分岐元バージョンID"
    )

    # ブランチ統計
    total_versions: int = Field(0, description="総バージョン数")
    last_commit_at: Optional[datetime] = Field(None, description="最終コミット日時")

    # マージ情報
    is_merged: bool = Field(False, description="マージ済みフラグ")
    merged_at: Optional[datetime] = Field(None, description="マージ日時")
    merged_into_branch_id: Optional[str] = Field(None, description="マージ先ブランチID")

    # メタデータ
    metadata: Dict[str, Any] = Field(default_factory=dict, description="追加メタデータ")


class VersionHistory(BaseModel):
    """
    バージョン履歴

    ノートブックの全バージョン履歴を管理。
    """

    notebook_path: str = Field(..., description="ノートブックパス")
    created_at: datetime = Field(..., description="履歴作成日時")
    last_updated_at: datetime = Field(..., description="最終更新日時")

    # バージョン一覧
    versions: List[NotebookVersion] = Field(
        default_factory=list, description="バージョン一覧"
    )

    # ブランチ一覧
    branches: List[NotebookBranch] = Field(
        default_factory=list, description="ブランチ一覧"
    )

    # 現在の状態
    current_branch_id: str = Field(..., description="現在のブランチID")
    current_version_id: str = Field(..., description="現在のバージョンID")

    # 統計情報
    total_versions: int = Field(0, description="総バージョン数")
    total_branches: int = Field(0, description="総ブランチ数")
    total_commits: int = Field(0, description="総コミット数")

    # 作成者統計
    contributors: List[Dict[str, Any]] = Field(
        default_factory=list, description="貢献者一覧"
    )

    def __init__(self, **data):
        super().__init__(**data)
        # 統計情報を自動計算
        if self.versions:
            self.total_versions = len(self.versions)
            self.total_commits = len(
                [v for v in self.versions if v.status == VersionStatus.COMMITTED]
            )

        if self.branches:
            self.total_branches = len(self.branches)


class VersionComparison(BaseModel):
    """
    バージョン比較結果

    2つのバージョン間の詳細な差分比較結果。
    """

    comparison_id: str = Field(..., description="比較ID")
    compared_at: datetime = Field(..., description="比較実行日時")

    # 比較対象
    from_version_id: str = Field(..., description="比較元バージョンID")
    to_version_id: str = Field(..., description="比較先バージョンID")
    from_version_number: str = Field(..., description="比較元バージョン番号")
    to_version_number: str = Field(..., description="比較先バージョン番号")

    # 差分情報
    cell_diffs: List[CellDiff] = Field(default_factory=list, description="セル差分一覧")

    # 変更統計
    summary: Dict[str, int] = Field(default_factory=dict, description="変更サマリー")

    # 類似度スコア
    similarity_score: float = Field(
        0.0, ge=0.0, le=1.0, description="類似度スコア (0.0-1.0)"
    )

    # 変更の重要度
    change_significance: str = Field(
        "minor", description="変更の重要度 (minor/major/breaking)"
    )

    # 推奨アクション
    recommended_actions: List[str] = Field(
        default_factory=list, description="推奨アクション"
    )


class VersionTag(BaseModel):
    """
    バージョンタグ

    特定バージョンに付けるタグ（リリース、マイルストーン等）。
    """

    tag_id: str = Field(..., description="タグID")
    tag_name: str = Field(..., description="タグ名")
    version_id: str = Field(..., description="対象バージョンID")

    # タグ情報
    created_at: datetime = Field(..., description="作成日時")
    created_by: str = Field(..., description="作成者ID")
    description: Optional[str] = Field(None, description="タグ説明")

    # タグタイプ
    tag_type: str = Field(
        "release", description="タグタイプ (release/milestone/checkpoint)"
    )

    # メタデータ
    metadata: Dict[str, Any] = Field(default_factory=dict, description="追加メタデータ")


class VersionAnalytics(BaseModel):
    """
    バージョン分析結果

    バージョン履歴の分析、開発パターンの抽出。
    """

    analysis_id: str = Field(..., description="分析ID")
    analyzed_at: datetime = Field(..., description="分析実行日時")
    notebook_path: str = Field(..., description="対象ノートブックパス")

    # 分析期間
    analysis_period_start: datetime = Field(..., description="分析期間開始")
    analysis_period_end: datetime = Field(..., description="分析期間終了")

    # 開発パターン
    development_patterns: Dict[str, Any] = Field(
        default_factory=dict, description="開発パターン分析結果"
    )

    # 変更頻度分析
    change_frequency: Dict[str, Any] = Field(
        default_factory=dict, description="変更頻度分析"
    )

    # コード品質指標
    quality_metrics: Dict[str, float] = Field(
        default_factory=dict, description="コード品質指標"
    )

    # 学習進捗指標
    learning_progress: Dict[str, Any] = Field(
        default_factory=dict, description="学習進捗指標"
    )

    # 推奨事項
    recommendations: List[str] = Field(default_factory=list, description="改善推奨事項")

    # 予測情報
    predictions: Dict[str, Any] = Field(default_factory=dict, description="将来予測")
