/**
 * 動的環境検出システム
 * ベストプラクティス: ランタイム環境に応じた動的URL設定
 */

export interface DetectedEnvironment {
  type: 'docker' | 'local' | 'production';
  apiBaseUrl: string;
  wsUrl: string;
  isSecure: boolean;
}

/**
 * ブラウザ環境の検出
 */
export function detectBrowserEnvironment(): DetectedEnvironment {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;

  // HTTPS環境の検出
  const isSecure = protocol === 'https:';

  // Docker環境の検出（ホスト名が特定パターンの場合）
  const isDocker = hostname.includes('docker') ||
                   hostname.includes('container') ||
                   process.env.NODE_ENV === 'development' && hostname === 'localhost';

  // 本番環境の検出
  const isProduction = process.env.NODE_ENV === 'production' ||
                       !hostname.includes('localhost') && !hostname.includes('127.0.0.1');

  if (isProduction) {
    return {
      type: 'production',
      apiBaseUrl: `${protocol}//${hostname}/api/v1`,
      wsUrl: `${isSecure ? 'wss' : 'ws'}://${hostname}`,
      isSecure
    };
  }

  if (isDocker) {
    return {
      type: 'docker',
      apiBaseUrl: 'http://localhost:8000/api/v1',
      wsUrl: 'ws://localhost:8000',
      isSecure: false
    };
  }

  // ローカル開発環境
  return {
    type: 'local',
    apiBaseUrl: 'http://localhost:8000/api/v1',
    wsUrl: 'ws://localhost:8000',
    isSecure: false
  };
}

/**
 * モバイル環境の検出
 */
export function isMobileEnvironment(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  return /mobile|android|iphone|ipad|tablet|blackberry|opera mini|opera mobi|webos|palm/.test(userAgent);
}

/**
 * ネットワーク接続状態の検出
 */
export function getNetworkInfo() {
  const connection = (navigator as any).connection ||
                    (navigator as any).mozConnection ||
                    (navigator as any).webkitConnection;

  return {
    online: navigator.onLine,
    connectionType: connection?.effectiveType || 'unknown',
    downlink: connection?.downlink || 0,
    rtt: connection?.rtt || 0
  };
}

/**
 * 環境固有の最適化設定
 */
export function getEnvironmentOptimizations(env: DetectedEnvironment) {
  const isMobile = isMobileEnvironment();
  const network = getNetworkInfo();

  return {
    // WebSocket設定
    websocket: {
      timeout: isMobile ? 15000 : 10000,
      pingInterval: network.connectionType === 'slow-2g' ? 30000 : 25000,
      pingTimeout: network.connectionType === 'slow-2g' ? 10000 : 5000,
      reconnectionDelay: isMobile ? 2000 : 1000,
      maxReconnectionAttempts: isMobile ? 3 : 5
    },

    // API設定
    api: {
      timeout: network.connectionType === 'slow-2g' ? 15000 : 10000,
      retryAttempts: network.rtt > 500 ? 2 : 3,
      cacheTimeout: isMobile ? 30000 : 60000
    },

    // UI設定
    ui: {
      enableAnimations: !isMobile || network.connectionType !== 'slow-2g',
      updateInterval: network.connectionType === 'slow-2g' ? 10000 : 5000,
      enableDebugLogs: env.type === 'local'
    }
  };
}

/**
 * 環境診断レポート
 */
export function generateEnvironmentDiagnostics(): any {
  const env = detectBrowserEnvironment();
  const network = getNetworkInfo();
  const isMobile = isMobileEnvironment();
  const optimizations = getEnvironmentOptimizations(env);

  return {
    timestamp: new Date().toISOString(),
    environment: env,
    device: {
      isMobile,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language
    },
    network,
    optimizations,
    browser: {
      name: getBrowserName(),
      version: getBrowserVersion(),
      cookieEnabled: navigator.cookieEnabled,
      javaEnabled: (navigator as any).javaEnabled?.() || false
    },
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      pixelRatio: window.devicePixelRatio
    }
  };
}

function getBrowserName(): string {
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Edge')) return 'Edge';
  return 'Unknown';
}

function getBrowserVersion(): string {
  const userAgent = navigator.userAgent;
  const match = userAgent.match(/(?:Chrome|Firefox|Safari|Edge)\/(\d+)/);
  return match ? match[1] : 'Unknown';
}
