import { io, Socket } from 'socket.io-client';
import {
  WebSocketMessage,
  InstructorStatusUpdate,
  StudentHelpRequestEvent,
  InstructorStatus
} from '../types/api';
import { StudentActivity } from './dashboardAPI';
import { ENV } from '../config/environment';

export interface WebSocketEventHandlers {
  onInstructorStatusUpdate?: (data: InstructorStatusUpdate) => void;
  onInstructorLocationUpdate?: (data: any) => void;
  onStudentHelpRequest?: (data: StudentHelpRequestEvent) => void;
  onSystemAlert?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
  onStudentProgressUpdate?: (data: StudentActivity) => void;
  onCellExecution?: (data: any) => void;
}

class WebSocketService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private eventHandlers: WebSocketEventHandlers = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // 1秒

  constructor() {
    this.setupEventHandlers();
  }

  // 接続管理
  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.token = token;
    const wsUrl = ENV.wsUrl;

    this.socket = io(wsUrl, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true
    });

    this.setupSocketEventListeners();
  }

  // ダッシュボード専用WebSocket接続
  connectToDashboard(): void {
    // 既存のWebSocket接続をチェック
    const existingWs = (this as any).dashboardWs;
    if (existingWs && existingWs.readyState === WebSocket.OPEN) {
      console.log('Dashboard WebSocket already connected');
      return;
    }

    const wsUrl = ENV.wsUrl;
    const wsEndpoint = `${wsUrl.replace('http', 'ws')}/api/v1/dashboard/ws/dashboard`;

    console.log('Connecting to dashboard WebSocket:', wsEndpoint);

    try {
      // WebSocket APIを直接使用（Socket.IOではなく）
      const dashboardWs = new WebSocket(wsEndpoint);

      dashboardWs.onopen = () => {
        console.log('✅ Dashboard WebSocket connected successfully');
        this.eventHandlers.onConnect?.();
      };

      dashboardWs.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📊 Dashboard WebSocket message received:', message);

          if (message.type === 'progress_update') {
            this.eventHandlers.onStudentProgressUpdate?.(message.data);
          } else if (message.type === 'cell_execution') {
            this.eventHandlers.onCellExecution?.(message.data);
          }
        } catch (error) {
          console.error('❌ Dashboard WebSocket message parse error:', error);
        }
      };

      dashboardWs.onclose = (event) => {
        console.log('🔌 Dashboard WebSocket disconnected, code:', event.code, 'reason:', event.reason);
        this.eventHandlers.onDisconnect?.();

        // 自動再接続（5秒後、接続が意図的に閉じられた場合を除く）
        if (event.code !== 1000) {
          setTimeout(() => {
            console.log('🔄 Attempting dashboard WebSocket reconnection...');
            this.connectToDashboard();
          }, 5000);
        }
      };

      dashboardWs.onerror = (error) => {
        console.error('❌ Dashboard WebSocket error:', error);
        this.eventHandlers.onError?.(error);
      };

      // Dashboard WebSocketをインスタンス変数に保存
      (this as any).dashboardWs = dashboardWs;
    } catch (error) {
      console.error('❌ Failed to create dashboard WebSocket:', error);
      this.eventHandlers.onError?.(error);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.token = null;
    this.reconnectAttempts = 0;
  }

  // イベントハンドラー設定
  setEventHandlers(handlers: WebSocketEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  private setupSocketEventListeners(): void {
    if (!this.socket) return;

    // 接続イベント
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.eventHandlers.onConnect?.();
    });

    // 切断イベント
    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.eventHandlers.onDisconnect?.();

      // 自動再接続（サーバー側の問題の場合）
      if (reason === 'io server disconnect') {
        this.attemptReconnect();
      }
    });

    // エラーイベント
    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.eventHandlers.onError?.(error);
      this.attemptReconnect();
    });

    // 講師ステータス更新イベント
    this.socket.on('instructor_status_update', (data: InstructorStatusUpdate) => {
      console.log('Instructor status update received:', data);
      this.eventHandlers.onInstructorStatusUpdate?.(data);
    });

    // 学生ヘルプ要請イベント
    this.socket.on('student_help_request', (data: StudentHelpRequestEvent) => {
      console.log('Student help request received:', data);
      this.eventHandlers.onStudentHelpRequest?.(data);
    });

    // 汎用メッセージイベント
    this.socket.on('message', (message: WebSocketMessage) => {
      console.log('WebSocket message received:', message);
      this.handleGenericMessage(message);
    });

    // セル実行イベント（進捗ダッシュボード用）
    this.socket.on('cell_execution', (data) => {
      console.log('Cell execution event received:', data);
      this.eventHandlers.onCellExecution?.(data);
    });

    // 学生進捗更新イベント
    this.socket.on('student_progress_update', (data) => {
      console.log('Student progress update received:', data);
      this.eventHandlers.onStudentProgressUpdate?.(data);
    });
  }

  private setupEventHandlers(): void {
    // デフォルトのイベントハンドラー
    this.eventHandlers = {
      onConnect: () => console.log('WebSocket service connected'),
      onDisconnect: () => console.log('WebSocket service disconnected'),
      onError: (error) => console.error('WebSocket service error:', error)
    };
  }

  private handleGenericMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'instructor_assignment':
        // 講師割り当て通知
        console.log('Instructor assignment:', message.data);
        break;
      case 'session_update':
        // セッション更新通知
        console.log('Session update:', message.data);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数バックオフ

    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);

    setTimeout(() => {
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  // メッセージ送信
  sendMessage(type: string, data: any): void {
    if (!this.socket?.connected) {
      console.warn('WebSocket not connected, cannot send message');
      return;
    }

    const message: WebSocketMessage = {
      type,
      data,
      timestamp: new Date().toISOString()
    };

    this.socket.emit('message', message);
  }

  // 講師ステータス更新送信
  sendStatusUpdate(statusUpdate: { instructor_id: number; status: InstructorStatus; timestamp: string }): void {
    this.sendMessage('instructor_status_update', statusUpdate);
  }

  // 講師位置更新送信
  sendLocationUpdate(locationUpdate: { instructor_id: number; location: { x: number; y: number; zone: string }; timestamp: string }): void {
    this.sendMessage('instructor_location_update', locationUpdate);
  }

  // 通知購読情報送信
  sendNotificationSubscription(subscriptionData: { instructor_id: number; subscription: any; settings: any }): void {
    this.sendMessage('notification_subscription', subscriptionData);
  }

  // ヘルプ要請応答送信
  sendHelpResponse(helpRequestId: number, response: 'accept' | 'decline'): void {
    this.sendMessage('help_response', {
      help_request_id: helpRequestId,
      response,
      timestamp: new Date().toISOString()
    });
  }

  // 接続状態確認
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // 接続状態取得
  getConnectionState(): string {
    if (!this.socket) return 'disconnected';
    return this.socket.connected ? 'connected' : 'disconnected';
  }
}

// シングルトンインスタンス
export const webSocketService = new WebSocketService();
export default webSocketService;
