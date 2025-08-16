/**
 * Dashboard Service
 * Use Caseを組み合わせたビジネスロジックのオーケストレーション
 * Application層のサービス層
 */

import { Student, StudentID } from '../../domain/entities/Student';
import { Team } from '../../domain/entities/Team';
import { DashboardMetrics } from '../../domain/entities/Metrics';
import { FetchStudentsUseCase, FetchStudentsRequest } from '../../domain/use-cases/student/FetchStudentsUseCase';
import { SelectStudentUseCase, SelectStudentRequest } from '../../domain/use-cases/student/SelectStudentUseCase';
import { RefreshDashboardUseCase, RefreshDashboardRequest } from '../../domain/use-cases/dashboard/RefreshDashboardUseCase';
import { DashboardOverview } from '../../domain/repositories/DashboardRepository';
import { RepositoryResult } from '../../domain/repositories/StudentRepository';

export interface DashboardServiceError {
  code: string;
  message: string;
  cause?: Error;
}

export type DashboardServiceResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: DashboardServiceError;
};

export interface DashboardState {
  students: Student[];
  selectedStudent: Student | null;
  metrics: DashboardMetrics | null;
  teams: Team[];
  overview: DashboardOverview | null;
  loading: boolean;
  lastUpdated: Date | null;
  error: DashboardServiceError | null;
}

/**
 * DashboardService
 * Clean ArchitectureのApplication層
 * Use Caseを組み合わせて高レベルなビジネスロジックを実現
 */
export class DashboardService {
  private state: DashboardState = {
    students: [],
    selectedStudent: null,
    metrics: null,
    teams: [],
    overview: null,
    loading: false,
    lastUpdated: null,
    error: null
  };

  private subscribers: Set<(state: DashboardState) => void> = new Set();

  constructor(
    private readonly fetchStudentsUseCase: FetchStudentsUseCase,
    private readonly selectStudentUseCase: SelectStudentUseCase,
    private readonly refreshDashboardUseCase: RefreshDashboardUseCase
  ) {}

  // State Management
  getState(): DashboardState {
    return { ...this.state };
  }

  subscribe(callback: (state: DashboardState) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // High-level Operations
  async initialize(): Promise<DashboardServiceResult<DashboardOverview>> {
    this.updateState({ loading: true, error: null });

    try {
      const result = await this.refreshDashboardUseCase.execute({
        forceRefresh: true,
        includeActivityHistory: true
      });

      if (!result.success) {
        const error = this.mapUseCaseError(result.error);
        this.updateState({ loading: false, error });
        return { success: false, error };
      }

      this.updateState({
        overview: result.data.overview,
        students: result.data.overview.metrics ? [] : [], // メトリクスから学生データを取得する必要があるが、現在は空配列
        metrics: result.data.overview.metrics,
        teams: result.data.overview.teams,
        lastUpdated: new Date(),
        loading: false,
        error: null
      });

      return {
        success: true,
        data: result.data.overview
      };
    } catch (error) {
      const serviceError = {
        code: 'INITIALIZATION_FAILED',
        message: 'Failed to initialize dashboard',
        cause: error as Error
      };
      this.updateState({ loading: false, error: serviceError });
      return { success: false, error: serviceError };
    }
  }

  async refreshData(forceRefresh: boolean = false): Promise<DashboardServiceResult<DashboardOverview>> {
    if (this.state.loading) {
      return {
        success: false,
        error: {
          code: 'ALREADY_LOADING',
          message: 'Dashboard is already being refreshed'
        }
      };
    }

    this.updateState({ loading: true, error: null });

    try {
      // 1. ダッシュボード全体をリフレッシュ
      const refreshResult = await this.refreshDashboardUseCase.execute({
        forceRefresh,
        includeActivityHistory: true
      });

      if (!refreshResult.success) {
        const error = this.mapUseCaseError(refreshResult.error);
        this.updateState({ loading: false, error });
        return { success: false, error };
      }

      // 2. 学生データを個別取得
      const studentsResult = await this.fetchStudentsUseCase.execute({
        forceRefresh,
        includeInactive: true
      });

      if (!studentsResult.success) {
        const error = this.mapUseCaseError(studentsResult.error);
        this.updateState({ loading: false, error });
        return { success: false, error };
      }

      this.updateState({
        overview: refreshResult.data.overview,
        students: studentsResult.data.students,
        metrics: refreshResult.data.overview.metrics,
        teams: refreshResult.data.overview.teams,
        lastUpdated: new Date(),
        loading: false,
        error: null
      });

      return {
        success: true,
        data: refreshResult.data.overview
      };
    } catch (error) {
      const serviceError = {
        code: 'REFRESH_FAILED',
        message: 'Failed to refresh dashboard data',
        cause: error as Error
      };
      this.updateState({ loading: false, error: serviceError });
      return { success: false, error: serviceError };
    }
  }

  async selectStudent(studentId: StudentID, loadDetails: boolean = false): Promise<DashboardServiceResult<Student>> {
    try {
      const result = await this.selectStudentUseCase.execute({
        studentId,
        loadDetails
      });

      if (!result.success) {
        const error = this.mapUseCaseError(result.error);
        this.updateState({ error });
        return { success: false, error };
      }

      this.updateState({
        selectedStudent: result.data.selectedStudent,
        error: null
      });

      return {
        success: true,
        data: result.data.selectedStudent
      };
    } catch (error) {
      const serviceError = {
        code: 'SELECT_STUDENT_FAILED',
        message: 'Failed to select student',
        cause: error as Error
      };
      this.updateState({ error: serviceError });
      return { success: false, error: serviceError };
    }
  }

  clearSelectedStudent(): void {
    this.selectStudentUseCase.clearSelection();
    this.updateState({ selectedStudent: null });
  }

  async filterStudents(filters: {
    teamId?: string;
    status?: string;
    hasErrors?: boolean;
    needsHelp?: boolean;
  }): Promise<DashboardServiceResult<Student[]>> {
    try {
      let filteredStudents = [...this.state.students];

      if (filters.teamId) {
        filteredStudents = filteredStudents.filter(s => s.teamId === filters.teamId);
      }

      if (filters.status) {
        filteredStudents = filteredStudents.filter(s => s.status === filters.status);
      }

      if (filters.hasErrors) {
        filteredStudents = filteredStudents.filter(s => s.hasErrors());
      }

      if (filters.needsHelp) {
        filteredStudents = filteredStudents.filter(s => s.isRequestingHelp());
      }

      return {
        success: true,
        data: filteredStudents
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FILTER_FAILED',
          message: 'Failed to filter students',
          cause: error as Error
        }
      };
    }
  }

