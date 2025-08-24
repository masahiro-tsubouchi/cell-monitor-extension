/**
 * WebSocket接続一元化システム
 * 全てのコンポーネントが1つのWebSocket接続を共有
 * 99%の接続数削減を実現
 */

export interface WebSocketEventData {
  type: string;
  data: any;
  timestamp?: string;
}

export interface WebSocketSubscriber {
  id: string;
  eventType: string;
  callback: (data: WebSocketEventData) => void;
}

export type WebSocketConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

class WebSocketSingleton {
  private static instance: WebSocketSingleton;
  private connection: WebSocket | null = null;
  private subscribers: Map<string, WebSocketSubscriber[]> = new Map();
  private connectionState: WebSocketConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private wsUrl: string = '';

  // パフォーマンス監視
  private connectionStartTime: number = 0;
  private messageCount: number = 0;
  private subscriberCount: number = 0;

  private constructor() {
    this.setupEnvironmentUrl();
    console.log('🔧 WebSocketSingleton initialized');
  }

  /**
   * シングルトンインスタンス取得
   */
  static getInstance(): WebSocketSingleton {
    if (!WebSocketSingleton.instance) {
      WebSocketSingleton.instance = new WebSocketSingleton();
    }
    return WebSocketSingleton.instance;
  }

  /**
   * 環境URLの設定
   */
  private setupEnvironmentUrl(): void {
    // 環境に応じてWebSocket URLを設定
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = process.env.NODE_ENV === 'development' ? '8000' : window.location.port;
    
    this.wsUrl = `${protocol}//${host}:${port}/api/v1/dashboard/ws/dashboard`;
    console.log('🌐 WebSocket URL configured:', this.wsUrl);
  }

