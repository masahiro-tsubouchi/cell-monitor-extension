/**
 * API Student Repository Implementation
 * Infrastructure層のStudent Repositoryの具体実装
 */

import axios, { AxiosInstance } from 'axios';
import { 
  Student, 
  StudentBuilder, 
  StudentID, 
  StudentStatus, 
  StudentHelpStatus,
  createStudentID,
  createEmailAddress,
  createTeamID,
} from '../../domain/entities/Student';
import { 
  StudentRepository, 
  RepositoryError 
} from '../../domain/repositories/StudentRepository';

// API Response型定義（既存のAPIとの互換性維持）
interface APIStudentActivity {
  emailAddress: string;
  userName: string;
  teamName?: string;
  currentNotebook: string;
  lastActivity: string;
  status: 'active' | 'idle' | 'error' | 'help';
  isRequestingHelp?: boolean;
  cellExecutions: number;
  errorCount: number;
}

interface APIDashboardOverview {
  students: APIStudentActivity[];
  metrics: any;
  activityChart: any[];
}

/**
 * APIStudentRepository
 * 既存のdashboardAPIとの互換性を保ちながらDomain層と連携
 */
export class APIStudentRepository implements StudentRepository {
  private cache: Map<string, { data: Student[]; timestamp: number }> = new Map();
  private subscriptions: Set<(students: Student[]) => void> = new Set();

  constructor(
    private readonly apiClient: AxiosInstance
  ) {}

