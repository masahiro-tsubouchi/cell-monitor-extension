import { authAPI } from './authAPI';
import { LoginCredentials, AuthResponse } from '../types/auth';

// TDD開発ルール: テストファースト
// 目的: 認証API統合の完全なテストを作成する

// モックデータ
const mockCredentials: LoginCredentials = {
  email: 'instructor@example.com',
  password: 'password123'
};

const mockAuthResponse: AuthResponse = {
  access_token: 'mock-jwt-token',
  token_type: 'bearer',
  instructor: {
    id: '1',
    name: '田中先生',
    email: 'instructor@example.com',
    status: 'AVAILABLE',
    currentLocation: '教室A'
  }
};

// グローバルfetchのモック
global.fetch = jest.fn();

describe('AuthAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // デフォルトの成功レスポンス
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockAuthResponse,
      status: 200
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // 1. ログイン成功テスト
  it('should login successfully with valid credentials', async () => {
    const result = await authAPI.login(mockCredentials);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockCredentials),
      }
    );

    expect(result).toEqual(mockAuthResponse);
  });

  // 2. ログイン失敗テスト（認証エラー）
  it('should throw error on invalid credentials', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Invalid credentials' })
    });

    await expect(authAPI.login(mockCredentials)).rejects.toThrow('Invalid credentials');
  });

  // 3. ネットワークエラーテスト
  it('should handle network errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    await expect(authAPI.login(mockCredentials)).rejects.toThrow('Network error');
  });

  // 4. 現在ユーザー取得テスト
  it('should get current user with valid token', async () => {
    const mockInstructor = mockAuthResponse.instructor;
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockInstructor,
      status: 200
    });

    const result = await authAPI.getCurrentUser('mock-jwt-token');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/me',
      {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer mock-jwt-token',
          'Content-Type': 'application/json',
        },
      }
    );

    expect(result).toEqual(mockInstructor);
  });

  // 5. 無効なトークンテスト
  it('should throw error on invalid token', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Invalid token' })
    });

    await expect(authAPI.getCurrentUser('invalid-token')).rejects.toThrow('Invalid token');
  });

  // 6. ログアウトテスト
  it('should logout successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Logged out successfully' }),
      status: 200
    });

    const result = await authAPI.logout('mock-jwt-token');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/logout',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-jwt-token',
          'Content-Type': 'application/json',
        },
      }
    );

    expect(result).toEqual({ message: 'Logged out successfully' });
  });

  // 7. パスワード変更テスト
  it('should change password successfully', async () => {
    const passwordData = {
      current_password: 'oldPassword',
      new_password: 'newPassword123'
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Password changed successfully' }),
      status: 200
    });

    const result = await authAPI.changePassword(passwordData, 'mock-jwt-token');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/password',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-jwt-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(passwordData),
      }
    );

    expect(result).toEqual({ message: 'Password changed successfully' });
  });

  // 8. APIベースURL設定テスト
  it('should use correct API base URL from environment', () => {
    // 環境変数のテスト
    expect(process.env.REACT_APP_API_BASE_URL).toBeDefined();
  });
});
