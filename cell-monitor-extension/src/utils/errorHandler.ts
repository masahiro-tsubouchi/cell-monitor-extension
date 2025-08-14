/**
 * Error Handling Utilities for Cell Monitor Extension
 * Provides centralized error handling, reporting, and user-friendly messages
 */

import { Notification } from '@jupyterlab/apputils';
import { createLogger } from './logger';

const logger = createLogger('ErrorHandler');

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error categories for better classification
 */
export enum ErrorCategory {
  NETWORK = 'network',
  SETTINGS = 'settings',
  CELL_PROCESSING = 'cell_processing',
  UI = 'ui',
  DATA_TRANSMISSION = 'data_transmission',
  INITIALIZATION = 'initialization'
}

/**
 * Structured error information
 */
export interface ErrorInfo {
  error: Error;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context?: string;
  userMessage?: string;
  shouldNotifyUser?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Error handler configuration
 */
interface ErrorHandlerConfig {
  showNotifications: boolean;
  logToConsole: boolean;
  reportToServer: boolean;
}

class ErrorHandler {
  private config: ErrorHandlerConfig = {
    showNotifications: true,
    logToConsole: true,
    reportToServer: false
  };

  /**
   * Update error handler configuration
   */
  configure(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Main error handling method
   */
  handle(errorInfo: ErrorInfo): void {
    const { error, category, severity, context, userMessage, shouldNotifyUser, metadata } = errorInfo;

    // Log the error with appropriate level based on severity
    this.logError(error, category, severity, context, metadata);

    // Show user notification if needed
    if (shouldNotifyUser && this.config.showNotifications) {
      this.showUserNotification(userMessage || this.getDefaultUserMessage(category, severity), severity);
    }

    // Report to server if configured (future implementation)
    if (this.config.reportToServer) {
      this.reportError(errorInfo);
    }
  }

  /**
   * Log error with appropriate level
   */
  private logError(
    error: Error,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context?: string,
    metadata?: Record<string, any>
  ): void {
    const logMessage = `[${category.toUpperCase()}] ${context ? `${context}: ` : ''}${error.message}`;
    const logData = {
      error: error.stack || error.message,
      category,
      severity,
      context,
      ...metadata
    };

    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        logger.error(logMessage, logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn(logMessage, logData);
        break;
      case ErrorSeverity.LOW:
        logger.info(logMessage, logData);
        break;
    }
  }

  /**
   * Show user-friendly notifications
   */
  private showUserNotification(message: string, severity: ErrorSeverity): void {
    const options = { autoClose: this.getNotificationAutoClose(severity) };

    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        Notification.error(message, options);
        break;
      case ErrorSeverity.MEDIUM:
        Notification.warning(message, options);
        break;
      case ErrorSeverity.LOW:
        Notification.info(message, options);
        break;
    }
  }

  /**
   * Get auto-close duration based on severity
   */
  private getNotificationAutoClose(severity: ErrorSeverity): number {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 0; // Don't auto-close critical errors
      case ErrorSeverity.HIGH:
        return 10000; // 10 seconds
      case ErrorSeverity.MEDIUM:
        return 5000;  // 5 seconds
      case ErrorSeverity.LOW:
        return 3000;  // 3 seconds
    }
  }

  /**
   * Get default user message based on category and severity
   */
  private getDefaultUserMessage(category: ErrorCategory, severity: ErrorSeverity): string {
    const severityPrefix = severity === ErrorSeverity.CRITICAL || severity === ErrorSeverity.HIGH
      ? '重要: ' : '';

    switch (category) {
      case ErrorCategory.NETWORK:
        return `${severityPrefix}ネットワーク接続に問題があります。インターネット接続を確認してください。`;
      case ErrorCategory.SETTINGS:
        return `${severityPrefix}設定に問題があります。拡張機能の設定を確認してください。`;
      case ErrorCategory.CELL_PROCESSING:
        return `${severityPrefix}セル処理中にエラーが発生しました。しばらく待ってから再試行してください。`;
      case ErrorCategory.UI:
        return `${severityPrefix}画面表示でエラーが発生しました。画面を再読み込みしてください。`;
      case ErrorCategory.DATA_TRANSMISSION:
        return `${severityPrefix}データ送信でエラーが発生しました。自動的に再試行します。`;
      case ErrorCategory.INITIALIZATION:
        return `${severityPrefix}拡張機能の初期化でエラーが発生しました。JupyterLabを再起動してください。`;
      default:
        return `${severityPrefix}予期しないエラーが発生しました。`;
    }
  }

