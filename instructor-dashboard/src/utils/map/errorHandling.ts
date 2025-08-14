/**
 * MAP機能統一エラーハンドリング
 * エラーの分類、メッセージ統一、ログ記録を担当
 */

export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  PERMISSION = 'PERMISSION',
  SERVER = 'SERVER',
  FILE = 'FILE',
  CONFLICT = 'CONFLICT',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ErrorInfo {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  retryable: boolean;
  action?: string;
}

/**
 * エラー分類とメッセージ生成
 */
export class MapErrorHandler {
  private static errorPatterns: Record<string, ErrorInfo> = {
    // ネットワークエラー
    'Failed to fetch': {
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.HIGH,
      message: 'Network connection failed',
      userMessage: 'ネットワーク接続エラー。インターネット接続を確認してください。',
      retryable: true,
      action: '再接続'
    },
    'NetworkError': {
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.HIGH,
      message: 'Network error occurred',
      userMessage: 'ネットワークエラーが発生しました。接続を確認してください。',
      retryable: true,
      action: '再試行'
    },

    // HTTP ステータスコードエラー
    '400': {
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.MEDIUM,
      message: 'Bad request - validation failed',
      userMessage: 'リクエストが無効です。入力内容を確認してください。',
      retryable: false
    },
    '401': {
      type: ErrorType.PERMISSION,
      severity: ErrorSeverity.HIGH,
      message: 'Unauthorized access',
      userMessage: '認証が必要です。ログインしてください。',
      retryable: false,
      action: 'ログイン'
    },
    '403': {
      type: ErrorType.PERMISSION,
      severity: ErrorSeverity.HIGH,
      message: 'Permission denied',
      userMessage: '権限がありません。管理者にお問い合わせください。',
      retryable: false
    },
    '404': {
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.MEDIUM,
      message: 'Resource not found',
      userMessage: 'データが見つかりません。ページを更新してください。',
      retryable: true,
      action: '更新'
    },
    '409': {
      type: ErrorType.CONFLICT,
      severity: ErrorSeverity.MEDIUM,
      message: 'Resource conflict',
      userMessage: '他のユーザーが同時に編集しています。最新データを確認してください。',
      retryable: true,
      action: '最新データ取得'
    },
    '413': {
      type: ErrorType.FILE,
      severity: ErrorSeverity.MEDIUM,
      message: 'File too large',
      userMessage: 'ファイルサイズが大きすぎます。10MB以下の画像を選択してください。',
      retryable: false
    },
    '415': {
      type: ErrorType.FILE,
      severity: ErrorSeverity.MEDIUM,
      message: 'Unsupported file type',
      userMessage: 'サポートされていないファイル形式です。JPG、PNG、GIF形式を使用してください。',
      retryable: false
    },
    '500': {
      type: ErrorType.SERVER,
      severity: ErrorSeverity.HIGH,
      message: 'Internal server error',
      userMessage: 'サーバーエラーが発生しました。しばらく時間をおいて再試行してください。',
      retryable: true,
      action: '再試行'
    },
    '502': {
      type: ErrorType.SERVER,
      severity: ErrorSeverity.HIGH,
      message: 'Bad gateway',
      userMessage: 'サーバーとの通信に問題があります。しばらく時間をおいて再試行してください。',
      retryable: true,
      action: '再試行'
    },
    '503': {
      type: ErrorType.SERVER,
      severity: ErrorSeverity.CRITICAL,
      message: 'Service unavailable',
      userMessage: 'サービスが一時的に利用できません。しばらく時間をおいて再試行してください。',
      retryable: true,
      action: '再試行'
    }
  };

  /**
   * エラーを分析して適切なエラー情報を返す
   */
  static analyzeError(error: any): ErrorInfo {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';

    // パターンマッチングでエラータイプを特定
    for (const [pattern, errorInfo] of Object.entries(this.errorPatterns)) {
      if (errorMessage.includes(pattern)) {
        return {
          ...errorInfo,
          message: `${errorInfo.message}: ${errorMessage}`
        };
      }
    }

    // デフォルトの未知エラー
    return {
      type: ErrorType.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      message: errorMessage,
      userMessage: '予期しないエラーが発生しました。ページを更新して再試行してください。',
      retryable: true,
      action: '更新'
    };
  }

  /**
   * エラーログの記録
   */
  static logError(error: any, context: string, additionalInfo?: any): void {
    const errorInfo = this.analyzeError(error);

    const logData = {
      timestamp: new Date().toISOString(),
      context,
      type: errorInfo.type,
      severity: errorInfo.severity,
      message: errorInfo.message,
      userMessage: errorInfo.userMessage,
      originalError: error,
      additionalInfo,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // 開発環境ではコンソールに詳細ログ
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 MAP Error [${errorInfo.severity}] - ${context}`);
      console.error('Error Info:', errorInfo);
      console.error('Original Error:', error);
      console.log('Additional Info:', additionalInfo);
      console.groupEnd();
    }

    // 本番環境では外部ログサービスに送信（将来実装）
    if (process.env.NODE_ENV === 'production' && errorInfo.severity === ErrorSeverity.CRITICAL) {
      // TODO: 外部ログサービス（Sentry, LogRocket等）への送信
      console.error('Critical error logged:', logData);
    }

    // ブラウザの開発者ツールにも記録
    console.error(`[${context}] ${errorInfo.userMessage}`, logData);
  }

  /**
   * ユーザー向けエラーメッセージの生成
   */
  static getUserMessage(error: any, context?: string): string {
    const errorInfo = this.analyzeError(error);

    if (context) {
      return `${context}: ${errorInfo.userMessage}`;
    }

    return errorInfo.userMessage;
  }

  /**
   * リトライ可能かどうかの判定
   */
  static isRetryable(error: any): boolean {
    const errorInfo = this.analyzeError(error);
    return errorInfo.retryable;
  }

  /**
   * 推奨アクションの取得
   */
  static getRecommendedAction(error: any): string | undefined {
    const errorInfo = this.analyzeError(error);
    return errorInfo.action;
  }

  /**
   * エラーの重要度を取得
   */
  static getSeverity(error: any): ErrorSeverity {
    const errorInfo = this.analyzeError(error);
    return errorInfo.severity;
  }
}

/**
 * MAP機能専用のエラーハンドリングフック
 */
export const useMapErrorHandler = () => {
  const handleError = (error: any, context: string, additionalInfo?: any) => {
    MapErrorHandler.logError(error, context, additionalInfo);
    return MapErrorHandler.getUserMessage(error);
  };

  const isRetryable = (error: any) => {
    return MapErrorHandler.isRetryable(error);
  };

  const getRecommendedAction = (error: any) => {
    return MapErrorHandler.getRecommendedAction(error);
  };

  return {
    handleError,
    isRetryable,
    getRecommendedAction
  };
};

/**
 * 特定のMAP機能用エラーメッセージ
 */
export const MapErrorMessages = {
  UPLOAD_FAILED: 'MAP画像のアップロードに失敗しました',
  LOAD_FAILED: 'MAPデータの読み込みに失敗しました',
  SAVE_FAILED: 'チーム配置の保存に失敗しました',
  DELETE_FAILED: 'MAPの削除に失敗しました',
  POSITION_UPDATE_FAILED: 'チーム位置の更新に失敗しました',
  VALIDATION_FAILED: 'ファイルの検証に失敗しました',
  PERMISSION_DENIED: 'MAP操作の権限がありません',
  CONCURRENT_EDIT: '他のユーザーが同時編集しています'
} as const;

export default MapErrorHandler;
