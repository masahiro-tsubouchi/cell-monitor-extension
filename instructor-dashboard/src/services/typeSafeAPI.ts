/**
 * Type-Safe API Layer
 * Phase 3: 完全型安全なAPI通信実装
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import { 
  DashboardOverview, 
  StudentActivity, 
  Team, 
  Metrics,
  DashboardOverviewSchema,
  StudentActivitySchema,
  TeamSchema,
  MetricsSchema 
} from '../types/schemas';
import { 
  StudentID, 
  TeamID, 
  InstructorID 
} from '../types/nominal';
import { 
  NetworkError, 
  ValidationError, 
  AuthenticationError,
  handleError,
  withRetry 
} from '../utils/errorHandling';

// ✅ API Configuration
interface APIConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

const DEFAULT_CONFIG: APIConfig = {
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1',
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000
};

// ✅ Type-Safe API Response Handler
class TypeSafeAPIResponse<T> {
  constructor(
    public readonly data: T,
    public readonly status: number,
    public readonly headers: Record<string, string>
  ) {}
}

// ✅ Type-Safe API Client
export class TypeSafeDashboardAPI {
  private client: AxiosInstance;
  private config: APIConfig;

  constructor(config: Partial<APIConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = this.createAxiosInstance();
  }

  private createAxiosInstance(): AxiosInstance {
    const instance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Request interceptor
    instance.interceptors.request.use(
      (config) => {
        // Add authentication token if available
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(this.handleRequestError(error))
    );

    // Response interceptor
    instance.interceptors.response.use(
      (response) => response,
      (error) => Promise.reject(this.handleResponseError(error))
    );

    return instance;
  }

  private handleRequestError(error: any): NetworkError {
    return new NetworkError(
      `Request configuration error: ${error.message}`,
      undefined,
      undefined,
      { originalError: error }
    );
  }

  private handleResponseError(error: AxiosError): NetworkError | AuthenticationError {
    if (error.response) {
      const { status, data, config } = error.response;
      
      if (status === 401) {
        return new AuthenticationError(
          'Authentication required',
          { endpoint: config?.url, status }
        );
      }
      
      return new NetworkError(
        `HTTP ${status}: ${this.getErrorMessage(data)}`,
        status,
        config?.url,
        { responseData: data }
      );
    }
    
    if (error.request) {
      return new NetworkError(
        'Network request failed - no response received',
        undefined,
        error.config?.url,
        { timeout: error.code === 'ECONNABORTED' }
      );
    }
    
    return new NetworkError(
      `Request setup error: ${error.message}`,
      undefined,
      undefined,
      { originalError: error }
    );
  }

  private getErrorMessage(data: any): string {
    if (typeof data === 'string') return data;
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    return 'Unknown error';
  }

  // ✅ Type-Safe API Methods

  /**
   * 型安全なダッシュボード概要取得
   */
  async getDashboardOverview(): Promise<TypeSafeAPIResponse<DashboardOverview>> {
    return withRetry(async () => {
      const response = await this.client.get<unknown>('/dashboard/overview');
      
      // Runtime validation
      const parseResult = DashboardOverviewSchema.safeParse(response.data);
      if (!parseResult.success) {
        throw new ValidationError(parseResult.error, {
          endpoint: '/dashboard/overview',
          receivedData: response.data
        });
      }
      
      return new TypeSafeAPIResponse(
        parseResult.data,
        response.status,
        response.headers as Record<string, string>
      );
    }, this.config.retryAttempts, this.config.retryDelay, 'getDashboardOverview');
  }

  /**
   * 型安全な学生データ取得
   */
  async getStudent(studentId: StudentID): Promise<TypeSafeAPIResponse<StudentActivity>> {
    return withRetry(async () => {
      const response = await this.client.get<unknown>(`/students/${studentId}`);
      
      const parseResult = StudentActivitySchema.safeParse(response.data);
      if (!parseResult.success) {
        throw new ValidationError(parseResult.error, {
          endpoint: `/students/${studentId}`,
          receivedData: response.data
        });
      }
      
      return new TypeSafeAPIResponse(
        parseResult.data,
        response.status,
        response.headers as Record<string, string>
      );
    }, this.config.retryAttempts, this.config.retryDelay, `getStudent:${studentId}`);
  }

  /**
   * 型安全な学生リスト取得
   */
  async getStudents(
    teamId?: TeamID,
    status?: 'active' | 'idle' | 'help',
    limit?: number,
    offset?: number
  ): Promise<TypeSafeAPIResponse<StudentActivity[]>> {
    return withRetry(async () => {
      const params = new URLSearchParams();
      if (teamId) params.append('teamId', teamId);
      if (status) params.append('status', status);
      if (limit) params.append('limit', limit.toString());
      if (offset) params.append('offset', offset.toString());
      
      const response = await this.client.get<unknown>(
        `/students?${params.toString()}`
      );
      
      // Validate array of students
      if (!Array.isArray(response.data)) {
        throw new ValidationError(
          new (require('zod').ZodError)([{
            code: 'invalid_type',
            expected: 'array',
            received: typeof response.data,
            path: [],
            message: 'Expected array of students'
          }]),
          { endpoint: '/students', receivedData: response.data }
        );
      }
      
      const students: StudentActivity[] = [];
      const errors: string[] = [];
      
      response.data.forEach((item: unknown, index: number) => {
        const parseResult = StudentActivitySchema.safeParse(item);
        if (parseResult.success) {
          students.push(parseResult.data);
        } else {
          errors.push(`Student ${index}: ${parseResult.error.message}`);
        }
      });
      
      if (errors.length > 0) {
        throw new ValidationError(
          new (require('zod').ZodError)([{
            code: 'custom',
            path: [],
            message: `Validation errors: ${errors.join(', ')}`
          }]),
          { endpoint: '/students', errors }
        );
      }
      
      return new TypeSafeAPIResponse(
        students,
        response.status,
        response.headers as Record<string, string>
      );
    }, this.config.retryAttempts, this.config.retryDelay, 'getStudents');
  }

  /**
   * 型安全なチーム取得
   */
  async getTeam(teamId: TeamID): Promise<TypeSafeAPIResponse<Team>> {
    return withRetry(async () => {
      const response = await this.client.get<unknown>(`/teams/${teamId}`);
      
      const parseResult = TeamSchema.safeParse(response.data);
      if (!parseResult.success) {
        throw new ValidationError(parseResult.error, {
          endpoint: `/teams/${teamId}`,
          receivedData: response.data
        });
      }
      
      return new TypeSafeAPIResponse(
        parseResult.data,
        response.status,
        response.headers as Record<string, string>
      );
    }, this.config.retryAttempts, this.config.retryDelay, `getTeam:${teamId}`);
  }

  /**
   * 型安全なメトリクス取得
   */
  async getMetrics(): Promise<TypeSafeAPIResponse<Metrics>> {
    return withRetry(async () => {
      const response = await this.client.get<unknown>('/metrics');
      
      const parseResult = MetricsSchema.safeParse(response.data);
      if (!parseResult.success) {
        throw new ValidationError(parseResult.error, {
          endpoint: '/metrics',
          receivedData: response.data
        });
      }
      
      return new TypeSafeAPIResponse(
        parseResult.data,
        response.status,
        response.headers as Record<string, string>
      );
    }, this.config.retryAttempts, this.config.retryDelay, 'getMetrics');
  }

  /**
   * 型安全な学生ヘルプ要請
   */
  async requestHelp(studentId: StudentID, message?: string): Promise<TypeSafeAPIResponse<void>> {
    return withRetry(async () => {
      const response = await this.client.post(`/students/${studentId}/help`, {
        message: message || ''
      });
      
      return new TypeSafeAPIResponse(
        undefined,
        response.status,
        response.headers as Record<string, string>
      );
    }, this.config.retryAttempts, this.config.retryDelay, `requestHelp:${studentId}`);
  }

  /**
   * 型安全なヘルプ要請解決
   */
  async resolveHelp(
    studentId: StudentID, 
    instructorId: InstructorID
  ): Promise<TypeSafeAPIResponse<void>> {
    return withRetry(async () => {
      const response = await this.client.post(`/students/${studentId}/help/resolve`, {
        instructorId
      });
      
      return new TypeSafeAPIResponse(
        undefined,
        response.status,
        response.headers as Record<string, string>
      );
    }, this.config.retryAttempts, this.config.retryDelay, `resolveHelp:${studentId}`);
  }

  /**
   * 型安全な学生位置更新
   */
  async updateStudentPosition(
    studentId: StudentID,
    position: { x: number; y: number }
  ): Promise<TypeSafeAPIResponse<void>> {
    return withRetry(async () => {
      // Position validation
      if (position.x < 0 || position.x > 100 || position.y < 0 || position.y > 100) {
        throw new ValidationError(
          new (require('zod').ZodError)([{
            code: 'custom',
            path: ['position'],
            message: 'Position coordinates must be between 0 and 100'
          }]),
          { studentId, position }
        );
      }
      
      const response = await this.client.put(`/students/${studentId}/position`, {
        position
      });
      
      return new TypeSafeAPIResponse(
        undefined,
        response.status,
        response.headers as Record<string, string>
      );
    }, this.config.retryAttempts, this.config.retryDelay, `updateStudentPosition:${studentId}`);
  }

  /**
   * 設定更新
   */
  updateConfig(newConfig: Partial<APIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.client = this.createAxiosInstance();
  }

  /**
   * 認証トークン設定
   */
  setAuthToken(token: string): void {
    localStorage.setItem('auth_token', token);
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  /**
   * 認証トークン削除
   */
  clearAuthToken(): void {
    localStorage.removeItem('auth_token');
    delete this.client.defaults.headers.common['Authorization'];
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

// ✅ グローバルAPI インスタンス
export const dashboardAPI = new TypeSafeDashboardAPI();

// ✅ レスポンス型安全性のための型ガード
export const isSuccessResponse = <T>(
  response: TypeSafeAPIResponse<T>
): response is TypeSafeAPIResponse<T> => {
  return response.status >= 200 && response.status < 300;
};

// ✅ エラーハンドリングヘルパー
export const handleAPIError = (error: unknown, context: string) => {
  const domainError = handleError(error, `API:${context}`);
  
  // ユーザーフレンドリーなエラーメッセージを提供
  if (domainError instanceof NetworkError) {
    if (domainError.statusCode === 404) {
      return '要求されたデータが見つかりませんでした。';
    }
    if (domainError.statusCode === 500) {
      return 'サーバーエラーが発生しました。しばらく待ってから再試行してください。';
    }
    if (domainError.statusCode === 403) {
      return 'このリソースへのアクセス権限がありません。';
    }
  }
  
  if (domainError instanceof AuthenticationError) {
    return '認証が必要です。ログインしてください。';
  }
  
  if (domainError instanceof ValidationError) {
    return 'データの形式が正しくありません。';
  }
  
  return domainError.userMessage;
};