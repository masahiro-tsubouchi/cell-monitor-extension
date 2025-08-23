/**
 * 接続状態管理サービス
 * サーバー接続状態の監視と表示
 */

export interface ConnectionInfo {
  state: 'online' | 'offline' | 'error' | 'checking';
  lastSuccessful: Date | null;
  isOnline: boolean;
}

export class ConnectionManager {
  private connectionState: 'online' | 'offline' | 'error' | 'checking' = 'checking';
  private lastSuccessfulConnection: Date | null = null;
  private healthCheckInterval: number | null = null;
  private serverUrl: string;
  private onlineListener: () => void;
  private offlineListener: () => void;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
    this.onlineListener = () => this.handleOnlineEvent();
    this.offlineListener = () => this.handleOfflineEvent();
    this.setupConnectionMonitoring();
  }

  /**
   * 接続監視の初期化
   */
  private setupConnectionMonitoring(): void {
    // ブラウザオンライン状態の監視
    window.addEventListener('online', this.onlineListener);
    window.addEventListener('offline', this.offlineListener);
    
    // 定期ヘルスチェック（30秒間隔）
    this.healthCheckInterval = setInterval(() => {
      if (navigator.onLine) {
        this.checkServerConnection();
      }
    }, 30000);
    
    // 初回チェック
    this.checkServerConnection();
  }

  /**
   * オンラインイベント処理
   */
  private handleOnlineEvent(): void {
    this.checkServerConnection();
  }

  /**
   * オフラインイベント処理
   */
  private handleOfflineEvent(): void {
    this.updateConnectionState('offline');
  }

  /**
   * サーバー接続チェック
   */
  async checkServerConnection(): Promise<boolean> {
    if (!navigator.onLine) {
      this.updateConnectionState('offline');
      return false;
    }

    this.updateConnectionState('checking');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.serverUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        this.lastSuccessfulConnection = new Date();
        this.updateConnectionState('online');
        return true;
      } else {
        this.updateConnectionState('error');
        return false;
      }
    } catch (error) {
      this.updateConnectionState('error');
      return false;
    }
  }

  /**
   * 接続状態の更新とUI通知
   */
  private updateConnectionState(newState: typeof this.connectionState): void {
    if (this.connectionState !== newState) {
      this.connectionState = newState;
      this.notifyStateChange(newState);
    }
  }

  /**
   * UI更新通知
   */
  private notifyStateChange(state: typeof this.connectionState): void {
    const statusMessages = {
      online: 'サーバー接続中',
      offline: 'オフライン（データ送信停止中）',
      error: 'サーバー接続エラー',
      checking: '接続確認中...'
    };
    
    const statusColors = {
      online: '#28a745',
      offline: '#6c757d', 
      error: '#dc3545',
      checking: '#ffc107'
    };

    // カスタムイベントで状態変更を通知
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('cellmonitor-connection-change', {
        detail: { 
          state, 
          message: statusMessages[state],
          color: statusColors[state],
          timestamp: new Date().toISOString()
        }
      }));
    }
  }

  /**
   * データ送信可能性チェック
   */
  canSendData(): boolean {
    return this.connectionState === 'online';
  }

  /**
   * 接続情報取得
   */
  getConnectionInfo(): ConnectionInfo {
    return {
      state: this.connectionState,
      lastSuccessful: this.lastSuccessfulConnection,
      isOnline: navigator.onLine
    };
  }

  /**
   * リソース解放
   */
  dispose(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    window.removeEventListener('online', this.onlineListener);
    window.removeEventListener('offline', this.offlineListener);
  }
}