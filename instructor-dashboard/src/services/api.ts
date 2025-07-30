// APIサービスクラス - バックエンドAPI（186個テストケース成功済み）との統合
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  ApiResponse,
  ApiError,
  LoginRequest,
  LoginResponse,
  PasswordChangeRequest,
  Instructor,
  InstructorStatus,
  InstructorStatusHistory,
  Student,
  HelpRequest
} from '../types/api';

class ApiService {
  private api: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // リクエストインターセプター：認証トークンの自動付与
    this.api.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // レスポンスインターセプター：エラーハンドリング
    this.api.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        const apiError: ApiError = {
          message: error.response?.data?.detail || error.message || 'Unknown error',
          status: error.response?.status || 500,
          details: error.response?.data,
        };
        return Promise.reject(apiError);
      }
    );
  }

  // トークン管理
  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  clearToken(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  // 認証API
  async login(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    const response = await this.api.post<LoginResponse>('/auth/login', data);
    const loginResponse = response.data;

    // トークンを自動保存
    this.setToken(loginResponse.access_token);

    return {
      data: loginResponse,
      success: true,
      message: 'Login successful'
    };
  }

  async logout(): Promise<ApiResponse<null>> {
    try {
      await this.api.post('/auth/logout');
    } catch (error) {
      // ログアウトエラーは無視（トークンクリアは実行）
    }

    this.clearToken();
    return {
      data: null,
      success: true,
      message: 'Logout successful'
    };
  }

  async me(): Promise<ApiResponse<Instructor>> {
    const response = await this.api.get<Instructor>('/auth/me');
    return {
      data: response.data,
      success: true
    };
  }

  async changePassword(data: PasswordChangeRequest): Promise<ApiResponse<null>> {
    await this.api.put('/auth/password', data);
    return {
      data: null,
      success: true,
      message: 'Password changed successfully'
    };
  }

  // 講師管理API
  async getInstructors(params?: {
    is_active?: boolean;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<Instructor[]>> {
    const response = await this.api.get<Instructor[]>('/instructors', { params });
    return {
      data: response.data,
      success: true
    };
  }

  async getInstructor(id: number): Promise<ApiResponse<Instructor>> {
    const response = await this.api.get<Instructor>(`/instructors/${id}`);
    return {
      data: response.data,
      success: true
    };
  }

  async updateInstructor(id: number, data: Partial<Instructor>): Promise<ApiResponse<Instructor>> {
    const response = await this.api.put<Instructor>(`/instructors/${id}`, data);
    return {
      data: response.data,
      success: true,
      message: 'Instructor updated successfully'
    };
  }

  // 講師ステータス管理API
  async getInstructorStatus(id: number): Promise<ApiResponse<Instructor>> {
    const response = await this.api.get<Instructor>(`/instructor_status/${id}`);
    return {
      data: response.data,
      success: true
    };
  }

  async updateInstructorStatus(
    id: number,
    status: InstructorStatus,
    session_id?: number
  ): Promise<ApiResponse<Instructor>> {
    const response = await this.api.put<Instructor>(`/instructor_status/${id}`, {
      status,
      session_id
    });
    return {
      data: response.data,
      success: true,
      message: 'Status updated successfully'
    };
  }

  async getInstructorStatusHistory(
    id: number,
    params?: { page?: number; limit?: number; }
  ): Promise<ApiResponse<InstructorStatusHistory[]>> {
    const response = await this.api.get<InstructorStatusHistory[]>(
      `/instructor_status/${id}/history`,
      { params }
    );
    return {
      data: response.data,
      success: true
    };
  }

  // 学生・ヘルプ要請API（将来の拡張用）
  async getStudents(params?: { is_active?: boolean }): Promise<ApiResponse<Student[]>> {
    const response = await this.api.get<Student[]>('/students', { params });
    return {
      data: response.data,
      success: true
    };
  }

  async getHelpRequests(params?: { status?: string }): Promise<ApiResponse<HelpRequest[]>> {
    const response = await this.api.get<HelpRequest[]>('/help-requests', { params });
    return {
      data: response.data,
      success: true
    };
  }

  async updateHelpRequest(id: number, data: Partial<HelpRequest>): Promise<ApiResponse<HelpRequest>> {
    const response = await this.api.put<HelpRequest>(`/api/v1/help-requests/${id}`, data);
    return {
      data: response.data,
      success: true,
      message: 'Help request updated successfully'
    };
  }
}

// シングルトンインスタンス
export const apiService = new ApiService();
export default apiService;