  /**
   * Report error to server (future implementation)
   */
  private reportError(errorInfo: ErrorInfo): void {
    // TODO: Implement server error reporting
    logger.debug('Error reporting to server not yet implemented', { errorInfo });
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

/**
 * Convenience functions for common error handling patterns
 */

/**
 * Handle network errors
 */
export const handleNetworkError = (
  error: Error,
  context?: string,
  userMessage?: string
): void => {
  errorHandler.handle({
    error,
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.MEDIUM,
    context,
    userMessage,
    shouldNotifyUser: true
  });
};

/**
 * Handle settings errors
 */
export const handleSettingsError = (
  error: Error,
  context?: string,
  userMessage?: string
): void => {
  errorHandler.handle({
    error,
    category: ErrorCategory.SETTINGS,
    severity: ErrorSeverity.HIGH,
    context,
    userMessage,
    shouldNotifyUser: true
  });
};

/**
 * Handle cell processing errors
 */
export const handleCellProcessingError = (
  error: Error,
  context?: string,
  metadata?: Record<string, any>
): void => {
  errorHandler.handle({
    error,
    category: ErrorCategory.CELL_PROCESSING,
    severity: ErrorSeverity.LOW,
    context,
    shouldNotifyUser: false, // Don't spam users for cell processing errors
    metadata
  });
};

/**
 * Handle critical initialization errors
 */
export const handleInitializationError = (
  error: Error,
  context?: string
): void => {
  errorHandler.handle({
    error,
    category: ErrorCategory.INITIALIZATION,
    severity: ErrorSeverity.CRITICAL,
    context,
    shouldNotifyUser: true
  });
};

/**
 * Handle UI errors
 */
export const handleUIError = (
  error: Error,
  context?: string,
  userMessage?: string
): void => {
  errorHandler.handle({
    error,
    category: ErrorCategory.UI,
    severity: ErrorSeverity.MEDIUM,
    context,
    userMessage,
    shouldNotifyUser: true
  });
};

/**
 * Handle data transmission errors
 */
export const handleDataTransmissionError = (
  error: Error,
  context?: string,
  metadata?: Record<string, any>
): void => {
  errorHandler.handle({
    error,
    category: ErrorCategory.DATA_TRANSMISSION,
    severity: ErrorSeverity.MEDIUM,
    context,
    shouldNotifyUser: true,
    metadata
  });
};

/**
 * Async error wrapper for promises
 */
export const withErrorHandling = <T>(
  promise: Promise<T>,
  category: ErrorCategory,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  context?: string
): Promise<T> => {
  return promise.catch(error => {
    errorHandler.handle({
      error: error instanceof Error ? error : new Error(String(error)),
      category,
      severity,
      context,
      shouldNotifyUser: severity >= ErrorSeverity.MEDIUM
    });
    throw error; // Re-throw to maintain promise chain behavior
  });
};

/**
 * Sync error wrapper for functions
 */
export const withSyncErrorHandling = <T>(
  fn: () => T,
  category: ErrorCategory,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  context?: string
): T | undefined => {
  try {
    return fn();
  } catch (error) {
    errorHandler.handle({
      error: error instanceof Error ? error : new Error(String(error)),
      category,
      severity,
      context,
      shouldNotifyUser: severity >= ErrorSeverity.MEDIUM
    });
    return undefined;
  }
};
