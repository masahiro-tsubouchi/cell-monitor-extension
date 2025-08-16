/**
 * API Dashboard Repository Implementation
 * ダッシュボードデータの永続化・取得の具体実装
 */

import axios, { AxiosInstance } from 'axios';
import { 
  DashboardMetrics, 
  DashboardMetricsBuilder, 
  ActivityTimePoint, 
  createActivityTimePoint 
} from '../../domain/entities/Metrics';
import { Team, TeamBuilder, createTeamName } from '../../domain/entities/Team';
import { 
  DashboardRepository, 
  DashboardOverview,
  EnhancedDashboardRepository 
} from '../../domain/repositories/DashboardRepository';
import { RepositoryResult, RepositoryError } from '../../domain/repositories/StudentRepository';

// API Response型定義
interface APIDashboardMetrics {
  totalStudents: number;
  totalActive: number;
  errorCount: number;
  totalExecutions: number;
  helpCount: number;
  lastUpdated?: string;
}

interface APIActivityTimePoint {
  time: string;
  executionCount: number;
  errorCount: number;
  helpCount: number;
}

interface APIDashboardOverview {
  students: any[];
  metrics: APIDashboardMetrics;
  activityChart: APIActivityTimePoint[];
}

/**
 * APIDashboardRepository
 * 既存のAPIとの互換性を維持しながらDomain層と連携
 */
export class APIDashboardRepository implements EnhancedDashboardRepository {
  private metricsCache: { data: DashboardMetrics; timestamp: number } | null = null;
  private teamsCache: { data: Team[]; timestamp: number } | null = null;
  private metricsSubscriptions: Set<(metrics: DashboardMetrics) => void> = new Set();
  private teamSubscriptions: Set<(teams: Team[]) => void> = new Set();

  constructor(
    private readonly apiClient: AxiosInstance,
    private readonly cacheMaxAge: number = 30000 // 30秒
  ) {}

  async getMetrics(): Promise<RepositoryResult<DashboardMetrics>> {
    try {
      // キャッシュチェック
      if (this.metricsCache && this.isCacheValid(this.metricsCache.timestamp)) {
        return {
          success: true,
          data: this.metricsCache.data
        };
      }

      const response = await this.apiClient.get<APIDashboardOverview>('/dashboard/overview');
      
      if (!response.data?.metrics) {
        return {
          success: false,
          error: new RepositoryError(
            'Invalid metrics response structure',
            'INVALID_METRICS_RESPONSE'
          )
        };
      }

      const metrics = this.transformAPIMetricsToEntity(response.data.metrics);
      this.updateMetricsCache(metrics);
      this.notifyMetricsSubscribers(metrics);

      return {
        success: true,
        data: metrics
      };
    } catch (error) {
      return {
        success: false,
        error: new RepositoryError(
          'Failed to fetch dashboard metrics',
          'FETCH_METRICS_FAILED',
          error as Error
        )
      };
    }
  }

  async updateMetrics(metrics: DashboardMetrics): Promise<RepositoryResult<void>> {
    try {
      // 現在のAPIには更新エンドポイントがないため、キャッシュのみ更新
      this.updateMetricsCache(metrics);
      this.notifyMetricsSubscribers(metrics);

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      return {
        success: false,
        error: new RepositoryError(
          'Failed to update metrics',
          'UPDATE_METRICS_FAILED',
          error as Error
        )
      };
    }
  }

  async getTeams(): Promise<RepositoryResult<Team[]>> {
    try {
      // キャッシュチェック
      if (this.teamsCache && this.isCacheValid(this.teamsCache.timestamp)) {
        return {
          success: true,
          data: this.teamsCache.data
        };
      }

      const response = await this.apiClient.get<APIDashboardOverview>('/dashboard/overview');
      
      if (!response.data?.students) {
        return {
          success: false,
          error: new RepositoryError(
            'Invalid students response structure',
            'INVALID_STUDENTS_RESPONSE'
          )
        };
      }

      const teams = this.transformAPIStudentsToTeams(response.data.students);
      this.updateTeamsCache(teams);
      this.notifyTeamSubscribers(teams);

      return {
        success: true,
        data: teams
      };
    } catch (error) {
      return {
        success: false,
        error: new RepositoryError(
          'Failed to fetch teams',
          'FETCH_TEAMS_FAILED',
          error as Error
        )
      };
    }
  }

