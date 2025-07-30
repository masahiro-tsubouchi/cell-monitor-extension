// ダッシュボード状態管理ストア - 座席マップ・ヘルプ要請管理
import { create } from 'zustand';
import { Student, HelpRequest, InstructorStatus } from '../types/api';
import apiService from '../services/api';
import webSocketService, { WebSocketEventHandlers } from '../services/websocket';

export interface SeatData {
  seatNumber: string;
  student?: Student;
  status: 'normal' | 'help_requested' | 'empty' | 'inactive';
  urgency?: 'low' | 'medium' | 'high';
  helpRequestId?: number;
}

interface DashboardState {
  // 状態
  seats: SeatData[];
  helpRequests: HelpRequest[];
  students: Student[];
  isLoading: boolean;
  error: string | null;
  wsConnected: boolean;

  // 便利なプロパティ
  isConnected: boolean; // wsConnectedのエイリアス

  // アクション
  initializeDashboard: () => Promise<void>;
  refreshSeats: () => Promise<void>;
  refreshHelpRequests: () => Promise<void>;
  refreshData: () => Promise<void>; // 全データ更新
  handleSeatClick: (seatNumber: string) => void;
  handleHelpRequestClick: (helpRequestId: number) => void;
  updateInstructorStatus: (status: InstructorStatus) => Promise<void>;
  setupWebSocketHandlers: () => void;
  clearError: () => void;

  // WebSocketイベントハンドラー
  onStudentHelpRequest: (data: any) => void;
  onInstructorStatusUpdate: (data: any) => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  // 初期状態
  seats: [],
  helpRequests: [],
  students: [],
  isLoading: false,
  error: null,
  wsConnected: false,

  // 便利なプロパティ（getter）
  get isConnected() {
    return get().wsConnected;
  },

  // ダッシュボード初期化
  initializeDashboard: async () => {
    try {
      set({ isLoading: true, error: null });

      // 並行してデータを取得
      const [studentsResponse, helpRequestsResponse] = await Promise.all([
        apiService.getStudents({ is_active: true }),
        apiService.getHelpRequests({ status: 'pending' })
      ]);

      const students = studentsResponse.data;
      const helpRequests = helpRequestsResponse.data;

      // 座席データを生成（200席）
      const seats = generateSeats(students, helpRequests);

      // WebSocketハンドラーを設定
      get().setupWebSocketHandlers();

      set({
        seats,
        helpRequests,
        students,
        isLoading: false,
        wsConnected: webSocketService.isConnected()
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to initialize dashboard'
      });
      throw error;
    }
  },

  // 座席データ更新
  refreshSeats: async () => {
    try {
      const studentsResponse = await apiService.getStudents({ is_active: true });
      const helpRequestsResponse = await apiService.getHelpRequests({ status: 'pending' });

      const students = studentsResponse.data;
      const helpRequests = helpRequestsResponse.data;
      const seats = generateSeats(students, helpRequests);

      set({ seats, students, helpRequests });
    } catch (error: any) {
      set({ error: error.message || 'Failed to refresh seats' });
    }
  },

  // 全データ更新
  refreshData: async () => {
    await Promise.all([
      get().refreshSeats(),
      get().refreshHelpRequests()
    ]);
  },

  // ヘルプ要請データ更新
  refreshHelpRequests: async () => {
    try {
      const response = await apiService.getHelpRequests({ status: 'pending' });
      const helpRequests = response.data;

      // 座席データも更新
      const { seats, students } = get();
      const updatedSeats = updateSeatsWithHelpRequests(seats, helpRequests);

      set({ helpRequests, seats: updatedSeats });
    } catch (error: any) {
      set({ error: error.message || 'Failed to refresh help requests' });
    }
  },

  // 座席クリック処理
  handleSeatClick: (seatNumber: string) => {
    const { seats } = get();
    const seat = seats.find(s => s.seatNumber === seatNumber);

    if (seat?.status === 'help_requested' && seat.helpRequestId) {
      // ヘルプ要請がある場合は詳細表示
      get().handleHelpRequestClick(seat.helpRequestId);
    } else if (seat?.student) {
      // 学生情報表示
      console.log('Student info:', seat.student);
    }
  },