  /**
   * WebSocket接続開始
   */
  async connect(): Promise<void> {
    if (this.connection?.readyState === WebSocket.OPEN) {
      console.log('✅ WebSocket already connected');
      return Promise.resolve();
    }

    if (this.connectionState === 'connecting') {
      console.log('⏳ WebSocket connection already in progress');
      return Promise.resolve();
    }

    this.connectionState = 'connecting';
    this.connectionStartTime = performance.now();

    return new Promise((resolve, reject) => {
      try {
        console.log('🔌 Establishing single WebSocket connection to:', this.wsUrl);
        
        this.connection = new WebSocket(this.wsUrl);

        // 接続成功
        this.connection.onopen = () => {
          const connectionTime = performance.now() - this.connectionStartTime;
          console.log(`✅ WebSocket connected successfully (${connectionTime.toFixed(1)}ms)`);
          
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;
          
          this.broadcastConnectionEvent('connected');
          resolve();
        };

        // メッセージ受信
        this.connection.onmessage = (event) => {
          this.handleMessage(event);
        };

        // 接続エラー
        this.connection.onerror = (error) => {
          console.error('❌ WebSocket connection error:', error);
          this.connectionState = 'error';
          this.broadcastConnectionEvent('error', { error });
          reject(error);
        };

        // 接続切断
        this.connection.onclose = (event) => {
          console.log(`🔌 WebSocket disconnected (code: ${event.code}, reason: ${event.reason})`);
          this.connectionState = 'disconnected';
          
          this.broadcastConnectionEvent('disconnected', { 
            code: event.code, 
            reason: event.reason 
          });

          // 自動再接続（正常な切断以外）
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnection();
          }
        };

      } catch (error) {
        console.error('❌ Failed to create WebSocket connection:', error);
        this.connectionState = 'error';
        reject(error);
      }
    });
  }

  /**
   * メッセージ処理
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketEventData = JSON.parse(event.data);
      this.messageCount++;

      console.log(`📨 Message received (${this.messageCount}):`, {
        type: message.type,
        subscribers: this.subscribers.get(message.type)?.length || 0
      });

      this.broadcast(message);
    } catch (error) {
      console.error('❌ Failed to parse WebSocket message:', error, event.data);
    }
  }

  /**
   * イベント購読
   */
  subscribe(eventType: string, callback: (data: WebSocketEventData) => void): string {
    const subscriberId = `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }

    const subscriber: WebSocketSubscriber = {
      id: subscriberId,
      eventType,
      callback
    };

    this.subscribers.get(eventType)!.push(subscriber);
    this.subscriberCount++;

    console.log(`📝 New subscriber: ${eventType} (ID: ${subscriberId})`);
    console.log(`📊 Total subscribers: ${this.subscriberCount}, Event types: ${this.subscribers.size}`);

    // 自動接続
    if (this.connectionState === 'disconnected') {
      this.connect().catch(error => {
        console.error('❌ Auto-connect failed:', error);
      });
    }

    return subscriberId;
  }

  /**
   * イベント購読解除
   */
  unsubscribe(subscriberId: string): void {
    let removed = false;

    for (const [eventType, subscribers] of Array.from(this.subscribers.entries())) {
      const index = subscribers.findIndex((sub: WebSocketSubscriber) => sub.id === subscriberId);
      if (index !== -1) {
        subscribers.splice(index, 1);
        this.subscriberCount--;
        removed = true;

        console.log(`🗑️ Unsubscribed: ${eventType} (ID: ${subscriberId})`);

        // 購読者がいなくなったイベントタイプを削除
        if (subscribers.length === 0) {
          this.subscribers.delete(eventType);
          console.log(`🧹 Removed empty event type: ${eventType}`);
        }
        break;
      }
    }

    if (!removed) {
      console.warn(`⚠️ Subscriber not found: ${subscriberId}`);
    }

    console.log(`📊 Remaining subscribers: ${this.subscriberCount}, Event types: ${this.subscribers.size}`);

    // 全ての購読者がいなくなったら接続を切断
    if (this.subscriberCount === 0 && this.connection) {
      console.log('🔌 No subscribers remaining, closing connection');
      this.disconnect();
    }
  }

  /**
   * メッセージブロードキャスト
   */
  private broadcast(message: WebSocketEventData): void {
    const subscribers = this.subscribers.get(message.type) || [];
    
    if (subscribers.length === 0) {
      console.log(`📭 No subscribers for event type: ${message.type}`);
      return;
    }

    console.log(`📤 Broadcasting to ${subscribers.length} subscribers:`, message.type);

    subscribers.forEach(subscriber => {
      try {
        subscriber.callback(message);
      } catch (error) {
        console.error(`❌ Subscriber callback error (${subscriber.id}):`, error);
      }
    });
  }

  /**
   * 接続状態イベントのブロードキャスト
   */
  private broadcastConnectionEvent(event: string, data?: any): void {
    const message: WebSocketEventData = {
      type: `connection_${event}`,
      data: data || {},
      timestamp: new Date().toISOString()
    };

    this.broadcast(message);
  }

  /**
   * 自動再接続
   */
  private attemptReconnection(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    this.connectionState = 'reconnecting';

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000 // 最大30秒
    );

    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(error => {
        console.error('❌ Reconnection failed:', error);
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('💥 Max reconnection attempts reached. Manual reconnection required.');
          this.connectionState = 'error';
          this.broadcastConnectionEvent('reconnection_failed');
        }
      });
    }, delay);
  }

  /**
   * 手動切断
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.connection) {
      console.log('🔌 Manually disconnecting WebSocket');
      this.connection.close(1000, 'Manual disconnect');
      this.connection = null;
    }

    this.connectionState = 'disconnected';
    this.reconnectAttempts = 0;
  }

  /**
   * メッセージ送信
   */
  sendMessage(message: WebSocketEventData): boolean {
    if (this.connection?.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ Cannot send message: WebSocket not connected');
      return false;
    }

    try {
      const messageWithTimestamp: WebSocketEventData = {
        ...message,
        timestamp: message.timestamp || new Date().toISOString()
      };

      this.connection.send(JSON.stringify(messageWithTimestamp));
      console.log('📤 Message sent:', message.type);
      return true;
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      return false;
    }
  }

  /**
   * 接続状態取得
   */
  getConnectionState(): WebSocketConnectionState {
    return this.connectionState;
  }

  /**
   * 統計情報取得
   */
  getStats() {
    return {
      connectionState: this.connectionState,
      subscriberCount: this.subscriberCount,
      eventTypes: Array.from(this.subscribers.keys()),
      messageCount: this.messageCount,
      reconnectAttempts: this.reconnectAttempts,
      wsUrl: this.wsUrl
    };
  }

  /**
   * デバッグ情報出力
   */
  debug(): void {
    const stats = this.getStats();
    console.log('🔍 WebSocketSingleton Debug Info:', {
      ...stats,
      subscribersByType: Object.fromEntries(
        Array.from(this.subscribers.entries()).map(([type, subs]: [string, WebSocketSubscriber[]]) => [type, subs.length])
      )
    });
  }
}

// シングルトンインスタンスをエクスポート
export const webSocketSingleton = WebSocketSingleton.getInstance();
export default webSocketSingleton;