  async getTeamById(teamId: string): Promise<RepositoryResult<Team | null>> {
    try {
      const teamsResult = await this.getTeams();
      if (!teamsResult.success) {
        return teamsResult as RepositoryResult<Team | null>;
      }

      const team = teamsResult.data.find(t => t.id === teamId) || null;
      return {
        success: true,
        data: team
      };
    } catch (error) {
      return {
        success: false,
        error: new RepositoryError(
          `Failed to fetch team: ${teamId}`,
          'FETCH_TEAM_FAILED',
          error as Error
        )
      };
    }
  }

  async updateTeam(team: Team): Promise<RepositoryResult<void>> {
    try {
      // 現在のAPIには個別更新エンドポイントがないため、キャッシュのみ更新
      this.updateTeamInCache(team);

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      return {
        success: false,
        error: new RepositoryError(
          `Failed to update team: ${team.id}`,
          'UPDATE_TEAM_FAILED',
          error as Error
        )
      };
    }
  }

  async getActivityHistory(hours: number): Promise<RepositoryResult<ActivityTimePoint[]>> {
    try {
      const response = await this.apiClient.get<APIDashboardOverview>('/dashboard/overview');
      
      if (!response.data?.activityChart) {
        return {
          success: false,
          error: new RepositoryError(
            'Invalid activity chart response structure',
            'INVALID_ACTIVITY_RESPONSE'
          )
        };
      }

      const activityPoints = this.transformAPIActivityChart(response.data.activityChart, hours);

      return {
        success: true,
        data: activityPoints
      };
    } catch (error) {
      return {
        success: false,
        error: new RepositoryError(
          'Failed to fetch activity history',
          'FETCH_ACTIVITY_FAILED',
          error as Error
        )
      };
    }
  }

  async addActivityPoint(point: ActivityTimePoint): Promise<RepositoryResult<void>> {
    try {
      // 現在のAPIには追加エンドポイントがないため、将来的に実装
      // 今はローカル処理のみ
      console.log('Activity point added (local only):', point);

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      return {
        success: false,
        error: new RepositoryError(
          'Failed to add activity point',
          'ADD_ACTIVITY_FAILED',
          error as Error
        )
      };
    }
  }

  // Legacy interface support
  async getMetrics_legacy(): Promise<DashboardMetrics> {
    const result = await this.getMetrics();
    if (!result.success) {
      throw result.error;
    }
    return result.data;
  }

  async updateMetrics_legacy(metrics: DashboardMetrics): Promise<void> {
    const result = await this.updateMetrics(metrics);
    if (!result.success) {
      throw result.error;
    }
  }

  async getTeams_legacy(): Promise<Team[]> {
    const result = await this.getTeams();
    if (!result.success) {
      throw result.error;
    }
    return result.data;
  }

  async getTeamById_legacy(teamId: string): Promise<Team | null> {
    const result = await this.getTeamById(teamId);
    if (!result.success) {
      throw result.error;
    }
    return result.data;
  }

  async updateTeam_legacy(team: Team): Promise<void> {
    const result = await this.updateTeam(team);
    if (!result.success) {
      throw result.error;
    }
  }

  async getActivityHistory_legacy(hours: number): Promise<ActivityTimePoint[]> {
    const result = await this.getActivityHistory(hours);
    if (!result.success) {
      throw result.error;
    }
    return result.data;
  }

  async addActivityPoint_legacy(point: ActivityTimePoint): Promise<void> {
    const result = await this.addActivityPoint(point);
    if (!result.success) {
      throw result.error;
    }
  }

  subscribeToMetricsUpdates(callback: (metrics: DashboardMetrics) => void): () => void {
    this.metricsSubscriptions.add(callback);
    return () => {
      this.metricsSubscriptions.delete(callback);
    };
  }

