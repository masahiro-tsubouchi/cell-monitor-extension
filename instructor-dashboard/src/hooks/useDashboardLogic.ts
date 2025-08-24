/**
 * 共通ダッシュボードロジック
 * 従来版と最適化版で共通利用される処理を統一
 * WebSocket一元化システム統合版
 */

import { useCallback } from 'react';

export const useDashboardLogic = () => {

  // 自動更新ロジックの共通実装（変更なし）
  const setupAutoRefresh = useCallback((
    autoRefresh: boolean,
    expandedTeamsCount: number,
    refreshData: () => void,
    refreshIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>
  ) => {
    if (autoRefresh) {
      // 展開チームがある場合は高頻度 (5秒)、ない場合は低頻度 (15秒)
      const updateInterval = expandedTeamsCount > 0 ? 5000 : 15000;
      
      console.log(`🔄 Smart refresh: ${expandedTeamsCount}チーム展開中 → ${updateInterval/1000}秒間隔で更新`);

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

  // ユーザーインタラクション検出の共通実装（変更なし）
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
    setupAutoRefresh,
    setupUserInteractionDetection
  };
};