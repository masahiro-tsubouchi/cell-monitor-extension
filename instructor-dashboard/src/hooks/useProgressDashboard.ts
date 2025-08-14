/**
 * ProgressDashboard用の統合カスタムフック
 * 冗長なuseEffectとロジックを統合
 */

import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProgressDashboardStore } from '../stores/progressDashboardStore';
import { StudentActivity } from '../services/dashboardAPI';
import { ViewMode } from '../types/domain';
import {
  getInstructorSettings,
  updateViewMode,
  updateAutoRefresh,
  updateSelectedStudent,
} from '../utils/instructorStorage';
import webSocketService from '../services/websocket';
import { useDashboardErrorHandler } from './useErrorHandler';

interface UseProgressDashboardOptions {
  /**
   * 自動リフレッシュの設定
   */
  autoRefreshConfig?: {
    highFrequencyInterval: number; // 展開チーム有り時の更新間隔
    lowFrequencyInterval: number; // 展開チーム無し時の更新間隔
  };
  
  /**
   * WebSocket設定
   */
  webSocketConfig?: {
    enableWebSocket: boolean;
    enableLogging: boolean;
  };
}

const DEFAULT_CONFIG: Required<UseProgressDashboardOptions> = {
  autoRefreshConfig: {
    highFrequencyInterval: 5000, // 5秒
    lowFrequencyInterval: 15000, // 15秒
  },
  webSocketConfig: {
    enableWebSocket: true,
    enableLogging: true,
  },
};

