/**
 * Refresh Dashboard Use Case
 * ダッシュボード全体のリフレッシュ処理
 */

import { Student } from '../../entities/Student';
import { Team, TeamBuilder, createTeamName } from '../../entities/Team';
import { DashboardMetrics, DashboardMetricsBuilder, createActivityTimePoint } from '../../entities/Metrics';
import { StudentRepository } from '../../repositories/StudentRepository';
import { DashboardRepository, DashboardOverview } from '../../repositories/DashboardRepository';
import { RepositoryResult } from '../../repositories/StudentRepository';

export interface RefreshDashboardRequest {
  forceRefresh?: boolean;
  includeActivityHistory?: boolean;
  activityHistoryHours?: number;
}

export interface RefreshDashboardResponse {
  overview: DashboardOverview;
  refreshDuration: number;
  fromCache: boolean;
}

export type RefreshDashboardResult = RepositoryResult<RefreshDashboardResponse>;

/**
 * RefreshDashboardUseCase
 * ダッシュボード全体の統合的なリフレッシュを管理
 */
export class RefreshDashboardUseCase {
  constructor(
    private readonly studentRepository: StudentRepository,
    private readonly dashboardRepository: DashboardRepository
  ) {}

  async execute(request: RefreshDashboardRequest = {}): Promise<RefreshDashboardResult> {
    const startTime = Date.now();
    
    try {
      const {
        forceRefresh = false,
        includeActivityHistory = true,
        activityHistoryHours = 24
      } = request;

      // 1. 学生データを取得
      const students = await this.fetchStudents(forceRefresh);
      
      // 2. チームデータを構築
      const teams = this.buildTeams(students);
      
      // 3. メトリクスを計算
      const metrics = this.calculateMetrics(students, teams);
      
      // 4. 活動履歴を取得（オプション）
      const activityHistory = includeActivityHistory 
        ? await this.dashboardRepository.getActivityHistory(activityHistoryHours)
        : [];

      // 5. ダッシュボード概要を構築
      const overview: DashboardOverview = {
        metrics,
        teams,
        activityHistory,
        lastUpdated: new Date()
      };

      // 6. データを永続化
      await this.persistDashboardData(overview);

      const refreshDuration = Date.now() - startTime;

      return {
        success: true,
        data: {
          overview,
          refreshDuration,
          fromCache: !forceRefresh
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          name: 'RefreshDashboardError',
          message: 'Failed to refresh dashboard',
          code: 'REFRESH_DASHBOARD_FAILED',
          cause: error as Error
        }
      };
    }
  }

  private async fetchStudents(forceRefresh: boolean): Promise<Student[]> {
    if (forceRefresh) {
      return await this.studentRepository.getAll();
    } else {
      // 5分間のキャッシュを使用
      return await this.studentRepository.getStudentsWithCache(5 * 60 * 1000);
    }
  }

  private buildTeams(students: Student[]): Team[] {
    // チーム別にグループ化
    const teamMap = new Map<string, Student[]>();
    
    students.forEach(student => {
      const teamName = createTeamName(student.teamId);
      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, []);
      }
      teamMap.get(teamName)!.push(student);
    });

    // チームエンティティを構築
    return Array.from(teamMap.entries()).map(([teamName, teamStudents]) => {
      return new TeamBuilder()
        .setId(teamName as any) // TeamIDとして使用
        .setName(teamName)
        .setStudents(teamStudents)
        .setLastActivity(this.getLatestActivityDate(teamStudents))
        .build();
    });
  }

  private calculateMetrics(students: Student[], teams: Team[]): DashboardMetrics {
    const totalStudents = students.length;
    const totalActive = students.filter(s => s.isActive()).length;
    const errorCount = students.filter(s => s.hasErrors()).length;
    const helpCount = students.filter(s => s.isRequestingHelp()).length;
    const totalExecutions = students.reduce((sum, s) => sum + s.cellExecutions, 0);

    return new DashboardMetricsBuilder()
      .setTotalStudents(totalStudents)
      .setTotalActive(totalActive)
      .setTotalIdle(totalStudents - totalActive)
      .setErrorCount(errorCount)
      .setHelpCount(helpCount)
      .setTotalExecutions(totalExecutions)
      .setLastUpdated(new Date())
      .build();
  }

  private getLatestActivityDate(students: Student[]): Date {
    if (students.length === 0) return new Date();
    
    return students.reduce((latest, student) => {
      return student.lastActivity > latest ? student.lastActivity : latest;
    }, students[0].lastActivity);
  }

  private async persistDashboardData(overview: DashboardOverview): Promise<void> {
    // メトリクスとチームデータを永続化
    await Promise.all([
      this.dashboardRepository.updateMetrics(overview.metrics),
      ...overview.teams.map(team => this.dashboardRepository.updateTeam(team))
    ]);

    // 現在時点のアクティビティポイントを追加
    const currentActivityPoint = createActivityTimePoint(
      new Date(),
      overview.metrics.totalExecutions,
      overview.metrics.errorCount,
      overview.metrics.helpCount
    );
    
    await this.dashboardRepository.addActivityPoint(currentActivityPoint);
  }
}

/**
 * Factory function
 */
export const createRefreshDashboardUseCase = (
  studentRepository: StudentRepository,
  dashboardRepository: DashboardRepository
): RefreshDashboardUseCase => {
  return new RefreshDashboardUseCase(studentRepository, dashboardRepository);
};