  // ヘルプ要請クリック処理
  handleHelpRequestClick: async (helpRequestId: number) => {
    try {
      // ヘルプ要請を進行中に更新
      await apiService.updateHelpRequest(helpRequestId, {
        status: 'in_progress'
      });

      // WebSocketで応答送信
      webSocketService.sendHelpResponse(helpRequestId, 'accept');

      // データ更新
      await get().refreshHelpRequests();
    } catch (error: any) {
      set({ error: error.message || 'Failed to handle help request' });
    }
  },

  // 講師ステータス更新
  updateInstructorStatus: async (status: InstructorStatus) => {
    try {
      // 現在の講師情報を取得（認証ストアから）
      const authStore = (window as any).__authStore;
      const instructor = authStore?.getState?.()?.instructor;

      if (!instructor) {
        throw new Error('Instructor not found');
      }

      await apiService.updateInstructorStatus(instructor.id, status);

      // WebSocketでステータス更新を送信
      webSocketService.sendStatusUpdate({
        instructor_id: instructor.id,
        status: status,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      set({ error: error.message || 'Failed to update instructor status' });
      throw error;
    }
  },

  // WebSocketハンドラー設定
  setupWebSocketHandlers: () => {
    const handlers: WebSocketEventHandlers = {
      onConnect: () => {
        set({ wsConnected: true });
        console.log('Dashboard WebSocket connected');
      },

      onDisconnect: () => {
        set({ wsConnected: false });
        console.log('Dashboard WebSocket disconnected');
      },

      onStudentHelpRequest: (data) => {
        get().onStudentHelpRequest(data);
      },

      onInstructorStatusUpdate: (data) => {
        get().onInstructorStatusUpdate(data);
      },

      onError: (error) => {
        set({ error: error.message || 'WebSocket error' });
      }
    };

    webSocketService.setEventHandlers(handlers);
  },

  // 学生ヘルプ要請イベント処理
  onStudentHelpRequest: (data) => {
    console.log('New help request received:', data);

    // ヘルプ要請データを更新
    get().refreshHelpRequests();

    // 通知表示（将来の実装）
    // showNotification('新しいヘルプ要請があります', data);
  },

  // 講師ステータス更新イベント処理
  onInstructorStatusUpdate: (data) => {
    console.log('Instructor status updated:', data);

    // 必要に応じて画面更新
    // 他の講師のステータス変更の場合の処理
  },

  // エラークリア
  clearError: () => {
    set({ error: null });
  }
}));

// ヘルパー関数：座席データ生成（200席）
function generateSeats(students: Student[], helpRequests: HelpRequest[]): SeatData[] {
  const seats: SeatData[] = [];

  // 20行 × 10列 = 200席
  for (let row = 1; row <= 20; row++) {
    for (let col = 1; col <= 10; col++) {
      const seatNumber = `${String.fromCharCode(64 + row)}-${col.toString().padStart(2, '0')}`;

      // 学生が割り当てられているかチェック
      const student = students.find(s => s.seat_number === seatNumber);

      // ヘルプ要請があるかチェック
      const helpRequest = helpRequests.find(hr =>
        hr.student.seat_number === seatNumber && hr.status === 'pending'
      );

      let status: SeatData['status'] = 'empty';
      let urgency: SeatData['urgency'] | undefined;
      let helpRequestId: number | undefined;

      if (student) {
        if (helpRequest) {
          status = 'help_requested';
          urgency = helpRequest.urgency;
          helpRequestId = helpRequest.id;
        } else {
          status = 'normal';
        }
      }

      seats.push({
        seatNumber,
        student,
        status,
        urgency,
        helpRequestId
      });
    }
  }

  return seats;
}

// ヘルパー関数：ヘルプ要請で座席データ更新
function updateSeatsWithHelpRequests(seats: SeatData[], helpRequests: HelpRequest[]): SeatData[] {
  return seats.map(seat => {
    const helpRequest = helpRequests.find(hr =>
      hr.student.seat_number === seat.seatNumber && hr.status === 'pending'
    );

    if (helpRequest) {
      return {
        ...seat,
        status: 'help_requested' as const,
        urgency: helpRequest.urgency,
        helpRequestId: helpRequest.id
      };
    } else if (seat.status === 'help_requested') {
      // ヘルプ要請が解決された場合
      return {
        ...seat,
        status: seat.student ? 'normal' as const : 'empty' as const,
        urgency: undefined,
        helpRequestId: undefined
      };
    }

    return seat;
  });
}
