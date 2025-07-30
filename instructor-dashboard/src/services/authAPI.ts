import { LoginCredentials, AuthResponse, Instructor, PasswordChangeData, APIError } from '../types/auth';

// API設定
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1';

// APIエラーハンドリング
class APIErrorHandler extends Error {
  status: number;

  constructor(message: string, status: number = 500) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
}

// 共通のfetchラッパー
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData: APIError = await response.json();
      throw new APIErrorHandler(errorData.detail || 'API request failed', response.status);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof APIErrorHandler) {
      throw error;
    }
    throw new Error(error instanceof Error ? error.message : 'Unknown error occurred');
  }
};

// 認証API実装
export const authAPI = {
  // ログイン
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    return apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  // 現在ユーザー取得
  getCurrentUser: async (token: string): Promise<Instructor> => {
    return apiRequest<Instructor>('/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  // ログアウト
  logout: async (token: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>('/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  // パスワード変更
  changePassword: async (
    data: PasswordChangeData,
    token: string
  ): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>('/auth/password', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
  },

  // トークン検証
  verifyToken: async (token: string): Promise<boolean> => {
    try {
      await authAPI.getCurrentUser(token);
      return true;
    } catch {
      return false;
    }
  },
};

// ローカルストレージ管理
export const tokenStorage = {
  getToken: (): string | null => {
    return localStorage.getItem('auth_token');
  },

  setToken: (token: string): void => {
    localStorage.setItem('auth_token', token);
  },

  removeToken: (): void => {
    localStorage.removeItem('auth_token');
  },

  getInstructor: (): Instructor | null => {
    const data = localStorage.getItem('instructor_data');
    return data ? JSON.parse(data) : null;
  },

  setInstructor: (instructor: Instructor): void => {
    localStorage.setItem('instructor_data', JSON.stringify(instructor));
  },

  removeInstructor: (): void => {
    localStorage.removeItem('instructor_data');
  },

  clear: (): void => {
    tokenStorage.removeToken();
    tokenStorage.removeInstructor();
  },
};
