/**
 * Performance Monitor
 * Core Web Vitals とカスタム メトリクスの測定
 */

import React from 'react';

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  unit: string;
  context?: Record<string, any>;
}

interface CoreWebVitals {
  CLS: number | null; // Cumulative Layout Shift
  FID: number | null; // First Input Delay
  LCP: number | null; // Largest Contentful Paint
  FCP: number | null; // First Contentful Paint
  TTFB: number | null; // Time to First Byte
}

interface CustomMetrics {
  componentRenderTime: number;
  dataProcessingTime: number;
  workerTaskTime: number;
  memoryUsage: number;
  bundleSize: number;
}

/**
 * パフォーマンス監視クラス
 */
export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private observers: Map<string, PerformanceObserver> = new Map();
  private measurements: Map<string, number> = new Map();
  private isEnabled: boolean = process.env.NODE_ENV === 'development';

  constructor() {
    this.initializeObservers();
  }

  /**
   * Performance Observer の初期化
   */
  private initializeObservers(): void {
    if (!this.isEnabled || typeof window === 'undefined') return;

    try {
      // Core Web Vitals 測定
      this.observeCoreWebVitals();
      
      // Navigation Timing 測定
      this.observeNavigationTiming();
      
      // Resource Timing 測定
      this.observeResourceTiming();
      
      // Memory 使用量測定
      this.observeMemoryUsage();
    } catch (error) {
      console.warn('Failed to initialize performance observers:', error);
    }
  }

  /**
   * Core Web Vitals 測定
   */
  private observeCoreWebVitals(): void {
    // LCP (Largest Contentful Paint)
    if ('PerformanceObserver' in window) {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        
        this.recordMetric('LCP', lastEntry.startTime, 'ms');
      });
      
      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.set('lcp', lcpObserver);
      } catch (e) {
        console.warn('LCP measurement not supported');
      }
    }

    // FID (First Input Delay) - プロキシとして click, keydown を測定
    let firstInputTime: number | null = null;
    const handleFirstInput = (event: Event) => {
      if (firstInputTime === null) {
        firstInputTime = performance.now();
        const delay = firstInputTime - (event.timeStamp || 0);
        this.recordMetric('FID', delay, 'ms');
        
        // 一度だけ測定
        ['click', 'keydown', 'mousedown'].forEach(eventType => {
          window.removeEventListener(eventType, handleFirstInput);
        });
      }
    };

    ['click', 'keydown', 'mousedown'].forEach(eventType => {
      window.addEventListener(eventType, handleFirstInput, { once: true });
    });

    // CLS (Cumulative Layout Shift)
    if ('PerformanceObserver' in window) {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        this.recordMetric('CLS', clsValue, 'score');
      });

      try {
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('cls', clsObserver);
      } catch (e) {
        console.warn('CLS measurement not supported');
      }
    }
  }

  /**
   * Navigation Timing 測定
   */
  private observeNavigationTiming(): void {
    if ('PerformanceObserver' in window) {
      const navObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach((entry: any) => {
          // TTFB (Time to First Byte)
          const ttfb = entry.responseStart - entry.requestStart;
          this.recordMetric('TTFB', ttfb, 'ms');
          
          // DOM Content Loaded
          const dcl = entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart;
          this.recordMetric('DCL', dcl, 'ms');
          
          // Total Load Time
          const loadTime = entry.loadEventEnd - entry.loadEventStart;
          this.recordMetric('LoadTime', loadTime, 'ms');
        });
      });

      try {
        navObserver.observe({ entryTypes: ['navigation'] });
        this.observers.set('navigation', navObserver);
      } catch (e) {
        console.warn('Navigation timing measurement not supported');
      }
    }
  }

  /**
   * Resource Timing 測定
   */
  private observeResourceTiming(): void {
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach((entry: any) => {
          const resourceType = this.getResourceType(entry.name);
          const loadTime = entry.responseEnd - entry.startTime;
          
          this.recordMetric(`${resourceType}LoadTime`, loadTime, 'ms', {
            url: entry.name,
            size: entry.transferSize || 0
          });
        });
      });

      try {
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.set('resource', resourceObserver);
      } catch (e) {
        console.warn('Resource timing measurement not supported');
      }
    }
  }

  /**
   * Memory 使用量測定
   */
  private observeMemoryUsage(): void {
    if ((performance as any).memory) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.recordMetric('MemoryUsed', memory.usedJSHeapSize / 1024 / 1024, 'MB');
        this.recordMetric('MemoryLimit', memory.jsHeapSizeLimit / 1024 / 1024, 'MB');
      }, 5000); // 5秒ごと
    }
  }

  /**
   * カスタム測定開始
   */
  startMeasurement(name: string): void {
    if (!this.isEnabled) return;
    
    this.measurements.set(name, performance.now());
    performance.mark(`${name}-start`);
  }

  /**
   * カスタム測定終了
   */
  endMeasurement(name: string): number {
    if (!this.isEnabled) return 0;

    const startTime = this.measurements.get(name);
    if (startTime === undefined) {
      console.warn(`No start measurement found for: ${name}`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    this.recordMetric(name, duration, 'ms');
    this.measurements.delete(name);
    
    return duration;
  }

  /**
   * Worker タスク測定
   */
  measureWorkerTask(taskName: string, duration: number): void {
    this.recordMetric(`worker-${taskName}`, duration, 'ms');
  }

  /**
   * データ処理測定
   */
  measureDataProcessing<T>(name: string, processFn: () => T): T {
    if (!this.isEnabled) return processFn();

    this.startMeasurement(`data-${name}`);
    const result = processFn();
    this.endMeasurement(`data-${name}`);
    
    return result;
  }

  /**
   * メトリクス記録
   */
  recordMetric(
    name: string, 
    value: number, 
    unit: string, 
    context?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      unit,
      context
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricsList = this.metrics.get(name)!;
    metricsList.push(metric);

    // 最新100件のみ保持
    if (metricsList.length > 100) {
      metricsList.shift();
    }

    // 開発時のコンソール出力
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 ${name}: ${value.toFixed(2)} ${unit}`, context || '');
    }
  }

  /**
   * Core Web Vitals 取得
   */
  getCoreWebVitals(): CoreWebVitals {
    return {
      CLS: this.getLatestMetric('CLS'),
      FID: this.getLatestMetric('FID'),
      LCP: this.getLatestMetric('LCP'),
      FCP: this.getLatestMetric('FCP'),
      TTFB: this.getLatestMetric('TTFB')
    };
  }

  /**
   * カスタムメトリクス取得
   */
  getCustomMetrics(): CustomMetrics {
    return {
      componentRenderTime: this.getAverageMetric(/^component-/),
      dataProcessingTime: this.getAverageMetric(/^data-/),
      workerTaskTime: this.getAverageMetric(/^worker-/),
      memoryUsage: this.getLatestMetric('MemoryUsed') || 0,
      bundleSize: this.getBundleSize()
    };
  }

  /**
   * リアルタイム統計取得（店舗固有）
   */
  getRealTimeStats() {
    const currentTime = Date.now();
    const sessionStart = Array.from(this.metrics.values())
      .flat()
      .reduce((min, metric) => Math.min(min, metric.timestamp), currentTime);

    const allMetrics = Array.from(this.metrics.values()).flat();
    const deltaUpdates = allMetrics.filter(m => m.name.includes('delta-update'));
    const fullUpdates = allMetrics.filter(m => m.name.includes('full-update'));
    const totalUpdates = deltaUpdates.length + fullUpdates.length;

    return {
      currentMemoryUsage: this.getLatestMetric('MemoryUsed') || 0,
      averageComponentRenderTime: this.getAverageMetric(/^component-/),
      averageDataProcessingTime: this.getAverageMetric(/^data-/),
      totalMeasurements: Array.from(this.metrics.values()).reduce((sum, metrics) => sum + metrics.length, 0),
      isMonitoringActive: this.isEnabled,
      estimatedBandwidthSaved: this.calculateBandwidthSaved(),
      sessionDuration: currentTime - sessionStart,
      // 拡張統計
      totalUpdates,
      deltaUpdateRatio: totalUpdates > 0 ? (deltaUpdates.length / totalUpdates) * 100 : 0,
      totalDataTransferred: allMetrics
        .filter(m => m.name.includes('size'))
        .reduce((sum, m) => sum + m.value, 0),
      averageProcessingTime: allMetrics
        .filter(m => m.name.includes('update'))
        .reduce((sum, m) => sum + (m.value || 0), 0) / Math.max(allMetrics.filter(m => m.name.includes('update')).length, 1)
    };
  }

  /**
   * 推定帯域幅節約量計算
   */
  private calculateBandwidthSaved(): number {
    // 遅延読み込みやメモ化により節約された帯域幅の推定
    const lazyLoadSavings = this.getAverageMetric(/^lazy-load-/) * 0.1; // 概算
    const memoizationSavings = this.getAverageMetric(/^memo-/) * 0.05; // 概算
    return lazyLoadSavings + memoizationSavings;
  }

  /**
   * メトリクス履歴取得
   */
  getMetricsHistory() {
    const history: any[] = [];
    this.metrics.forEach((metricsList, name) => {
      metricsList.forEach(metric => {
        history.push({
          name,
          value: metric.value,
          unit: metric.unit,
          timestamp: metric.timestamp,
          context: metric.context
        });
      });
    });
    
    // タイムスタンプでソート
    return history.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * CSV形式でエクスポート
   */
  exportToCSV(): string {
    const history = this.getMetricsHistory();
    const headers = ['Timestamp', 'Metric Name', 'Value', 'Unit', 'Context'];
    
    const csvRows = [headers.join(',')];
    
    history.forEach(metric => {
      const row = [
        new Date(metric.timestamp).toISOString(),
        metric.name,
        metric.value.toString(),
        metric.unit,
        metric.context ? JSON.stringify(metric.context).replace(/,/g, ';') : ''
      ];
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  }

  /**
   * パフォーマンス レポート生成
   */
  generateReport(): {
    coreWebVitals: CoreWebVitals;
    customMetrics: CustomMetrics;
    recommendations: string[];
    timestamp: string;
  } {
    const cwv = this.getCoreWebVitals();
    const custom = this.getCustomMetrics();
    const recommendations = this.generateRecommendations(cwv, custom);

    return {
      coreWebVitals: cwv,
      customMetrics: custom,
      recommendations,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 改善提案生成
   */
  private generateRecommendations(cwv: CoreWebVitals, custom: CustomMetrics): string[] {
    const recommendations: string[] = [];

    if (cwv.LCP && cwv.LCP > 2500) {
      recommendations.push('LCP改善: 画像最適化、コード分割、CDN使用を検討');
    }

    if (cwv.FID && cwv.FID > 100) {
      recommendations.push('FID改善: 重いJavaScript処理をWorkerに移行');
    }

    if (cwv.CLS && cwv.CLS > 0.1) {
      recommendations.push('CLS改善: 画像・広告サイズの事前指定、フォント最適化');
    }

    if (custom.componentRenderTime > 16) {
      recommendations.push('レンダリング改善: React.memo、useMemo、useCallbackの活用');
    }

    if (custom.dataProcessingTime > 100) {
      recommendations.push('データ処理改善: Web Worker使用、データ分割処理');
    }

    if (custom.memoryUsage > 100) {
      recommendations.push('メモリ使用量改善: 不要なデータのクリーンアップ');
    }

    return recommendations;
  }

  /**
   * ユーティリティメソッド
   */
  private getLatestMetric(name: string): number | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) return null;
    return metrics[metrics.length - 1].value;
  }

  private getAverageMetric(pattern: RegExp): number {
    let total = 0;
    let count = 0;

    this.metrics.forEach((metricsList, name) => {
      if (pattern.test(name)) {
        metricsList.forEach(metric => {
          total += metric.value;
          count++;
        });
      }
    });

    return count > 0 ? total / count : 0;
  }

  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'JS';
    if (url.includes('.css')) return 'CSS';
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/)) return 'Image';
    if (url.match(/\.(woff|woff2|ttf)$/)) return 'Font';
    return 'Other';
  }

  private getBundleSize(): number {
    // 概算のバンドルサイズ（リソースタイミングから計算）
    let totalSize = 0;
    const resources = performance.getEntriesByType('resource') as any[];
    
    resources.forEach(resource => {
      if (resource.name.includes('.js') || resource.name.includes('.css')) {
        totalSize += resource.transferSize || 0;
      }
    });

    return totalSize / 1024; // KB
  }

  /**
   * フル更新記録
   */
  recordFullUpdate(data: any[]): void {
    const dataSize = JSON.stringify(data).length;
    const timestamp = Date.now();
    
    this.recordMetric('full-update-size', dataSize, 'bytes');
    this.recordMetric('full-update-count', data.length, 'items');
    this.recordMetric('full-update-timestamp', timestamp, 'ms');
  }

  /**
   * 差分更新記録
   */
  recordDeltaUpdate(deltaData: any[]): void {
    const dataSize = JSON.stringify(deltaData).length;
    const timestamp = Date.now();
    
    this.recordMetric('delta-update-size', dataSize, 'bytes');
    this.recordMetric('delta-update-count', deltaData.length, 'items');
    this.recordMetric('delta-update-timestamp', timestamp, 'ms');
  }

  /**
   * レコーディング開始
   */
  startRecording(): void {
    this.isEnabled = true;
    this.clearMetrics();
    console.log('パフォーマンス監視レコーディング開始');
  }

  /**
   * レコーディング停止
   */
  stopRecording(): void {
    this.isEnabled = false;
    console.log('パフォーマンス監視レコーディング停止');
  }

  /**
   * パフォーマンス比較分析
   */
  analyzePerfomanceComparison(): LoadComparison | null {
    const fullUpdates = Array.from(this.metrics.values())
      .flat()
      .filter(m => m.name.includes('full-update'));
    
    const deltaUpdates = Array.from(this.metrics.values())
      .flat()
      .filter(m => m.name.includes('delta-update'));

    if (fullUpdates.length === 0 || deltaUpdates.length === 0) {
      return null;
    }

    const fullAvg = {
      dataSize: fullUpdates.filter(m => m.name.includes('size')).reduce((sum, m) => sum + m.value, 0) / fullUpdates.filter(m => m.name.includes('size')).length || 0,
      processingTime: this.getAverageMetric(/^full-update/),
      memoryUsage: this.getLatestMetric('MemoryUsed') || 0,
      messageCount: fullUpdates.filter(m => m.name.includes('count')).reduce((sum, m) => sum + m.value, 0) / fullUpdates.filter(m => m.name.includes('count')).length || 0
    };

    const deltaAvg = {
      dataSize: deltaUpdates.filter(m => m.name.includes('size')).reduce((sum, m) => sum + m.value, 0) / deltaUpdates.filter(m => m.name.includes('size')).length || 0,
      processingTime: this.getAverageMetric(/^delta-update/),
      memoryUsage: this.getLatestMetric('MemoryUsed') || 0,
      messageCount: deltaUpdates.filter(m => m.name.includes('count')).reduce((sum, m) => sum + m.value, 0) / deltaUpdates.filter(m => m.name.includes('count')).length || 0,
      compressionRatio: 0.85 // 概算
    };

    const improvements = {
      dataSizeReduction: ((fullAvg.dataSize - deltaAvg.dataSize) / fullAvg.dataSize) * 100,
      processingTimeReduction: ((fullAvg.processingTime - deltaAvg.processingTime) / fullAvg.processingTime) * 100,
      processingSpeedup: ((fullAvg.processingTime - deltaAvg.processingTime) / fullAvg.processingTime) * 100,
      memoryReduction: ((fullAvg.memoryUsage - deltaAvg.memoryUsage) / fullAvg.memoryUsage) * 100,
      messageReduction: ((fullAvg.messageCount - deltaAvg.messageCount) / fullAvg.messageCount) * 100,
      bandwidthSavings: (fullAvg.dataSize - deltaAvg.dataSize) * 60, // per minute
      performanceGain: 0.0
    };

    return new LoadComparisonImpl(
      deltaAvg.processingTime,
      'Performance Comparison',
      fullAvg,
      deltaAvg,
      improvements
    );
  }

  /**
   * メトリクスクリア
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.measurements.clear();
  }

  /**
   * クリーンアップ
   */
  dispose(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.metrics.clear();
    this.measurements.clear();
  }
}

// シングルトンインスタンス
export const performanceMonitor = new PerformanceMonitor();

/**
 * React コンポーネント用パフォーマンス追跡HOC
 */
export function withComponentPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const WrappedComponent: React.FC<P> = (props) => {
    const name = componentName || Component.displayName || Component.name || 'Anonymous';
    
    React.useEffect(() => {
      performanceMonitor.startMeasurement(`component-${name}-mount`);
      return () => {
        performanceMonitor.endMeasurement(`component-${name}-mount`);
      };
    }, [name]);

    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withPerformanceTracking(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * 非同期処理のパフォーマンス追跡
 */
export async function withPerformanceTracking<T>(
  asyncFn: () => Promise<T>,
  operationName: string
): Promise<T> {
  performanceMonitor.startMeasurement(operationName);
  try {
    const result = await asyncFn();
    return result;
  } finally {
    performanceMonitor.endMeasurement(operationName);
  }
}

/**
 * 同期処理のパフォーマンス追跡
 */
export function withSyncPerformanceTracking<T>(
  syncFn: () => T,
  operationName: string
): T {
  performanceMonitor.startMeasurement(operationName);
  try {
    const result = syncFn();
    return result;
  } finally {
    performanceMonitor.endMeasurement(operationName);
  }
}

/**
 * ロード比較インターフェース
 */
export interface LoadComparison {
  isHeavierThan(threshold: number): boolean;
  getDurationMs(): number;
  getOperationName(): string;
  fullUpdateMetrics?: {
    dataSize: number;
    processingTime: number;
    memoryUsage: number;
    messageCount: number;
  };
  deltaUpdateMetrics?: {
    dataSize: number;
    processingTime: number;
    memoryUsage: number;
    messageCount: number;
    compressionRatio: number;
  };
  improvements?: {
    dataSizeReduction: number;
    processingTimeReduction: number;
    processingSpeedup: number;
    memoryReduction: number;
    messageReduction: number;
    bandwidthSavings: number;
    performanceGain: number;
  };
}

/**
 * ロード比較実装
 */
export class LoadComparisonImpl implements LoadComparison {
  constructor(
    private readonly duration: number,
    private readonly operationName: string,
    public readonly fullUpdateMetrics?: {
      dataSize: number;
      processingTime: number;
      memoryUsage: number;
      messageCount: number;
    },
    public readonly deltaUpdateMetrics?: {
      dataSize: number;
      processingTime: number;
      memoryUsage: number;
      messageCount: number;
      compressionRatio: number;
    },
    public readonly improvements?: {
      dataSizeReduction: number;
      processingTimeReduction: number;
      processingSpeedup: number;
      memoryReduction: number;
      messageReduction: number;
      bandwidthSavings: number;
      performanceGain: number;
    }
  ) {}

  isHeavierThan(threshold: number): boolean {
    return this.duration > threshold;
  }

  getDurationMs(): number {
    return this.duration;
  }

  getOperationName(): string {
    return this.operationName;
  }
}

/**
 * パフォーマンス測定付きの処理実行
 */
export function measurePerformance<T>(
  fn: () => T,
  operationName: string
): { result: T; comparison: LoadComparison } {
  const startTime = performance.now();
  const result = fn();
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  performanceMonitor.recordMetric(operationName, duration, 'ms');
  
  return {
    result,
    comparison: new LoadComparisonImpl(duration, operationName)
  };
}

