"""
リアルタイム進捗表示スキーマ

課題進捗率のライブ更新、学習状況の可視化、
リアルタイム通知のためのデータモデル定義。
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
from datetime import datetime
from enum import Enum


class ProgressStatus(str, Enum):
    """進捗ステータス"""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SUBMITTED = "submitted"
    REVIEWED = "reviewed"
    FAILED = "failed"


class CellExecutionStatus(str, Enum):
    """セル実行ステータス"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    ERROR = "error"
    CANCELLED = "cancelled"


class NotificationLevel(str, Enum):
    """通知レベル"""
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"


class CellProgressInfo(BaseModel):
    """
    セル単位の進捗情報
    """
    cell_id: str = Field(..., description="セルID")
    cell_index: int = Field(..., description="セル番号")
    cell_type: str = Field(..., description="セルタイプ (code/markdown)")
    
    # 実行状況
    execution_status: CellExecutionStatus = Field(
        CellExecutionStatus.PENDING, 
        description="実行ステータス"
    )
    execution_count: Optional[int] = Field(None, description="実行回数")
    last_executed_at: Optional[datetime] = Field(None, description="最終実行日時")
    execution_duration_ms: Optional[float] = Field(None, description="実行時間(ms)")
    
    # エラー情報
    has_error: bool = Field(False, description="エラーの有無")
    error_message: Optional[str] = Field(None, description="エラーメッセージ")
    error_type: Optional[str] = Field(None, description="エラータイプ")
    
    # 完了状況
    is_completed: bool = Field(False, description="完了フラグ")
    completion_score: Optional[float] = Field(
        None, 
        ge=0.0, 
        le=1.0, 
        description="完了度スコア (0.0-1.0)"
    )
    
    # メタデータ
    code_length: Optional[int] = Field(None, description="コード行数")
    output_length: Optional[int] = Field(None, description="出力文字数")
    memory_usage_mb: Optional[float] = Field(None, description="メモリ使用量(MB)")


class AssignmentProgressInfo(BaseModel):
    """
    課題単位の進捗情報
    """
    assignment_id: str = Field(..., description="課題ID")
    assignment_name: str = Field(..., description="課題名")
    notebook_path: str = Field(..., description="ノートブックパス")
    
    # 全体進捗
    overall_status: ProgressStatus = Field(
        ProgressStatus.NOT_STARTED, 
        description="全体ステータス"
    )
    progress_percentage: float = Field(
        0.0, 
        ge=0.0, 
        le=100.0, 
        description="進捗率 (%)"
    )
    
    # セル別進捗
    total_cells: int = Field(0, description="総セル数")
    completed_cells: int = Field(0, description="完了セル数")
    error_cells: int = Field(0, description="エラーセル数")
    cells_progress: List[CellProgressInfo] = Field(
        default_factory=list, 
        description="セル別進捗詳細"
    )
    
    # 時間情報
    started_at: Optional[datetime] = Field(None, description="開始日時")
    last_updated_at: datetime = Field(..., description="最終更新日時")
    estimated_completion_time: Optional[datetime] = Field(
        None, 
        description="完了予想日時"
    )
    total_execution_time_ms: float = Field(0.0, description="総実行時間(ms)")
    
    # 提出情報
    submission_id: Optional[str] = Field(None, description="提出ID")
    submitted_at: Optional[datetime] = Field(None, description="提出日時")
    is_submitted: bool = Field(False, description="提出済みフラグ")
    
    # 分析情報
    difficulty_score: Optional[float] = Field(
        None, 
        ge=0.0, 
        le=1.0, 
        description="難易度スコア (0.0-1.0)"
    )
    engagement_score: Optional[float] = Field(
        None, 
        ge=0.0, 
        le=1.0, 
        description="取り組み度スコア (0.0-1.0)"
    )


class StudentProgressSummary(BaseModel):
    """
    学生の進捗サマリー
    """
    user_id: str = Field(..., description="学生ID")
    user_name: str = Field(..., description="学生名")
    session_id: Optional[str] = Field(None, description="セッションID")
    
    # 全体統計
    total_assignments: int = Field(0, description="総課題数")
    completed_assignments: int = Field(0, description="完了課題数")
    in_progress_assignments: int = Field(0, description="進行中課題数")
    overall_progress_percentage: float = Field(
        0.0, 
        ge=0.0, 
        le=100.0, 
        description="全体進捗率 (%)"
    )
    
    # 課題別進捗
    assignments_progress: List[AssignmentProgressInfo] = Field(
        default_factory=list, 
        description="課題別進捗詳細"
    )
    
    # 活動統計
    total_execution_count: int = Field(0, description="総実行回数")
    total_execution_time_ms: float = Field(0.0, description="総実行時間(ms)")
    average_execution_time_ms: float = Field(0.0, description="平均実行時間(ms)")
    error_rate: float = Field(
        0.0, 
        ge=0.0, 
        le=1.0, 
        description="エラー率 (0.0-1.0)"
    )
    
    # 時間情報
    first_activity_at: Optional[datetime] = Field(None, description="初回活動日時")
    last_activity_at: Optional[datetime] = Field(None, description="最終活動日時")
    active_time_minutes: float = Field(0.0, description="アクティブ時間(分)")
    
    # 学習分析
    learning_velocity: Optional[float] = Field(
        None, 
        description="学習速度 (課題完了数/時間)"
    )
    focus_score: Optional[float] = Field(
        None, 
        ge=0.0, 
        le=1.0, 
        description="集中度スコア (0.0-1.0)"
    )
    consistency_score: Optional[float] = Field(
        None, 
        ge=0.0, 
        le=1.0, 
        description="継続性スコア (0.0-1.0)"
    )


