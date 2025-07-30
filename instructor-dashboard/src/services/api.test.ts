// APIサービステスト - AI駆動TDD Phase 2
import { LoginRequest, InstructorStatus } from '../types/api';

// モック設定
jest.mock('axios');
const mockAxios = jest.mocked(require('axios'));

// APIサービスをテスト後にインポート（モック設定後）
let apiService: any;

describe('ApiService', () => {
  let mockApiInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // モックAPIインスタンスを作成
    mockApiInstance = {
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      },
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    };

    // axios.create のモック
    mockAxios.create.mockReturnValue(mockApiInstance);

    // APIサービスを動的にインポート
    const { apiService: importedApiService } = require('./api');
    apiService = importedApiService;
  });

  describe('Authentication', () => {
    it('should login successfully and store token', async () => {
      const loginData: LoginRequest = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockResponse = {
        data: {
          access_token: 'mock-token',
          token_type: 'bearer',
          instructor: {
            id: 1,
            email: 'test@example.com',
            name: 'Test Instructor'
          }
        }
      };
      mockApiInstance.post.mockResolvedValue(mockResponse);

      const result = await apiService.login(loginData);

      expect(mockApiInstance.post).toHaveBeenCalledWith('/auth/login', loginData);
      expect(result.success).toBe(true);
      expect(result.data.access_token).toBe('mock-token');
      expect(localStorage.getItem('auth_token')).toBe('mock-token');
    });

    it('should logout and clear token', async () => {
      // トークンを設定
      localStorage.setItem('auth_token', 'test-token');

      const mockResponse = { data: { message: 'Logged out successfully' } };
      mockApiInstance.post.mockResolvedValue(mockResponse);

      const result = await apiService.logout();

      // ログアウト処理が成功することを確認
      expect(result.success).toBe(true);
      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    it('should get current instructor profile', async () => {
      const mockInstructor = {
        id: 1,
        email: 'instructor@example.com',
        name: '田中先生',
        department: '情報工学科',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mockApi = apiService['api'];
      mockApi.get = jest.fn().mockResolvedValue({ data: mockInstructor });

      const result = await apiService.me();

      // プロフィール取得が成功することを確認
      expect(mockApi.get).toHaveBeenCalledWith('/auth/me');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockInstructor);
    });

    it('should change password successfully', async () => {
      const passwordData = {
        current_password: 'oldpassword',
        new_password: 'newpassword'
      };

      const mockResponse = { data: { message: 'Password changed successfully' } };
      mockApiInstance.put.mockResolvedValue(mockResponse);

      const result = await apiService.changePassword(passwordData);

      // パスワード変更が成功することを確認
      expect(result.success).toBe(true);
    });
  });

  describe('Instructor Management', () => {
    it('should get instructors list', async () => {
      const mockInstructors = [
        {
          id: 1,
          email: 'instructor1@example.com',
          name: 'Instructor 1',
          status: InstructorStatus.AVAILABLE,
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      const mockApi = apiService['api'];
      mockApi.get = jest.fn().mockResolvedValue({ data: mockInstructors });

      const result = await apiService.getInstructors({ is_active: true });

      expect(mockApi.get).toHaveBeenCalledWith('/instructors', {
        params: { is_active: true }
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockInstructors);
    });

    it('should get single instructor', async () => {
      const mockInstructor = {
        id: 1,
        email: 'instructor@example.com',
        name: 'Test Instructor',
        status: InstructorStatus.AVAILABLE,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mockApi = apiService['api'];
      mockApi.get = jest.fn().mockResolvedValue({ data: mockInstructor });

      const result = await apiService.getInstructor(1);

      expect(mockApi.get).toHaveBeenCalledWith('/instructors/1');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockInstructor);
    });

    it('should update instructor', async () => {
      const updateData = { name: 'Updated Name' };
      const mockUpdatedInstructor = {
        id: 1,
        email: 'instructor@example.com',
        name: 'Updated Name',
        status: InstructorStatus.AVAILABLE,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mockApi = apiService['api'];
      mockApi.put = jest.fn().mockResolvedValue({ data: mockUpdatedInstructor });

      const result = await apiService.updateInstructor(1, updateData);

      expect(mockApi.put).toHaveBeenCalledWith('/instructors/1', updateData);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdatedInstructor);
    });
  });

  describe('Instructor Status Management', () => {
    it('should get instructor status', async () => {
      const mockInstructor = {
        id: 1,
        email: 'instructor@example.com',
        name: 'Test Instructor',
        status: InstructorStatus.IN_SESSION,
        current_session_id: 123,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mockApi = apiService['api'];
      mockApi.get = jest.fn().mockResolvedValue({ data: mockInstructor });

      const result = await apiService.getInstructorStatus(1);

      expect(mockApi.get).toHaveBeenCalledWith('/instructor_status/1');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockInstructor);
    });

    it('should update instructor status', async () => {
      const mockUpdatedInstructor = {
        id: 1,
        email: 'instructor@example.com',
        name: 'Test Instructor',
        status: InstructorStatus.BREAK,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mockApi = apiService['api'];
      mockApi.put = jest.fn().mockResolvedValue({ data: mockUpdatedInstructor });

      const result = await apiService.updateInstructorStatus(1, InstructorStatus.BREAK);

      expect(mockApi.put).toHaveBeenCalledWith('/instructor_status/1', {
        status: InstructorStatus.BREAK,
        session_id: undefined
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdatedInstructor);
    });

    it('should get instructor status history', async () => {
      const mockHistory = [
        {
          id: 1,
          instructor_id: 1,
          status: InstructorStatus.AVAILABLE,
          started_at: '2024-01-01T09:00:00Z',
          ended_at: '2024-01-01T10:00:00Z',
          duration_minutes: 60,
          created_at: '2024-01-01T09:00:00Z'
        }
      ];

      const mockApi = apiService['api'];
      mockApi.get = jest.fn().mockResolvedValue({ data: mockHistory });

      const result = await apiService.getInstructorStatusHistory(1, { page: 1, limit: 10 });

      expect(mockApi.get).toHaveBeenCalledWith('/instructor_status/1/history', {
        params: { page: 1, limit: 10 }
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockHistory);
    });
  });

  describe('Error Handling', () => {
    it('should handle API service initialization correctly', () => {
      // APIサービスが正しく初期化されることを確認
      expect(apiService).toBeDefined();
      expect(typeof apiService.login).toBe('function');
      expect(typeof apiService.logout).toBe('function');
      expect(typeof apiService.me).toBe('function');
    });

    it('should handle token management correctly', () => {
      // トークン管理機能をテスト
      const testToken = 'test-token-123';
      apiService.setToken(testToken);
      expect(localStorage.getItem('auth_token')).toBe(testToken);

      apiService.clearToken();
      expect(localStorage.getItem('auth_token')).toBeNull();
    });
  });
});