  // Analytics and Insights
  getDashboardInsights(): {
    totalStudents: number;
    activePercentage: number;
    errorPercentage: number;
    helpPercentage: number;
    needsAttention: boolean;
    topIssues: string[];
  } {
    const { students, metrics } = this.state;
    
    if (!metrics || students.length === 0) {
      return {
        totalStudents: 0,
        activePercentage: 0,
        errorPercentage: 0,
        helpPercentage: 0,
        needsAttention: false,
        topIssues: []
      };
    }

    const topIssues: string[] = [];
    
    if (metrics.errorCount > 0) {
      topIssues.push(`${metrics.errorCount}人がエラーに遭遇`);
    }
    
    if (metrics.helpCount > 0) {
      topIssues.push(`${metrics.helpCount}人がヘルプを要求`);
    }
    
    const inactiveCount = metrics.totalStudents - metrics.totalActive;
    if (inactiveCount > metrics.totalStudents * 0.5) {
      topIssues.push(`${inactiveCount}人が非アクティブ`);
    }

    return {
      totalStudents: metrics.totalStudents,
      activePercentage: metrics.getActivePercentage(),
      errorPercentage: metrics.getErrorPercentage(),
      helpPercentage: metrics.getHelpPercentage(),
      needsAttention: metrics.needsAttention(),
      topIssues
    };
  }

  // Private methods
  private updateState(updates: Partial<DashboardState>): void {
    this.state = { ...this.state, ...updates };
    this.notifySubscribers();
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback(this.state);
      } catch (error) {
        console.error('Error in dashboard service subscription:', error);
      }
    });
  }

  private mapUseCaseError(error: any): DashboardServiceError {
    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      cause: error.cause
    };
  }
}

/**
 * Factory function for dependency injection
 */
export const createDashboardService = (
  fetchStudentsUseCase: FetchStudentsUseCase,
  selectStudentUseCase: SelectStudentUseCase,
  refreshDashboardUseCase: RefreshDashboardUseCase
): DashboardService => {
  return new DashboardService(
    fetchStudentsUseCase,
    selectStudentUseCase,
    refreshDashboardUseCase
  );
};