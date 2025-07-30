// 基本的な型定義

export interface Seat {
  id: string;
  seatNumber: string;
  studentId?: string;
  studentName?: string;
  teamNumber?: number;
  status: SeatStatus;
  position: {
    row?: number;
    col?: number;
    x?: number;
    y?: number;
  };
  student?: Student;
}

export type SeatStatus = 'normal' | 'help_requested' | 'inactive' | 'empty' | 'occupied';

export interface Student {
  id: string;
  name: string;
  email: string;
  seatNumber: string;
  isActive: boolean;
}

export interface HelpRequest {
  id: string;
  seatNumber: string;
  studentId: string;
  studentName: string;
  urgency: 'low' | 'medium' | 'high';
  timestamp: string;
  description?: string;
  message?: string;
  status?: 'pending' | 'in_progress' | 'resolved';
}

export interface Instructor {
  id: string;
  name: string;
  status: InstructorStatus;
  currentLocation?: string;
}

export type InstructorStatus = 'AVAILABLE' | 'IN_SESSION' | 'BREAK' | 'OFFLINE';

export interface LayoutConfig {
  totalSeats: number;
  gridRows: number;
  gridCols: number;
  gridSize: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  instructor: Instructor | null;
  token: string | null;
}

export interface LoginCredentials {
  username: string;
  password: string;
}
