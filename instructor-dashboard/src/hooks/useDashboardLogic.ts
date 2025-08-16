/**
 * 共通ダッシュボードロジック
 * 従来版と最適化版で共通利用される処理を統一
 */

import { useCallback, useRef } from 'react';
import { StudentActivity } from '../services/dashboardAPI';
import webSocketService from '../services/websocket';

export const useDashboardLogic = () => {
  // WebSocketイベントハンドラーの共通実装
  const setupWebSocketHandlers = useCallback((
    updateStudentStatus: (emailAddress: string, updates: Partial<StudentActivity>) => void,
    refreshData: () => void
  ) => {
    return {
      onConnect: () => console.log('Dashboard WebSocket connected'),
      onDisconnect: () => console.log('Dashboard WebSocket disconnected'),
      
      onStudentProgressUpdate: (data: StudentActivity) => {
        console.log('Student progress update:', data);
        updateStudentStatus(data.emailAddress, {
          userName: data.userName,
          currentNotebook: data.currentNotebook,
          lastActivity: data.lastActivity,
          status: data.status,
          cellExecutions: (data.cellExecutions || 1),
          errorCount: data.errorCount
        });
      },
      
      onCellExecution: (data: any) => {
        console.log('Cell execution event:', data);
        updateStudentStatus(data.emailAddress, {
          cellExecutions: (data.cellExecutions || 1),
          lastActivity: '今',
          status: 'active' as const
        });
      },
      
      onHelpRequest: (data: any) => {
        console.log('Help request event:', data);
        updateStudentStatus(data.emailAddress, {
          isRequestingHelp: true,
          lastActivity: '今',
          status: 'help' as any
        });
        // 即座にフル更新で精度を確保
        setTimeout(() => refreshData(), 100);
      },
      
      onHelpResolved: (data: any) => {
        console.log('Help resolved event:', data);
        updateStudentStatus(data.emailAddress, {
          isRequestingHelp: false,
          lastActivity: '今'
        });
        // 即座にフル更新
        setTimeout(() => refreshData(), 100);
      },
      
      onError: (error: any) => console.error('Dashboard WebSocket error:', error)
    };
  }, []);

  // 自動更新ロジックの共通実装
  const setupAutoRefresh = useCallback((
    autoRefresh: boolean,
    expandedTeamsCount: number,
    refreshData: () => void,
    refreshIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>
  ) => {
    if (autoRefresh) {
      // 展開チームがある場合は高頻度 (5秒)、ない場合は低頻度 (15秒)
      const updateInterval = expandedTeamsCount > 0 ? 5000 : 15000;
      
      console.log(`Smart refresh: ${expandedTeamsCount}チーム展開中 → ${updateInterval/1000}秒間隔で更新`);

      refreshIntervalRef.current = setInterval(() => {
        refreshData();
      }, updateInterval);
    } else if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // WebSocket接続の初期化
  const initializeWebSocket = useCallback((eventHandlers: any) => {
    webSocketService.setEventHandlers(eventHandlers);
    webSocketService.connectToDashboard();

    return () => {
      // クリーンアップ
      webSocketService.setEventHandlers({});
    };
  }, []);

  // ユーザーインタラクション検出の共通実装
  const setupUserInteractionDetection = useCallback((
    markUserActive: () => void
  ) => {
    const handleUserInteraction = () => {
      markUserActive();
    };

    const events = ['mousedown', 'mouseup', 'scroll', 'keydown', 'touchstart'];
    
    events.forEach(eventName => {
      window.addEventListener(eventName, handleUserInteraction, { passive: true });
    });

    return () => {
      events.forEach(eventName => {
        window.removeEventListener(eventName, handleUserInteraction);
      });
    };
  }, []);

  return {
    setupWebSocketHandlers,
    setupAutoRefresh,
    initializeWebSocket,
    setupUserInteractionDetection
  };
};