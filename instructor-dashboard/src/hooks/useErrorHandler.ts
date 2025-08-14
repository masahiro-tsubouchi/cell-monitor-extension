/**
 * 統一エラーハンドリングフック
 * 3箇所で重複していたエラー処理ロジックを統合
 */

import { useState, useCallback } from 'react';
import { MapErrorHandler } from '../utils/map/errorHandling';

interface ErrorState {
  error: string | null;
  isRetryable: boolean;
  recommendedAction?: string;
  context?: string;
}

interface UseErrorHandlerOptions {
  /**
   * エラー発生時の自動クリア時間（ミリ秒）
   * undefined の場合は手動クリアのみ
   */
  autoClearTimeout?: number;
  
  /**
   * エラーログレベル
   */
  logLevel?: 'error' | 'warn' | 'info';
  
  /**
   * エラー発生時のコールバック
   */
  onError?: (error: string, context: string) => void;
}

export const useErrorHandler = (options: UseErrorHandlerOptions = {}) => {
  const {
    autoClearTimeout,
    logLevel = 'error',
    onError,
  } = options;

  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isRetryable: false,
    recommendedAction: undefined,
    context: undefined,
  });

  const handleError = useCallback((
    err: unknown, 
    context: string, 
    additionalInfo?: any
  ) => {
    // MapErrorHandler を使用してエラーを分析
    const errorMessage = MapErrorHandler.getUserMessage(err, context);
    const isRetryable = MapErrorHandler.isRetryable(err);
    const recommendedAction = MapErrorHandler.getRecommendedAction(err);

    // ログ記録
    MapErrorHandler.logError(err, context, additionalInfo);
    
    // カスタムログレベルでの追加ログ
    if (logLevel === 'error') {
      console.error(`[${context}] ${errorMessage}`, { err, additionalInfo });
    } else if (logLevel === 'warn') {
      console.warn(`[${context}] ${errorMessage}`, { err, additionalInfo });
    } else {
      console.info(`[${context}] ${errorMessage}`, { err, additionalInfo });
    }

    // 状態更新
    setErrorState({
      error: errorMessage,
      isRetryable,
      recommendedAction,
      context,
    });

    // 外部コールバック呼び出し
    if (onError) {
      onError(errorMessage, context);
    }

    // 自動クリア設定
    if (autoClearTimeout && autoClearTimeout > 0) {
      setTimeout(() => {
        setErrorState(prev => prev.error === errorMessage ? {
          error: null,
          isRetryable: false,
          recommendedAction: undefined,
          context: undefined,
        } : prev);
      }, autoClearTimeout);
    }

    return errorMessage;
  }, [autoClearTimeout, logLevel, onError]);

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isRetryable: false,
      recommendedAction: undefined,
      context: undefined,
    });
  }, []);

  const retryLastAction = useCallback((retryFn?: () => void | Promise<void>) => {
    if (!errorState.isRetryable) {
      console.warn('Current error is not retryable');
      return Promise.resolve();
    }

    clearError();
    
    if (retryFn) {
      try {
        const result = retryFn();
        if (result instanceof Promise) {
          return result.catch((err) => {
            handleError(err, errorState.context || 'Retry operation');
            throw err;
          });
        }
        return Promise.resolve(result);
      } catch (err) {
        handleError(err, errorState.context || 'Retry operation');
        return Promise.reject(err);
      }
    }

    return Promise.resolve();
  }, [errorState.isRetryable, errorState.context, clearError, handleError]);

  const hasError = errorState.error !== null;

  return {
    // 状態
    error: errorState.error,
    hasError,
    isRetryable: errorState.isRetryable,
    recommendedAction: errorState.recommendedAction,
    context: errorState.context,
    
    // アクション
    handleError,
    clearError,
    retryLastAction,
  };
};

/**
 * 特定のコンテキスト向けのプリセットフック
 */

/**
 * ダッシュボード用エラーハンドラー
 */
export const useDashboardErrorHandler = () => {
  return useErrorHandler({
    autoClearTimeout: 10000, // 10秒で自動クリア
    logLevel: 'error',
    onError: (error, context) => {
      // ダッシュボード固有のエラー処理
      if (context.includes('refresh') || context.includes('データ取得')) {
        console.warn('Dashboard data refresh failed, using cached data');
      }
    },
  });
};

/**
 * MAP操作用エラーハンドラー
 */
export const useMapErrorHandler = () => {
  return useErrorHandler({
    autoClearTimeout: 8000, // 8秒で自動クリア
    logLevel: 'error',
    onError: (error, context) => {
      // MAP操作固有のエラー処理
      if (context.includes('upload') || context.includes('アップロード')) {
        console.warn('Map upload failed, check file format and size');
      }
    },
  });
};

/**
 * WebSocket用エラーハンドラー
 */
export const useWebSocketErrorHandler = () => {
  return useErrorHandler({
    autoClearTimeout: 5000, // 5秒で自動クリア
    logLevel: 'warn', // WebSocketエラーは警告レベル
    onError: (error, context) => {
      // WebSocket固有のエラー処理
      if (context.includes('connection') || context.includes('接続')) {
        console.info('WebSocket connection issue, will retry automatically');
      }
    },
  });
};

/**
 * API呼び出し用エラーハンドラー
 */
export const useApiErrorHandler = () => {
  return useErrorHandler({
    autoClearTimeout: 12000, // 12秒で自動クリア
    logLevel: 'error',
    onError: (error, context) => {
      // API固有のエラー処理
      if (error.includes('401') || error.includes('認証')) {
        console.warn('Authentication required, redirecting to login');
        // 認証エラー時の処理をここに追加
      }
    },
  });
};

export default useErrorHandler;