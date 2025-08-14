// WebSocket関連で使用される最小限の型定義のみ保持

export enum InstructorStatus {
  AVAILABLE = 'AVAILABLE',
  IN_SESSION = 'IN_SESSION',
  BREAK = 'BREAK',
  OFFLINE = 'OFFLINE'
}

export interface StudentHelpRequestEvent {
  student_id: number;
  seat_number: string;
  urgency: 'low' | 'medium' | 'high';
  description?: string;
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
