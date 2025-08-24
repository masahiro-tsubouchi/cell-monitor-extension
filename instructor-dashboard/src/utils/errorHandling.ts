/**
 * Advanced Error Handling System
 * Phase 3: 型安全なエラーハンドリング実装
 */

import { z } from 'zod';

// ✅ エラー重要度
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// ✅ エラーカテゴリ
export type ErrorCategory = 
  | 'validation' 
  | 'network' 
  | 'authentication' 
  | 'authorization' 
  | 'business_logic' 
  | 'system' 
  | 'ui' 
  | 'performance';

// ✅ ベースドメインエラー
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly severity: ErrorSeverity;
  abstract readonly category: ErrorCategory;
  readonly timestamp: Date;
  readonly context: Record<string, unknown>;
  readonly retryable: boolean;
  readonly userMessage: string;

  constructor(
    message: string,
    context: Record<string, unknown> = {},
    retryable = false,
    userMessage?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.context = context;
    this.retryable = retryable;
    this.userMessage = userMessage || this.getDefaultUserMessage();
    
    // スタックトレースを正しく設定
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  protected abstract getDefaultUserMessage(): string;

  // エラー詳細情報
  getDetails(): {
    code: string;
    severity: ErrorSeverity;
    category: ErrorCategory;
    timestamp: Date;
    context: Record<string, unknown>;
    retryable: boolean;
    userMessage: string;
    stackTrace?: string;
  } {
    return {
      code: this.code,
      severity: this.severity,
      category: this.category,
      timestamp: this.timestamp,
      context: this.context,
      retryable: this.retryable,
      userMessage: this.userMessage,
      stackTrace: this.stack
    };
  }

  // JSON シリアライゼーション
  toJSON() {
    return {
      ...this.getDetails(),
      message: this.message
    };
  }
}