class ProgressUpdateEvent(BaseModel):
    """
    進捗更新イベント
    
    WebSocketを通じてリアルタイムで送信される進捗更新情報。
    """
    event_id: str = Field(..., description="イベントID")
    event_type: str = Field(..., description="イベントタイプ")
    timestamp: datetime = Field(..., description="イベント発生日時")
    
    # 対象情報
    user_id: str = Field(..., description="学生ID")
    assignment_id: Optional[str] = Field(None, description="課題ID")
    cell_id: Optional[str] = Field(None, description="セルID")
    
    # 更新内容
    update_type: str = Field(..., description="更新タイプ")
    previous_value: Optional[Any] = Field(None, description="更新前の値")
    new_value: Any = Field(..., description="更新後の値")
    
    # 進捗情報
    progress_info: Optional[Dict[str, Any]] = Field(
        None, 
        description="関連する進捗情報"
    )
    
    # メタデータ
    metadata: Dict[str, Any] = Field(
        default_factory=dict, 
        description="追加メタデータ"
    )


class ProgressNotification(BaseModel):
    """
    進捗通知
    
    学生や講師に送信される進捗関連の通知。
    """
    notification_id: str = Field(..., description="通知ID")
    recipient_id: str = Field(..., description="受信者ID")
    recipient_type: str = Field(..., description="受信者タイプ (student/instructor)")
    
    # 通知内容
    title: str = Field(..., description="通知タイトル")
    message: str = Field(..., description="通知メッセージ")
    level: NotificationLevel = Field(
        NotificationLevel.INFO, 
        description="通知レベル"
    )
    
    # 関連情報
    assignment_id: Optional[str] = Field(None, description="関連課題ID")
    user_id: Optional[str] = Field(None, description="関連学生ID")
    
    # 通知制御
    is_read: bool = Field(False, description="既読フラグ")
    created_at: datetime = Field(..., description="作成日時")
    expires_at: Optional[datetime] = Field(None, description="有効期限")
    
    # アクション
    action_url: Optional[str] = Field(None, description="アクションURL")
    action_label: Optional[str] = Field(None, description="アクションラベル")


class ProgressAnalytics(BaseModel):
    """
    進捗分析結果
    
    学習パターンの分析、予測、推奨事項を含む。
    """
    analysis_id: str = Field(..., description="分析ID")
    analyzed_at: datetime = Field(..., description="分析実行日時")
    user_id: str = Field(..., description="対象学生ID")
    
    # 分析期間
    analysis_period_start: datetime = Field(..., description="分析期間開始")
    analysis_period_end: datetime = Field(..., description="分析期間終了")
    
    # パフォーマンス指標
    performance_metrics: Dict[str, float] = Field(
        default_factory=dict, 
        description="パフォーマンス指標"
    )
    
    # 学習パターン
    learning_patterns: Dict[str, Any] = Field(
        default_factory=dict, 
        description="学習パターン分析結果"
    )
    
    # 予測情報
    predictions: Dict[str, Any] = Field(
        default_factory=dict, 
        description="完了時間・成績予測等"
    )
    
    # 推奨事項
    recommendations: List[str] = Field(
        default_factory=list, 
        description="学習改善の推奨事項"
    )
    
    # 比較情報
    peer_comparison: Optional[Dict[str, Any]] = Field(
        None, 
        description="同級生との比較情報"
    )
    
    # 信頼度
    confidence_score: float = Field(
        0.0, 
        ge=0.0, 
        le=1.0, 
        description="分析結果の信頼度 (0.0-1.0)"
    )


class RealtimeProgressConfig(BaseModel):
    """
    リアルタイム進捗表示設定
    """
    user_id: str = Field(..., description="設定対象ユーザーID")
    
    # 更新頻度設定
    update_interval_seconds: int = Field(
        5, 
        ge=1, 
        le=300, 
        description="更新間隔(秒)"
    )
    
    # 通知設定
    enable_notifications: bool = Field(True, description="通知有効フラグ")
    notification_levels: List[NotificationLevel] = Field(
        default_factory=lambda: [NotificationLevel.SUCCESS, NotificationLevel.ERROR],
        description="受信する通知レベル"
    )
    
    # 表示設定
    show_cell_details: bool = Field(True, description="セル詳細表示フラグ")
    show_performance_metrics: bool = Field(True, description="パフォーマンス指標表示フラグ")
    show_predictions: bool = Field(False, description="予測情報表示フラグ")
    
    # フィルタ設定
    assignment_filters: List[str] = Field(
        default_factory=list, 
        description="表示対象課題IDリスト"
    )
    
    # 自動更新設定
    auto_refresh_enabled: bool = Field(True, description="自動更新有効フラグ")
    pause_on_error: bool = Field(True, description="エラー時一時停止フラグ")
    
    # 設定メタデータ
    created_at: datetime = Field(..., description="設定作成日時")
    updated_at: datetime = Field(..., description="設定更新日時")
