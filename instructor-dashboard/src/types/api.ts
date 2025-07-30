// API型定義 - バックエンドAPI（186個テストケース成功済み）との統合
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

// 講師関連型定義
export interface Instructor {
  id: number;
  email: string;
  name: string;
  status: InstructorStatus;
  current_session_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export enum InstructorStatus {
  AVAILABLE = 'AVAILABLE',
  IN_SESSION = 'IN_SESSION',
  BREAK = 'BREAK',
  OFFLINE = 'OFFLINE'
}

export interface InstructorStatusHistory {
  id: number;
  instructor_id: number;
  status: InstructorStatus;
  started_at: string;
  ended_at?: string;
  duration_minutes?: number;
  created_at: string;
}

// 認証関連型定義
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  instructor: Instructor;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

// 座席・学生関連型定義
export interface Student {
  id: number;
  user_id: string;
  name: string;
  email: string;
  seat_number?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HelpRequest {
  id: number;
  student_id: number;
  student: Student;
  urgency: 'low' | 'medium' | 'high';
  description?: string;
  status: 'pending' | 'in_progress' | 'resolved';
  created_at: string;
  resolved_at?: string;
  assigned_instructor_id?: number;
}

// WebSocket関連型定義
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface InstructorStatusUpdate {
  instructor_id: number;
  status: InstructorStatus;
  session_id?: number;
}

export interface StudentHelpRequestEvent {
  student_id: number;
  seat_number: string;
  urgency: 'low' | 'medium' | 'high';
  description?: string;
}

// API エンドポイント型定義
export interface ApiEndpoints {
  // 認証API
  login: (data: LoginRequest) => Promise<ApiResponse<LoginResponse>>;
  logout: () => Promise<ApiResponse<null>>;
  me: () => Promise<ApiResponse<Instructor>>;
  changePassword: (data: PasswordChangeRequest) => Promise<ApiResponse<null>>;

  // 講師管理API
  getInstructors: (params?: { is_active?: boolean; page?: number; limit?: number }) => Promise<ApiResponse<Instructor[]>>;
  getInstructor: (id: number) => Promise<ApiResponse<Instructor>>;
  updateInstructor: (id: number, data: Partial<Instructor>) => Promise<ApiResponse<Instructor>>;

  // 講師ステータス管理API
  getInstructorStatus: (id: number) => Promise<ApiResponse<Instructor>>;
  updateInstructorStatus: (id: number, status: InstructorStatus, session_id?: number) => Promise<ApiResponse<Instructor>>;
  getInstructorStatusHistory: (id: number, params?: { page?: number; limit?: number }) => Promise<ApiResponse<InstructorStatusHistory[]>>;

  // 学生・ヘルプ要請API
  getStudents: (params?: { is_active?: boolean }) => Promise<ApiResponse<Student[]>>;
  getHelpRequests: (params?: { status?: string }) => Promise<ApiResponse<HelpRequest[]>>;
  updateHelpRequest: (id: number, data: Partial<HelpRequest>) => Promise<ApiResponse<HelpRequest>>;
}

// 座席レイアウトエディタ関連型定義
export enum SeatStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  HELP_REQUESTED = 'HELP_REQUESTED',
  MAINTENANCE = 'MAINTENANCE'
}

export interface Position {
  x: number;
  y: number;
}

export interface Seat {
  id: string;
  seatNumber: string;
  position: Position;
  status: SeatStatus;
  studentId: string | null;
  studentName: string | null;
}

export interface Zone {
  id: string;
  name: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface LayoutConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  maxSeats: number;
  gridSize: number;
  zones: Zone[];
}

export interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  layout: LayoutConfig;
  seats: Seat[];
  previewImage?: string;
}

export interface SeatEditorProps {
  seats: Seat[];
  layout: LayoutConfig;
  isEditMode: boolean;
  onSeatMove?: (seatId: string, position: Position) => void;
  onSeatAdd?: (seat: Omit<Seat, 'id'>) => void;
  onSeatRemove?: (seatId: string) => void;
  onLayoutChange?: (layout: LayoutConfig) => void;
  onSaveLayout?: (data: { name: string; seats: Seat[]; layout: LayoutConfig }) => void;
  onLoadTemplate?: (templateId: string) => void;
  onEditModeChange?: (isEditMode: boolean) => void;
}

// エラー型定義
export interface ApiError {
  message: string;
  status: number;
  details?: any;
}