export const useProgressDashboard = (options: UseProgressDashboardOptions = {}) => {
  const config = { ...DEFAULT_CONFIG, ...options };
  const navigate = useNavigate();
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { error, hasError, handleError, clearError } = useDashboardErrorHandler();

  // Zustand Store
  const {
    students,
    metrics,
    activityChart,
    isLoading,
    error: storeError,
    lastUpdated,
    autoRefresh,
    selectedStudent,
    refreshData,
    setAutoRefresh,
    selectStudent,
    updateStudentStatus,
    clearError: clearStoreError,
  } = useProgressDashboardStore();

  // 講師設定の初期化
  const initializeInstructorSettings = useCallback(() => {
    try {
      const settings = getInstructorSettings();
      setAutoRefresh(settings.autoRefresh);
      if (settings.selectedStudent) {
        const student = students.find(s => s.emailAddress === settings.selectedStudent);
        if (student) {
          selectStudent(student);
        }
      }
    } catch (err) {
      handleError(err, '講師設定初期化');
    }
  }, [students, setAutoRefresh, selectStudent, handleError]);

  // データ初期読み込み
  useEffect(() => {
    const initializeData = async () => {
      try {
        await refreshData();
        initializeInstructorSettings();
      } catch (err) {
        handleError(err, 'ダッシュボード初期化');
      }
    };

    initializeData();
  }, [refreshData, initializeInstructorSettings, handleError]);

  // WebSocket設定
  useEffect(() => {
    if (!config.webSocketConfig.enableWebSocket) return;

    const eventHandlers = {
      onConnect: () => {
        if (config.webSocketConfig.enableLogging) {
          console.log('Progress dashboard WebSocket connected');
        }
        clearError();
      },
      
      onDisconnect: () => {
        if (config.webSocketConfig.enableLogging) {
          console.log('Progress dashboard WebSocket disconnected');
        }
      },
      
      onStudentProgressUpdate: (data: StudentActivity) => {
        if (config.webSocketConfig.enableLogging) {
          console.log('Student progress update:', data);
        }
        
        updateStudentStatus(data.emailAddress, {
          userName: data.userName,
          currentNotebook: data.currentNotebook,
          lastActivity: data.lastActivity,
          status: data.status,
          cellExecutions: data.cellExecutions || 1,
          errorCount: data.errorCount,
        });
      },
      
      onCellExecution: (data: any) => {
        if (config.webSocketConfig.enableLogging) {
          console.log('Cell execution event:', data);
        }
        
        updateStudentStatus(data.emailAddress, {
          cellExecutions: data.cellExecutions || 1,
          lastActivity: '今',
          status: 'active' as const,
        });
      },
      
      onHelpRequest: (data: any) => {
        if (config.webSocketConfig.enableLogging) {
          console.log('Help request event:', data);
        }
        
        updateStudentStatus(data.emailAddress, {
          isRequestingHelp: true,
          lastActivity: '今',
          status: 'help' as any, // 後方互換性のため
        });
        
        // 即座に全体リフレッシュで精度確保
        setTimeout(() => refreshData(), 100);
      },
      
      onHelpResolved: (data: any) => {
        if (config.webSocketConfig.enableLogging) {
          console.log('Help resolved event:', data);
        }
        
        updateStudentStatus(data.emailAddress, {
          isRequestingHelp: false,
          lastActivity: '今',
        });
        
        // 即座に全体リフレッシュ
        setTimeout(() => refreshData(), 100);
      },
      
      onError: (error: any) => {
        handleError(error, 'WebSocket通信');
      },
    };

    webSocketService.setEventHandlers(eventHandlers);
    webSocketService.connectToDashboard();

    return () => {
      webSocketService.setEventHandlers({});
    };
  }, [
    config.webSocketConfig,
    updateStudentStatus,
    refreshData,
    handleError,
    clearError,
  ]);

  // スマート自動リフレッシュ
  const setupAutoRefresh = useCallback((expandedTeamsCount: number) => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    if (!autoRefresh) return;

    const updateInterval = expandedTeamsCount > 0
      ? config.autoRefreshConfig.highFrequencyInterval
      : config.autoRefreshConfig.lowFrequencyInterval;

    if (config.webSocketConfig.enableLogging) {
      console.log(
        `Smart refresh: ${expandedTeamsCount}チーム展開中 → ${updateInterval / 1000}秒間隔で更新`
      );
    }

    refreshIntervalRef.current = setInterval(async () => {
      try {
        await refreshData();
      } catch (err) {
        handleError(err, 'スマート自動リフレッシュ');
      }
    }, updateInterval);
  }, [autoRefresh, config, refreshData, handleError]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // アクションハンドラー
  const handleStudentClick = useCallback((student: StudentActivity) => {
    selectStudent(student);
    updateSelectedStudent(student.emailAddress);
    
    if (config.webSocketConfig.enableLogging) {
      console.log('Selected student:', student);
    }
  }, [selectStudent, config.webSocketConfig.enableLogging]);

  const handleRefresh = useCallback(async () => {
    try {
      await refreshData();
      clearError();
    } catch (err) {
      handleError(err, '手動リフレッシュ');
    }
  }, [refreshData, clearError, handleError]);

  const handleAutoRefreshToggle = useCallback((enabled: boolean) => {
    setAutoRefresh(enabled);
    updateAutoRefresh(enabled);
  }, [setAutoRefresh]);

  const handleViewModeChange = useCallback((newViewMode: ViewMode) => {
    updateViewMode(newViewMode);
  }, []);

  const handleViewStudentsList = useCallback(() => {
    navigate('/dashboard/students');
  }, [navigate]);

  const handleExpandedTeamsChange = useCallback((count: number) => {
    setupAutoRefresh(count);
  }, [setupAutoRefresh]);

  // エラー統合
  const combinedError = error || storeError;
  const combinedClearError = useCallback(() => {
    clearError();
    clearStoreError();
  }, [clearError, clearStoreError]);

  return {
    // データ
    students,
    metrics,
    activityChart,
    isLoading,
    error: combinedError,
    hasError: hasError || !!storeError,
    lastUpdated,
    autoRefresh,
    selectedStudent,

    // アクション
    handleStudentClick,
    handleRefresh,
    handleAutoRefreshToggle,
    handleViewModeChange,
    handleViewStudentsList,
    handleExpandedTeamsChange,
    clearError: combinedClearError,

    // 高度な機能
    setupAutoRefresh,
    refreshData,
  };
};

/**
 * 講師設定管理用の軽量フック
 */
export const useInstructorSettings = () => {
  const settings = getInstructorSettings();
  
  const updateSetting = useCallback((key: keyof typeof settings, value: any) => {
    switch (key) {
      case 'viewMode':
        updateViewMode(value);
        break;
      case 'autoRefresh':
        updateAutoRefresh(value);
        break;
      case 'selectedStudent':
        updateSelectedStudent(value);
        break;
      default:
        console.warn(`Unknown setting key: ${key}`);
    }
  }, []);

  return {
    settings,
    updateSetting,
  };
};

export default useProgressDashboard;