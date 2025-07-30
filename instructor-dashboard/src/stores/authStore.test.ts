// 認証ストアテスト - AI駆動TDD Phase 2
import { useAuthStore } from './authStore';
import { LoginRequest, InstructorStatus } from '../types/api';
import apiService from '../services/api';
import webSocketService from '../services/websocket';

// モック設定
jest.mock('../services/api');
jest.mock('../services/websocket');

const mockApiService = jest.mocked(apiService);
const mockWebSocketService = jest.mocked(webSocketService);

describe('AuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // ストアをリセット
    useAuthStore.setState({
      instructor: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();

      expect(state.instructor).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('Login', () => {
    it('should login successfully', async () => {
      const credentials: LoginRequest = {
        email: 'instructor@example.com',
        password: 'password123'
      };

      const mockInstructor = {
        id: 1,
        email: 'instructor@example.com',
        name: 'Test Instructor',
        status: InstructorStatus.AVAILABLE,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mockResponse = {
        data: {
          instructor: mockInstructor,
          access_token: 'test-token',
          token_type: 'bearer'
        },
        success: true
      };

      mockApiService.login.mockResolvedValue(mockResponse);
      mockWebSocketService.connect.mockImplementation(() => {});

      const { login } = useAuthStore.getState();
      await login(credentials);

      const state = useAuthStore.getState();
      expect(state.instructor).toEqual(mockInstructor);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(mockWebSocketService.connect).toHaveBeenCalledWith('test-token');
    });

    it('should handle login failure', async () => {
      const credentials: LoginRequest = {
        email: 'wrong@example.com',
        password: 'wrongpassword'
      };

      const mockError = new Error('Invalid credentials');
      mockApiService.login.mockRejectedValue(mockError);

      const { login } = useAuthStore.getState();

      await expect(login(credentials)).rejects.toThrow('Invalid credentials');

      const state = useAuthStore.getState();
      expect(state.instructor).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Invalid credentials');
    });

    it('should set loading state during login', async () => {
      const credentials: LoginRequest = {
        email: 'instructor@example.com',
        password: 'password123'
      };

      // ログイン処理を遅延させる
      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });
      mockApiService.login.mockReturnValue(loginPromise as any);

      const { login } = useAuthStore.getState();
      const loginCall = login(credentials);

      // ローディング状態を確認
      expect(useAuthStore.getState().isLoading).toBe(true);

      // ログイン完了
      resolveLogin!({
        data: {
          instructor: {
            id: 1,
            email: 'instructor@example.com',
            name: 'Test Instructor',
            status: InstructorStatus.AVAILABLE,
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          },
          access_token: 'test-token',
          token_type: 'bearer'
        },
        success: true
      });

      await loginCall;

      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('Logout', () => {
    it('should logout successfully', async () => {
      // 初期状態を設定（ログイン済み）
      useAuthStore.setState({
        instructor: {
          id: 1,
          email: 'instructor@example.com',
          name: 'Test Instructor',
          status: InstructorStatus.AVAILABLE,
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        isAuthenticated: true,
        isLoading: false,
        error: null
      });

      mockApiService.logout.mockResolvedValue({ data: null, success: true });
      mockWebSocketService.disconnect.mockImplementation(() => {});

      const { logout } = useAuthStore.getState();
      await logout();

      const state = useAuthStore.getState();
      expect(state.instructor).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(mockWebSocketService.disconnect).toHaveBeenCalled();
    });

    it('should clear state even if logout API fails', async () => {
      // 初期状態を設定（ログイン済み）
      useAuthStore.setState({
        instructor: {
          id: 1,
          email: 'instructor@example.com',
          name: 'Test Instructor',
          status: InstructorStatus.AVAILABLE,
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        isAuthenticated: true,
        isLoading: false,
        error: null
      });

      mockApiService.logout.mockRejectedValue(new Error('Network error'));
      mockWebSocketService.disconnect.mockImplementation(() => {});

      const { logout } = useAuthStore.getState();
      await logout();

      const state = useAuthStore.getState();
      expect(state.instructor).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('Refresh Profile', () => {
    it('should refresh profile successfully', async () => {
      const updatedInstructor = {
        id: 1,
        email: 'instructor@example.com',
        name: 'Updated Instructor',
        status: InstructorStatus.IN_SESSION,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z'
      };

      mockApiService.me.mockResolvedValue({
        data: updatedInstructor,
        success: true
      });

      const { refreshProfile } = useAuthStore.getState();
      await refreshProfile();

      const state = useAuthStore.getState();
      expect(state.instructor).toEqual(updatedInstructor);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle 401 error and logout', async () => {
      const mockError = { status: 401, message: 'Unauthorized' };
      mockApiService.me.mockRejectedValue(mockError);

      // logout関数をスパイ
      const logoutSpy = jest.spyOn(useAuthStore.getState(), 'logout');
      logoutSpy.mockResolvedValue();

      const { refreshProfile } = useAuthStore.getState();

      await expect(refreshProfile()).rejects.toEqual(mockError);
      expect(logoutSpy).toHaveBeenCalled();

      logoutSpy.mockRestore();
    });
  });

  describe('Change Password', () => {
    it('should change password successfully', async () => {
      const passwordData = {
        current_password: 'oldpassword',
        new_password: 'newpassword'
      };

      mockApiService.changePassword.mockResolvedValue({
        data: null,
        success: true,
        message: 'Password changed successfully'
      });

      const { changePassword } = useAuthStore.getState();
      await changePassword(passwordData);

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle password change failure', async () => {
      const passwordData = {
        current_password: 'wrongpassword',
        new_password: 'newpassword'
      };

      const mockError = new Error('Current password is incorrect');
      mockApiService.changePassword.mockRejectedValue(mockError);

      const { changePassword } = useAuthStore.getState();

      await expect(changePassword(passwordData)).rejects.toThrow('Current password is incorrect');

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Current password is incorrect');
    });
  });

  describe('Utility Functions', () => {
    it('should clear error', () => {
      useAuthStore.setState({ error: 'Test error' });

      const { clearError } = useAuthStore.getState();
      clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });

    it('should set loading state', () => {
      const { setLoading } = useAuthStore.getState();

      setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);

      setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('Persistence', () => {
    it('should persist authentication state', () => {
      const instructor = {
        id: 1,
        email: 'instructor@example.com',
        name: 'Test Instructor',
        status: InstructorStatus.AVAILABLE,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      useAuthStore.setState({
        instructor,
        isAuthenticated: true
      });

      // ローカルストレージに保存されることを確認
      const stored = localStorage.getItem('auth-storage');
      expect(stored).toBeTruthy();

      const parsedStored = JSON.parse(stored!);
      expect(parsedStored.state.instructor).toEqual(instructor);
      expect(parsedStored.state.isAuthenticated).toBe(true);
    });
  });
});
