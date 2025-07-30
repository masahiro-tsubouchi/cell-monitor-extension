// 認証状態管理ストア - Zustand使用
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Instructor, LoginRequest, PasswordChangeRequest } from '../types/api';
import apiService from '../services/api';
import webSocketService from '../services/websocket';

interface AuthState {
  // 状態
  instructor: Instructor | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // アクション
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  changePassword: (data: PasswordChangeRequest) => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 初期状態
      instructor: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // ログイン
      login: async (credentials: LoginRequest) => {
        try {
          set({ isLoading: true, error: null });

          const response = await apiService.login(credentials);
          const { instructor, access_token } = response.data;

          // WebSocket接続開始
          webSocketService.connect(access_token);

          set({
            instructor,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });
        } catch (error: any) {
          set({
            instructor: null,
            isAuthenticated: false,
            isLoading: false,
            error: error.message || 'Login failed'
          });
          throw error;
        }
      },

      // ログアウト
      logout: async () => {
        try {
          set({ isLoading: true });

          // WebSocket切断
          webSocketService.disconnect();

          // APIログアウト
          await apiService.logout();

          set({
            instructor: null,
            isAuthenticated: false,
            isLoading: false,
            error: null
          });
        } catch (error: any) {
          // ログアウトエラーは無視（状態はクリア）
          set({
            instructor: null,
            isAuthenticated: false,
            isLoading: false,
            error: null
          });
        }
      },

      // プロフィール更新
      refreshProfile: async () => {
        try {
          set({ isLoading: true, error: null });

          const response = await apiService.me();

          set({
            instructor: response.data,
            isLoading: false
          });
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.message || 'Failed to refresh profile'
          });

          // 認証エラーの場合はログアウト
          if (error.status === 401) {
            get().logout();
          }

          throw error;
        }
      },

      // パスワード変更
      changePassword: async (data: PasswordChangeRequest) => {
        try {
          set({ isLoading: true, error: null });

          await apiService.changePassword(data);

          set({
            isLoading: false,
            error: null
          });
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.message || 'Password change failed'
          });
          throw error;
        }
      },

      // エラークリア
      clearError: () => {
        set({ error: null });
      },

      // ローディング状態設定
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        instructor: state.instructor,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