  async getAll(): Promise<Student[]> {
    try {
      const response = await this.apiClient.get<APIDashboardOverview>('/dashboard/overview');
      
      if (!response.data?.students) {
        throw new RepositoryError(
          'Invalid API response structure',
          'INVALID_RESPONSE'
        );
      }

      const students = this.transformAPIStudentsToEntities(response.data.students);
      this.updateCache('all', students);
      this.notifySubscribers(students);
      
      return students;
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        'Failed to fetch all students',
        'FETCH_ALL_FAILED',
        error as Error
      );
    }
  }

  async getById(id: StudentID): Promise<Student | null> {
    try {
      // まずキャッシュから検索
      const cachedStudents = this.getCachedStudents('all');
      if (cachedStudents) {
        const student = cachedStudents.find(s => s.id === id);
        if (student) return student;
      }

      // キャッシュにない場合は全データを取得
      const allStudents = await this.getAll();
      return allStudents.find(s => s.id === id) || null;
    } catch (error) {
      throw new RepositoryError(
        `Failed to fetch student with ID: ${id}`,
        'FETCH_BY_ID_FAILED',
        error as Error
      );
    }
  }

  async getByTeamId(teamId: string): Promise<Student[]> {
    try {
      const allStudents = await this.getAll();
      return allStudents.filter(s => s.teamId === teamId);
    } catch (error) {
      throw new RepositoryError(
        `Failed to fetch students for team: ${teamId}`,
        'FETCH_BY_TEAM_FAILED',
        error as Error
      );
    }
  }

  async update(student: Student): Promise<void> {
    try {
      // 現在のAPIには個別更新エンドポイントがないため、
      // キャッシュのみ更新（実際の更新はWebSocketまたは次回fetch時に反映）
      this.updateStudentInCache(student);
    } catch (error) {
      throw new RepositoryError(
        `Failed to update student: ${student.id}`,
        'UPDATE_FAILED',
        error as Error
      );
    }
  }

  async updateMany(students: Student[]): Promise<void> {
    try {
      // バッチ更新（現在はキャッシュのみ）
      students.forEach(student => this.updateStudentInCache(student));
    } catch (error) {
      throw new RepositoryError(
        'Failed to update multiple students',
        'UPDATE_MANY_FAILED',
        error as Error
      );
    }
  }

  async getActiveStudents(): Promise<Student[]> {
    try {
      const allStudents = await this.getAll();
      return allStudents.filter(s => s.isActive());
    } catch (error) {
      throw new RepositoryError(
        'Failed to fetch active students',
        'FETCH_ACTIVE_FAILED',
        error as Error
      );
    }
  }

  async getStudentsRequiringHelp(): Promise<Student[]> {
    try {
      const allStudents = await this.getAll();
      return allStudents.filter(s => s.isRequestingHelp());
    } catch (error) {
      throw new RepositoryError(
        'Failed to fetch students requiring help',
        'FETCH_HELP_REQUIRED_FAILED',
        error as Error
      );
    }
  }

  async getStudentsWithErrors(): Promise<Student[]> {
    try {
      const allStudents = await this.getAll();
      return allStudents.filter(s => s.hasErrors());
    } catch (error) {
      throw new RepositoryError(
        'Failed to fetch students with errors',
        'FETCH_WITH_ERRORS_FAILED',
        error as Error
      );
    }
  }

  async getStudentsWithCache(maxAgeMs: number): Promise<Student[]> {
    const cached = this.getCachedStudents('all');
    if (cached && this.isCacheValid('all', maxAgeMs)) {
      return cached;
    }
    return await this.getAll();
  }

  subscribeToUpdates(callback: (students: Student[]) => void): () => void {
    this.subscriptions.add(callback);
    return () => {
      this.subscriptions.delete(callback);
    };
  }

  // Private helper methods
  private transformAPIStudentsToEntities(apiStudents: APIStudentActivity[]): Student[] {
    return apiStudents.map(apiStudent => {
      try {
        return new StudentBuilder()
          .setId(createStudentID(apiStudent.emailAddress))
          .setEmailAddress(createEmailAddress(apiStudent.emailAddress))
          .setUserName(apiStudent.userName)
          .setTeamId(createTeamID(apiStudent.teamName || '未割り当て'))
          .setStatus(this.mapAPIStatusToStudentStatus(apiStudent.status))
          .setHelpStatus(this.mapAPIStatusToHelpStatus(apiStudent.status, apiStudent.isRequestingHelp))
          .setCurrentNotebook(apiStudent.currentNotebook)
          .setLastActivity(this.parseActivityTime(apiStudent.lastActivity))
          .setCellExecutions(apiStudent.cellExecutions)
          .setErrorCount(apiStudent.errorCount)
          .build();
      } catch (error) {
        console.warn(`Failed to create student entity for ${apiStudent.emailAddress}:`, error);
        // フォールバック: 最小限のデータで学生エンティティを作成
        return this.createFallbackStudent(apiStudent);
      }
    }).filter(Boolean);
  }

  private mapAPIStatusToStudentStatus(apiStatus: string): StudentStatus {
    switch (apiStatus) {
      case 'active':
        return StudentStatus.ACTIVE;
      case 'idle':
        return StudentStatus.IDLE;
      case 'error':
        return StudentStatus.ERROR;
      case 'help':
        return StudentStatus.IDLE; // ヘルプ状態はIDLEとして扱い、helpStatusで区別
      default:
        return StudentStatus.IDLE;
    }
  }

  private mapAPIStatusToHelpStatus(apiStatus: string, isRequestingHelp?: boolean): StudentHelpStatus {
    if (apiStatus === 'help' || isRequestingHelp) {
      return StudentHelpStatus.REQUESTING;
    }
    return StudentHelpStatus.NONE;
  }

  private parseActivityTime(activityString: string): Date {
    // "2秒前", "5分前", "1時間前" などの日本語形式をパース
    const now = new Date();
    
    if (activityString === '不明' || !activityString) {
      return new Date(now.getTime() - 60 * 60 * 1000); // 1時間前をデフォルトに
    }

    // 秒前
    const secondsMatch = activityString.match(/(\d+)秒前/);
    if (secondsMatch) {
      return new Date(now.getTime() - parseInt(secondsMatch[1]) * 1000);
    }

    // 分前
    const minutesMatch = activityString.match(/(\d+)分前/);
    if (minutesMatch) {
      return new Date(now.getTime() - parseInt(minutesMatch[1]) * 60 * 1000);
    }

    // 時間前
    const hoursMatch = activityString.match(/(\d+)時間前/);
    if (hoursMatch) {
      return new Date(now.getTime() - parseInt(hoursMatch[1]) * 60 * 60 * 1000);
    }

    // ISO文字列としてパース試行
    try {
      return new Date(activityString);
    } catch {
      return new Date(now.getTime() - 60 * 60 * 1000); // フォールバック
    }
  }

  private createFallbackStudent(apiStudent: APIStudentActivity): Student {
    return new StudentBuilder()
      .setId(createStudentID(apiStudent.emailAddress))
      .setEmailAddress(createEmailAddress(apiStudent.emailAddress))
      .setUserName(apiStudent.userName || 'Unknown')
      .setTeamId(createTeamID('未割り当て'))
      .setStatus(StudentStatus.IDLE)
      .setHelpStatus(StudentHelpStatus.NONE)
      .build();
  }

  private updateCache(key: string, students: Student[]): void {
    this.cache.set(key, {
      data: students,
      timestamp: Date.now()
    });
  }

  private getCachedStudents(key: string): Student[] | null {
    const cached = this.cache.get(key);
    return cached ? cached.data : null;
  }

  private isCacheValid(key: string, maxAgeMs: number): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < maxAgeMs;
  }

  private updateStudentInCache(updatedStudent: Student): void {
    const cached = this.cache.get('all');
    if (cached) {
      const updatedStudents = cached.data.map(s => 
        s.equals(updatedStudent) ? updatedStudent : s
      );
      this.updateCache('all', updatedStudents);
      this.notifySubscribers(updatedStudents);
    }
  }

  private notifySubscribers(students: Student[]): void {
    this.subscriptions.forEach(callback => {
      try {
        callback(students);
      } catch (error) {
        console.error('Error in student update subscription:', error);
      }
    });
  }
}

/**
 * Factory function for dependency injection
 */
export const createAPIStudentRepository = (
  apiBaseUrl: string,
  timeout: number = 10000
): APIStudentRepository => {
  const apiClient = axios.create({
    baseURL: apiBaseUrl,
    timeout,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // エラーインターセプター
  apiClient.interceptors.response.use(
    (response: any) => response,
    (error: any) => {
      console.error('API Error:', error);
      return Promise.reject(error);
    }
  );

  return new APIStudentRepository(apiClient);
};