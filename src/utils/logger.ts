/**
 * Logger utility for Cell Monitor Extension
 * Provides environment-based log level control and consistent logging interface
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LoggerConfig {
  level: LogLevel;
  prefix: string;
  enabledInProduction: boolean;
}

class Logger {
  private config: LoggerConfig;
  private isDevelopment: boolean;

  constructor(config: Partial<LoggerConfig> = {}) {
    // Detect development mode (JupyterLab extension context)
    this.isDevelopment = this.detectDevelopmentMode();

    this.config = {
      level: this.isDevelopment ? LogLevel.DEBUG : LogLevel.ERROR,
      prefix: '[CellMonitor]',
      enabledInProduction: false,
      ...config
    };
  }

  private detectDevelopmentMode(): boolean {
    // Check for development indicators
    try {
      // JupyterLab development mode usually has certain debug flags
      if (typeof window !== 'undefined') {
        // Check for development mode indicators
        return (
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          process?.env?.NODE_ENV === 'development' ||
          document.querySelector('[data-jupyter-widgets-version]') !== null
        );
      }
      return process?.env?.NODE_ENV === 'development' || false;
    } catch {
      // Fallback to production mode if detection fails
      return false;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.isDevelopment && !this.config.enabledInProduction) {
      // In production, only allow ERROR level unless explicitly enabled
      return level === LogLevel.ERROR;
    }
    return level <= this.config.level;
  }

  private formatMessage(level: string, message: string, ...args: any[]): any[] {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = `${this.config.prefix}[${level}][${timestamp}]`;
    return [prefix, message, ...args];
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(...this.formatMessage('ERROR', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(...this.formatMessage('WARN', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(...this.formatMessage('INFO', message, ...args));
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(...this.formatMessage('DEBUG', message, ...args));
    }
  }

  /**
   * Special method for performance-sensitive debug logs
   * These are completely removed in production builds
   */
  perfDebug(message: string, ...args: any[]): void {
    if (this.isDevelopment && this.shouldLog(LogLevel.DEBUG)) {
      console.log(...this.formatMessage('PERF', message, ...args));
    }
  }

  /**
   * Group logging for complex debug scenarios
   */
  group(title: string, callback: () => void): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.group(this.formatMessage('GROUP', title)[0]);
      try {
        callback();
      } finally {
        console.groupEnd();
      }
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context: string): Logger {
    return new Logger({
      ...this.config,
      prefix: `${this.config.prefix}[${context}]`
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export factory function for component-specific loggers
export const createLogger = (context: string): Logger => {
  return logger.child(context);
};
