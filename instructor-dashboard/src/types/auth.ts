// 認証関連の型定義

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface Instructor {
  id: string;
  name: string;
  email: string;
  status: InstructorStatus;
  currentLocation?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type InstructorStatus = 'AVAILABLE' | 'IN_SESSION' | 'BREAK' | 'OFFLINE';

export interface AuthResponse {
  access_token: string;
  token_type: string;
  instructor: Instructor;
}

export interface PasswordChangeData {
  current_password: string;
  new_password: string;
}

export interface AuthState {
  instructor: Instructor | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  getCurrentUser: () => Promise<void>;
  changePassword: (data: PasswordChangeData) => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export type AuthStore = AuthState & AuthActions;

// API エラーレスポンス
export interface APIError {
  detail: string;
  status?: number;
}

// WebSocket関連
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface InstructorStatusUpdate {
  instructor_id: string;
  status: InstructorStatus;
  location?: string;
  timestamp: string;
}
