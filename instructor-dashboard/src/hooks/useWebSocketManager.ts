/**
 * WebSocketSingleton統合用Reactフック
 * 既存のWebSocket利用を段階的に置き換え
 */

import { useEffect, useCallback, useRef, useMemo } from 'react';
import { webSocketSingleton, WebSocketEventData } from '../services/WebSocketSingleton';
import { StudentActivity } from '../services/dashboardAPI';

export interface WebSocketManagerConfig {
  // 学生進捗更新ハンドラー
  onStudentProgressUpdate?: (data: StudentActivity) => void;
  // セル実行イベントハンドラー
  onCellExecution?: (data: any) => void;
  // ヘルプ要請ハンドラー
  onHelpRequest?: (data: any) => void;
  // ヘルプ解決ハンドラー
  onHelpResolved?: (data: any) => void;
  // 接続状態変化ハンドラー
  onConnectionChange?: (state: string) => void;
  // エラーハンドラー
  onError?: (error: any) => void;
  // 汎用メッセージハンドラー
  onMessage?: (data: WebSocketEventData) => void;
}

export const useWebSocketManager = (config: WebSocketManagerConfig = {}) => {
  const subscriberIdsRef = useRef<string[]>([]);
  const configRef = useRef(config);
  configRef.current = config;

  // 接続状態を取得
  const connectionState = webSocketSingleton.getConnectionState();
  
  // 統計情報を取得
  const stats = useMemo(() => webSocketSingleton.getStats(), []);

  // メッセージハンドラーを作成
  const createMessageHandler = useCallback((eventType: string, handler?: (data: any) => void) => {
    return (eventData: WebSocketEventData) => {
      console.log(`🎯 useWebSocketManager: ${eventType} event received`, eventData);
      
      if (handler && eventData.data) {
        try {
          handler(eventData.data);
        } catch (error) {
          console.error(`❌ Error in ${eventType} handler:`, error);
          configRef.current.onError?.(error);
        }
      }
    };
  }, []);

  // WebSocket接続と購読設定
  useEffect(() => {
    console.log('🔌 useWebSocketManager: Setting up WebSocket subscriptions');

    // 購読者ID配列をクリア
    subscriberIdsRef.current = [];

    // 1. 学生進捗更新の購読
    if (configRef.current.onStudentProgressUpdate) {
      const progressUpdateId = webSocketSingleton.subscribe(
        'progress_update',
        createMessageHandler('progress_update', configRef.current.onStudentProgressUpdate)
      );
      subscriberIdsRef.current.push(progressUpdateId);
    }

    // 2. セル実行イベントの購読
    if (configRef.current.onCellExecution) {
      const cellExecutionId = webSocketSingleton.subscribe(
        'cell_execution',
        createMessageHandler('cell_execution', configRef.current.onCellExecution)
      );
      subscriberIdsRef.current.push(cellExecutionId);
    }

    // 3. ヘルプ要請イベントの購読
    if (configRef.current.onHelpRequest) {
      const helpRequestId = webSocketSingleton.subscribe(
        'help_request',
        createMessageHandler('help_request', configRef.current.onHelpRequest)
      );
      subscriberIdsRef.current.push(helpRequestId);
    }

    // 4. ヘルプ解決イベントの購読
    if (configRef.current.onHelpResolved) {
      const helpResolvedId = webSocketSingleton.subscribe(
        'help_resolved',
        createMessageHandler('help_resolved', configRef.current.onHelpResolved)
      );
      subscriberIdsRef.current.push(helpResolvedId);
    }

    // 5. 接続状態イベントの購読
    if (configRef.current.onConnectionChange) {
      const connectionIds = [
        webSocketSingleton.subscribe('connection_connected', (data) => {
          configRef.current.onConnectionChange?.('connected');
        }),
        webSocketSingleton.subscribe('connection_disconnected', (data) => {
          configRef.current.onConnectionChange?.('disconnected');
        }),
        webSocketSingleton.subscribe('connection_error', (data) => {
          configRef.current.onConnectionChange?.('error');
          configRef.current.onError?.(data.data?.error);
        }),
        webSocketSingleton.subscribe('connection_reconnecting', (data) => {
          configRef.current.onConnectionChange?.('reconnecting');
        }),
        webSocketSingleton.subscribe('connection_reconnection_failed', (data) => {
          configRef.current.onConnectionChange?.('error');
          configRef.current.onError?.(new Error('Reconnection failed'));
        })
      ];
      subscriberIdsRef.current.push(...connectionIds);
    }

    // 6. 汎用メッセージハンドラーの購読（任意）
    if (configRef.current.onMessage) {
      // 全てのメッセージタイプを購読する特別なハンドラー
      const allMessageTypes = ['progress_update', 'cell_execution', 'help_request', 'help_resolved', 'delta_update', 'system_alert'];
      
      const genericMessageIds = allMessageTypes.map(messageType =>
        webSocketSingleton.subscribe(messageType, configRef.current.onMessage!)
      );
      subscriberIdsRef.current.push(...genericMessageIds);
    }

    console.log(`📊 useWebSocketManager: Set up ${subscriberIdsRef.current.length} subscriptions`);

    // WebSocket接続を開始（必要な場合のみ）
    webSocketSingleton.connect().catch(error => {
      console.error('❌ useWebSocketManager: Failed to connect WebSocket:', error);
      configRef.current.onError?.(error);
    });

    // クリーンアップ関数
    return () => {
      console.log('🧹 useWebSocketManager: Cleaning up subscriptions');
      subscriberIdsRef.current.forEach(subscriberId => {
        webSocketSingleton.unsubscribe(subscriberId);
      });
      subscriberIdsRef.current = [];
    };
  }, [createMessageHandler]); // createMessageHandlerを依存配列に追加

  // メッセージ送信機能
  const sendMessage = useCallback((type: string, data: any) => {
    const success = webSocketSingleton.sendMessage({ type, data });
    if (!success) {
      console.warn('⚠️ useWebSocketManager: Failed to send message - WebSocket not connected');
      configRef.current.onError?.(new Error('WebSocket not connected'));
    }
    return success;
  }, []);

  // 手動接続機能
  const connect = useCallback(async () => {
    try {
      await webSocketSingleton.connect();
      console.log('✅ useWebSocketManager: Manual connection successful');
    } catch (error) {
      console.error('❌ useWebSocketManager: Manual connection failed:', error);
      configRef.current.onError?.(error);
      throw error;
    }
  }, []);

  // 手動切断機能
  const disconnect = useCallback(() => {
    webSocketSingleton.disconnect();
    console.log('🔌 useWebSocketManager: Manual disconnect');
  }, []);

  // デバッグ情報表示
  const debug = useCallback(() => {
    webSocketSingleton.debug();
  }, []);

  // 統計情報の再取得
  const refreshStats = useCallback(() => {
    return webSocketSingleton.getStats();
  }, []);

  return {
    // 接続状態
    connectionState,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    isReconnecting: connectionState === 'reconnecting',
    hasError: connectionState === 'error',
    
    // 統計情報
    stats,
    subscriberCount: stats.subscriberCount,
    messageCount: stats.messageCount,
    eventTypes: stats.eventTypes,
    
    // 制御機能
    sendMessage,
    connect,
    disconnect,
    debug,
    refreshStats,
    
    // 便利な状態確認
    isHealthy: connectionState === 'connected' && stats.subscriberCount > 0
  };
};

export default useWebSocketManager;