// ✅ バリデーションエラー
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly severity: ErrorSeverity = 'medium';
  readonly category: ErrorCategory = 'validation';

  constructor(
    public readonly validationErrors: z.ZodError,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Validation failed: ${validationErrors.errors.map(e => e.message).join(', ')}`,
      context
    );
  }

  protected getDefaultUserMessage(): string {
    return '入力データに問題があります。正しい形式で入力してください。';
  }

  getFieldErrors(): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    this.validationErrors.errors.forEach(error => {
      const path = error.path.join('.');
      if (!errors[path]) errors[path] = [];
      errors[path].push(error.message);
    });
    return errors;
  }
}

// ✅ ネットワークエラー
export class NetworkError extends DomainError {
  readonly code = 'NETWORK_ERROR';
  readonly severity: ErrorSeverity = 'high';
  readonly category: ErrorCategory = 'network';

  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly endpoint?: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, { statusCode, endpoint, ...context }, true);
  }

  protected getDefaultUserMessage(): string {
    if (this.statusCode === 404) {
      return 'リクエストされたデータが見つかりませんでした。';
    }
    if (this.statusCode === 500) {
      return 'サーバーでエラーが発生しました。しばらく待ってから再試行してください。';
    }
    if (this.statusCode === 403) {
      return 'このリソースへのアクセス権限がありません。';
    }
    return 'ネットワークエラーが発生しました。接続を確認してください。';
  }
}

// ✅ 認証エラー
export class AuthenticationError extends DomainError {
  readonly code = 'AUTHENTICATION_ERROR';
  readonly severity: ErrorSeverity = 'high';
  readonly category: ErrorCategory = 'authentication';

  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, context);
  }

  protected getDefaultUserMessage(): string {
    return 'ログインが必要です。再度ログインしてください。';
  }
}

// ✅ 認可エラー
export class AuthorizationError extends DomainError {
  readonly code = 'AUTHORIZATION_ERROR';
  readonly severity: ErrorSeverity = 'medium';
  readonly category: ErrorCategory = 'authorization';

  constructor(
    message: string,
    public readonly requiredPermission?: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, { requiredPermission, ...context });
  }

  protected getDefaultUserMessage(): string {
    return 'この操作を実行する権限がありません。';
  }
}

// ✅ ビジネスロジックエラー
export class BusinessLogicError extends DomainError {
  readonly code = 'BUSINESS_LOGIC_ERROR';
  readonly severity: ErrorSeverity = 'medium';
  readonly category: ErrorCategory = 'business_logic';

  constructor(
    message: string,
    public readonly businessRule: string,
    context: Record<string, unknown> = {},
    userMessage?: string
  ) {
    super(message, { businessRule, ...context }, false, userMessage);
  }

  protected getDefaultUserMessage(): string {
    return 'この操作は現在実行できません。';
  }
}

// ✅ システムエラー
export class SystemError extends DomainError {
  readonly code = 'SYSTEM_ERROR';
  readonly severity: ErrorSeverity = 'critical';
  readonly category: ErrorCategory = 'system';

  constructor(
    message: string,
    public readonly systemComponent: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, { systemComponent, ...context }, true);
  }

  protected getDefaultUserMessage(): string {
    return 'システムエラーが発生しました。システム管理者にお問い合わせください。';
  }
}

// ✅ UIエラー
export class UIError extends DomainError {
  readonly code = 'UI_ERROR';
  readonly severity: ErrorSeverity = 'low';
  readonly category: ErrorCategory = 'ui';

  constructor(
    message: string,
    public readonly component: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, { component, ...context });
  }

  protected getDefaultUserMessage(): string {
    return '画面の表示に問題が発生しました。ページを再読み込みしてください。';
  }
}

// ✅ パフォーマンスエラー
export class PerformanceError extends DomainError {
  readonly code = 'PERFORMANCE_ERROR';
  readonly severity: ErrorSeverity = 'medium';
  readonly category: ErrorCategory = 'performance';

  constructor(
    message: string,
    public readonly operation: string,
    public readonly duration: number,
    public readonly threshold: number,
    context: Record<string, unknown> = {}
  ) {
    super(message, { operation, duration, threshold, ...context });
  }

  protected getDefaultUserMessage(): string {
    return '処理に時間がかかっています。しばらくお待ちください。';
  }
}

// ✅ エラーレポーティングサービス
export interface ErrorReportingService {
  captureException(error: Error, context?: Record<string, unknown>): void;
  captureMessage(message: string, level: ErrorSeverity, context?: Record<string, unknown>): void;
  setUser(user: { id: string; email?: string; username?: string }): void;
  setTag(key: string, value: string): void;
  setContext(key: string, context: Record<string, unknown>): void;
}

// ✅ コンソールベースの実装（開発用）
class ConsoleErrorReportingService implements ErrorReportingService {
  private user: { id: string; email?: string; username?: string } | null = null;
  private tags: Record<string, string> = {};
  private contexts: Record<string, Record<string, unknown>> = {};

  captureException(error: Error, context: Record<string, unknown> = {}): void {
    console.group(`🚨 Error Report: ${error.name}`);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    if (error instanceof DomainError) {
      console.table(error.getDetails());
    }
    
    if (this.user) {
      console.log('User:', this.user);
    }
    
    if (Object.keys(this.tags).length > 0) {
      console.log('Tags:', this.tags);
    }
    
    if (Object.keys(context).length > 0) {
      console.log('Context:', context);
    }
    
    if (Object.keys(this.contexts).length > 0) {
      console.log('Global Contexts:', this.contexts);
    }
    
    console.groupEnd();
  }

  captureMessage(
    message: string, 
    level: ErrorSeverity, 
    context: Record<string, unknown> = {}
  ): void {
    const levelEmoji = {
      low: '💙',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };
    
    console.log(`${levelEmoji[level]} ${level.toUpperCase()}: ${message}`, context);
  }

  setUser(user: { id: string; email?: string; username?: string }): void {
    this.user = user;
  }

  setTag(key: string, value: string): void {
    this.tags[key] = value;
  }

  setContext(key: string, context: Record<string, unknown>): void {
    this.contexts[key] = context;
  }
}

// ✅ Sentry実装（プロダクション用）
// TODO: Sentryパッケージを追加後に実装
class SentryErrorReportingService implements ErrorReportingService {
  captureException(error: Error, context?: Record<string, unknown>): void {
    // Sentry実装
    console.log('TODO: Sentry.captureException', error, context);
  }

  captureMessage(message: string, level: ErrorSeverity, context?: Record<string, unknown>): void {
    // Sentry実装
    console.log('TODO: Sentry.captureMessage', message, level, context);
  }

  setUser(user: { id: string; email?: string; username?: string }): void {
    // Sentry実装
    console.log('TODO: Sentry.setUser', user);
  }

  setTag(key: string, value: string): void {
    // Sentry実装
    console.log('TODO: Sentry.setTag', key, value);
  }

  setContext(key: string, context: Record<string, unknown>): void {
    // Sentry実装
    console.log('TODO: Sentry.setContext', key, context);
  }
}

// ✅ グローバルエラーレポーティングサービス
export const errorReportingService: ErrorReportingService = 
  process.env.NODE_ENV === 'production' 
    ? new SentryErrorReportingService()
    : new ConsoleErrorReportingService();

// ✅ エラーハンドリングユーティリティ
export const handleError = (
  error: unknown,
  context: string = 'Unknown',
  additionalContext: Record<string, unknown> = {}
): DomainError => {
  let domainError: DomainError;

  if (error instanceof DomainError) {
    domainError = error;
  } else if (error instanceof z.ZodError) {
    domainError = new ValidationError(error, additionalContext);
  } else if (error instanceof Error) {
    if (error.name === 'TypeError') {
      domainError = new SystemError(error.message, 'JavaScript Runtime', additionalContext);
    } else if (error.message.includes('fetch')) {
      domainError = new NetworkError(error.message, undefined, undefined, additionalContext);
    } else {
      domainError = new SystemError(error.message, 'Unknown', additionalContext);
    }
  } else {
    domainError = new SystemError(
      `Unknown error: ${String(error)}`,
      'Unknown',
      additionalContext
    );
  }

  // エラーレポーティング
  errorReportingService.captureException(domainError, {
    context,
    ...additionalContext
  });

  return domainError;
};

// ✅ 非同期操作のエラーハンドリング
export const safeAsync = async <T>(
  operation: () => Promise<T>,
  context: string = 'Async Operation',
  fallback?: T
): Promise<{ success: true; data: T } | { success: false; error: DomainError; data?: T }> => {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const domainError = handleError(error, context);
    return { 
      success: false, 
      error: domainError, 
      data: fallback 
    };
  }
};

// ✅ 同期操作のエラーハンドリング
export const safeSync = <T>(
  operation: () => T,
  context: string = 'Sync Operation',
  fallback?: T
): { success: true; data: T } | { success: false; error: DomainError; data?: T } => {
  try {
    const data = operation();
    return { success: true, data };
  } catch (error) {
    const domainError = handleError(error, context);
    return { 
      success: false, 
      error: domainError, 
      data: fallback 
    };
  }
};

// ✅ リトライ機能
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000,
  context: string = 'Retry Operation'
): Promise<T> => {
  let lastError: DomainError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = handleError(error, `${context} (attempt ${attempt})`);
      
      if (!lastError.retryable || attempt === maxAttempts) {
        throw lastError;
      }
      
      // 指数バックオフ
      const backoffDelay = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  throw new Error(lastError?.message || 'リトライ処理が失敗しました');
};

// ✅ エラー境界コンポーネント用のヘルパー
export const createErrorInfo = (error: Error, errorInfo: React.ErrorInfo) => ({
  error: error instanceof DomainError ? error : handleError(error, 'React Error Boundary'),
  componentStack: errorInfo.componentStack,
  timestamp: new Date(),
  userAgent: navigator.userAgent,
  url: window.location.href
});

// ✅ グローバルエラーハンドラー設定
export const setupGlobalErrorHandlers = () => {
  // 未処理のPromise rejection
  window.addEventListener('unhandledrejection', (event) => {
    const error = handleError(event.reason, 'Unhandled Promise Rejection');
    console.error('Unhandled Promise Rejection:', error);
    event.preventDefault();
  });

  // 未処理のJavaScriptエラー
  window.addEventListener('error', (event) => {
    const error = handleError(event.error || event.message, 'Global Error Handler');
    console.error('Global Error:', error);
  });
};