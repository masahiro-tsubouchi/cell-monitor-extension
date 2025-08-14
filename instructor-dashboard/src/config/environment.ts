/**
 * 環境変数設定の集約化とバリデーション
 * ベストプラクティス: タイプセーフな環境変数管理
 */

import { detectBrowserEnvironment, generateEnvironmentDiagnostics } from '../utils/environmentDetector';

export interface EnvironmentConfig {
  // API設定
  apiBaseUrl: string;
  wsUrl: string;

  // 環境情報
  nodeEnv: 'development' | 'production' | 'test';
  isProduction: boolean;
  isDevelopment: boolean;

  // デバッグ設定
  enableDebugLogs: boolean;
}

/**
 * 環境変数のバリデーション
 */
function validateEnvironmentVariables(): void {
  const requiredVars = [
    'REACT_APP_API_BASE_URL',
    'REACT_APP_WS_URL'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env file or environment configuration.'
    );
  }
}

/**
 * URL形式のバリデーション
 */
function validateUrlFormat(url: string, name: string): string {
  try {
    const parsedUrl = new URL(url);

    // WebSocket URLの場合はws/wssプロトコルを確認
    if (name.includes('WS')) {
      if (!['ws:', 'wss:'].includes(parsedUrl.protocol)) {
        throw new Error(`${name} must use ws:// or wss:// protocol`);
      }
    }

    return url;
  } catch (error) {
    throw new Error(`Invalid URL format for ${name}: ${url}`);
  }
}

/**
 * 環境設定の取得と初期化
 * 動的環境検出とフォールバック処理を含む
 */
function createEnvironmentConfig(): EnvironmentConfig {
  const nodeEnv = process.env.NODE_ENV as 'development' | 'production' | 'test' || 'development';

  // 動的環境検出
  const detectedEnv = detectBrowserEnvironment();

  // 環境変数が設定されていない場合は動的検出結果を使用
  let apiBaseUrl: string;
  let wsUrl: string;

  try {
    validateEnvironmentVariables();
    apiBaseUrl = validateUrlFormat(process.env.REACT_APP_API_BASE_URL!, 'REACT_APP_API_BASE_URL');
    wsUrl = validateUrlFormat(process.env.REACT_APP_WS_URL!, 'REACT_APP_WS_URL');
  } catch (error) {
    console.warn('環境変数が不完全です。動的検出結果を使用:', error);
    console.log('検出された環境:', detectedEnv);

    apiBaseUrl = detectedEnv.apiBaseUrl;
    wsUrl = detectedEnv.wsUrl;
  }

  return {
    // API設定
    apiBaseUrl,
    wsUrl,

    // 環境情報
    nodeEnv,
    isProduction: nodeEnv === 'production',
    isDevelopment: nodeEnv === 'development',

    // デバッグ設定
    enableDebugLogs: nodeEnv === 'development' || process.env.REACT_APP_DEBUG === 'true'
  };
}

// シングルトンパターンで環境設定を管理
let environmentConfig: EnvironmentConfig | null = null;

export function getEnvironmentConfig(): EnvironmentConfig {
  if (!environmentConfig) {
    environmentConfig = createEnvironmentConfig();
  }
  return environmentConfig;
}

// 便利な定数エクスポート
export const ENV = getEnvironmentConfig();

// 開発時のヘルパー関数
export function logEnvironmentInfo(): void {
  if (ENV.isDevelopment) {
    console.group('🌍 Environment Configuration');
    console.log('Node Environment:', ENV.nodeEnv);
    console.log('API Base URL:', ENV.apiBaseUrl);
    console.log('WebSocket URL:', ENV.wsUrl);
    console.log('Debug Logs:', ENV.enableDebugLogs ? '✅ Enabled' : '❌ Disabled');
    console.groupEnd();

    // 詳細な環境診断（開発環境のみ）
    const diagnostics = generateEnvironmentDiagnostics();
    console.group('🔍 Environment Diagnostics');
    console.log('Detected Environment:', diagnostics.environment);
    console.log('Device Info:', diagnostics.device);
    console.log('Network Info:', diagnostics.network);
    console.groupEnd();
  }
}

// 型ガード関数
export function isValidWebSocketUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['ws:', 'wss:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
