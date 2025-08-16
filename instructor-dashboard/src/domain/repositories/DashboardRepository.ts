/**
 * Dashboard Repository Interface
 * ダッシュボードデータの永続化・取得の抽象化
 */

import { DashboardMetrics, ActivityTimePoint } from '../entities/Metrics';
import { Team } from '../entities/Team';
import { RepositoryResult, RepositoryError } from './StudentRepository';

export interface DashboardRepository {
  // メトリクス取得
  getMetrics(): Promise<DashboardMetrics>;
  updateMetrics(metrics: DashboardMetrics): Promise<void>;
  
  // チーム管理
  getTeams(): Promise<Team[]>;
  getTeamById(teamId: string): Promise<Team | null>;
  updateTeam(team: Team): Promise<void>;
  
  // 活動履歴
  getActivityHistory(hours: number): Promise<ActivityTimePoint[]>;
  addActivityPoint(point: ActivityTimePoint): Promise<void>;
  
  // リアルタイム更新
  subscribeToMetricsUpdates(callback: (metrics: DashboardMetrics) => void): () => void;
  subscribeToTeamUpdates(callback: (teams: Team[]) => void): () => void;
}

/**
 * Enhanced Dashboard Repository with Result Type
 */
export interface EnhancedDashboardRepository {
  getMetrics(): Promise<RepositoryResult<DashboardMetrics>>;
  updateMetrics(metrics: DashboardMetrics): Promise<RepositoryResult<void>>;
  getTeams(): Promise<RepositoryResult<Team[]>>;
  getTeamById(teamId: string): Promise<RepositoryResult<Team | null>>;
  updateTeam(team: Team): Promise<RepositoryResult<void>>;
  getActivityHistory(hours: number): Promise<RepositoryResult<ActivityTimePoint[]>>;
  addActivityPoint(point: ActivityTimePoint): Promise<RepositoryResult<void>>;
}

/**
 * Dashboard Overview aggregated data
 */
export interface DashboardOverview {
  readonly metrics: DashboardMetrics;
  readonly teams: Team[];
  readonly activityHistory: ActivityTimePoint[];
  readonly lastUpdated: Date;
}

export interface DashboardOverviewRepository {
  getOverview(): Promise<RepositoryResult<DashboardOverview>>;
  refreshOverview(): Promise<RepositoryResult<DashboardOverview>>;
}