  subscribeToTeamUpdates(callback: (teams: Team[]) => void): () => void {
    this.teamSubscriptions.add(callback);
    return () => {
      this.teamSubscriptions.delete(callback);
    };
  }

  // Private helper methods
  private transformAPIMetricsToEntity(apiMetrics: APIDashboardMetrics): DashboardMetrics {
    return new DashboardMetricsBuilder()
      .setTotalStudents(apiMetrics.totalStudents)
      .setTotalActive(apiMetrics.totalActive)
      .setTotalIdle(apiMetrics.totalStudents - apiMetrics.totalActive)
      .setErrorCount(apiMetrics.errorCount)
      .setTotalExecutions(apiMetrics.totalExecutions)
      .setHelpCount(apiMetrics.helpCount)
      .setLastUpdated(apiMetrics.lastUpdated ? new Date(apiMetrics.lastUpdated) : new Date())
      .build();
  }

  private transformAPIStudentsToTeams(apiStudents: any[]): Team[] {
    // 学生をチーム別にグループ化
    const teamMap = new Map<string, any[]>();
    
    apiStudents.forEach(student => {
      const teamName = createTeamName(student.teamName);
      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, []);
      }
      teamMap.get(teamName)!.push(student);
    });

    // チームエンティティを構築
    return Array.from(teamMap.entries()).map(([teamName, teamStudents]) => {
      // 簡略化: 実際のStudentエンティティの代わりに基本データを使用
      const lastActivity = this.getLatestActivityFromStudents(teamStudents);
      
      return new TeamBuilder()
        .setId(teamName as any)
        .setName(teamName)
        .setStudents([]) // 現在は空配列、実際の実装では変換が必要
        .setLastActivity(lastActivity)
        .build();
    });
  }

  private transformAPIActivityChart(apiChart: APIActivityTimePoint[], hours: number): ActivityTimePoint[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return apiChart
      .map(point => {
        try {
          return createActivityTimePoint(
            new Date(point.time),
            point.executionCount,
            point.errorCount,
            point.helpCount
          );
        } catch (error) {
          console.warn('Invalid activity point:', point, error);
          return null;
        }
      })
      .filter((point): point is ActivityTimePoint => point !== null)
      .filter(point => point.time >= cutoff);
  }

  private getLatestActivityFromStudents(students: any[]): Date {
    if (students.length === 0) return new Date();
    
    // 学生の最新活動時刻を取得（簡略化）
    return new Date(); // 実際の実装では学生データから算出
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheMaxAge;
  }

  private updateMetricsCache(metrics: DashboardMetrics): void {
    this.metricsCache = {
      data: metrics,
      timestamp: Date.now()
    };
  }

  private updateTeamsCache(teams: Team[]): void {
    this.teamsCache = {
      data: teams,
      timestamp: Date.now()
    };
  }

  private updateTeamInCache(updatedTeam: Team): void {
    if (this.teamsCache) {
      const updatedTeams = this.teamsCache.data.map(team => 
        team.equals(updatedTeam) ? updatedTeam : team
      );
      this.updateTeamsCache(updatedTeams);
      this.notifyTeamSubscribers(updatedTeams);
    }
  }

  private notifyMetricsSubscribers(metrics: DashboardMetrics): void {
    this.metricsSubscriptions.forEach(callback => {
      try {
        callback(metrics);
      } catch (error) {
        console.error('Error in metrics subscription:', error);
      }
    });
  }

  private notifyTeamSubscribers(teams: Team[]): void {
    this.teamSubscriptions.forEach(callback => {
      try {
        callback(teams);
      } catch (error) {
        console.error('Error in team subscription:', error);
      }
    });
  }
}

/**
 * Factory function for dependency injection
 */
export const createAPIDashboardRepository = (
  apiBaseUrl: string,
  cacheMaxAge: number = 30000,
  timeout: number = 10000
): APIDashboardRepository => {
  const apiClient = axios.create({
    baseURL: apiBaseUrl,
    timeout,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // エラーインターセプター
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      console.error('Dashboard API Error:', error);
      return Promise.reject(error);
    }
  );

  return new APIDashboardRepository(apiClient, cacheMaxAge);
};