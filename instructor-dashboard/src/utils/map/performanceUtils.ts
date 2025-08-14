/**
 * パフォーマンス最適化ユーティリティ
 * throttle, debounce, ブラウザ拡大率検出など
 */

/**
 * 関数の実行頻度を制限する（throttle）
 * 指定した間隔でのみ関数を実行
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let lastFunc: NodeJS.Timeout;
  let lastRan: number;

  return function(this: any, ...args: Parameters<T>) {
    if (!lastRan) {
      func.apply(this, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if ((Date.now() - lastRan) >= limit) {
          func.apply(this, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
};

/**
 * 関数の実行を遅延させる（debounce）
 * 指定した時間内に再度呼び出された場合は実行をキャンセル
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;

  return function(this: any, ...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

/**
 * ブラウザ拡大率を検出
 */
export const detectBrowserZoomLevel = (): number => {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const visualViewport = window.visualViewport;

  if (visualViewport) {
    // Visual Viewport APIが利用可能な場合
    return Math.round((window.innerWidth / visualViewport.width) * 100) / 100;
  } else {
    // フォールバック：devicePixelRatioを使用
    return devicePixelRatio;
  }
};

/**
 * ResizeObserver用のthrottled handler作成
 */
export const createThrottledResizeHandler = (
  callback: (entries: ResizeObserverEntry[]) => void,
  limit: number = 16 // 60fps相当
) => {
  return throttle(callback, limit);
};

/**
 * ブラウザ拡大率検出用のdebounced handler作成
 */
export const createDebouncedZoomDetector = (
  callback: (zoomLevel: number) => void,
  wait: number = 100
) => {
  return debounce(() => {
    const zoomLevel = detectBrowserZoomLevel();
    callback(zoomLevel);
  }, wait);
};

/**
 * ネットワーク接続状態の監視
 */
export const createNetworkMonitor = (
  onOnline?: () => void,
  onOffline?: () => void
) => {
  const handleOnline = () => {
    console.log('ネットワーク接続が復旧しました');
    onOnline?.();
  };

  const handleOffline = () => {
    console.log('ネットワーク接続が切断されました');
    onOffline?.();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

/**
 * ページの可視性変更を監視
 */
export const createVisibilityMonitor = (
  onVisible?: () => void,
  onHidden?: () => void
) => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      console.log('ページが非表示になりました');
      onHidden?.();
    } else {
      console.log('ページが表示されました');
      onVisible?.();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
};

/**
 * メモリ使用量の監視（開発環境のみ）
 */
export const logMemoryUsage = () => {
  if (process.env.NODE_ENV === 'development' && 'memory' in performance) {
    const memory = (performance as any).memory;
    console.log('メモリ使用量:', {
      used: `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
      total: `${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`,
      limit: `${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`
    });
  }
};

/**
 * FPS監視用のユーティリティ
 */
export const createFPSMonitor = (callback?: (fps: number) => void) => {
  let lastTime = performance.now();
  let frameCount = 0;
  let fps = 0;

  const measureFPS = (currentTime: number) => {
    frameCount++;

    if (currentTime >= lastTime + 1000) {
      fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
      frameCount = 0;
      lastTime = currentTime;

      if (callback) {
        callback(fps);
      } else if (process.env.NODE_ENV === 'development') {
        console.log(`FPS: ${fps}`);
      }
    }

    requestAnimationFrame(measureFPS);
  };

  requestAnimationFrame(measureFPS);

  return {
    getCurrentFPS: () => fps
  };
};
