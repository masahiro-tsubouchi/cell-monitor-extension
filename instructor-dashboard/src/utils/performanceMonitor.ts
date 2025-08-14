/**
 * 差分更新システムのパフォーマンス測定・比較システム
 * Before/Afterの実際の負荷軽減効果を数値で可視化
 */

import { StudentActivity } from '../services/dashboardAPI';
import { DeltaPackage } from './deltaCalculator';

export interface PerformanceMetrics {
  timestamp: number;
  mode: 'full' | 'delta';
  
  // データサイズ
  dataSize: number;           // バイト数
  originalDataSize: number;   // 元のフルデータサイズ
  compressionRatio: number;   // 圧縮率 (0-1)
  
  // パフォーマンス
  processingTime: number;     // 処理時間 (ms)
  memoryUsage: number;        // メモリ使用量推定 (bytes)
  renderTime: number;         // レンダリング時間 (ms)
  
  // WebSocket
  messageSize: number;        // メッセージサイズ (bytes)
  messageCount: number;       // メッセージ数
  
  // 統計
  changeCount: number;        // 変更された項目数
  totalStudentCount: number;  // 総学生数
}

export interface LoadComparison {
  fullUpdateMetrics: PerformanceMetrics;
  deltaUpdateMetrics: PerformanceMetrics;
  
  improvements: {
    dataSizeReduction: number;      // データサイズ削減率 (%)
    processingSpeedup: number;      // 処理速度向上率 (%)
    memoryReduction: number;        // メモリ使用量削減率 (%)
    bandwidthSavings: number;       // 帯域幅削減量 (bytes/min)
  };
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private isRecording = false;
  private currentSessionStart = 0;

  /**
   * パフォーマンス測定開始
   */
  startRecording(): void {
    this.isRecording = true;
    this.currentSessionStart = Date.now();
    this.metrics = [];
    console.log('🔍 パフォーマンス測定開始');
  }

  /**
   * パフォーマンス測定停止
   */
  stopRecording(): void {
    this.isRecording = false;
    console.log('📊 パフォーマンス測定完了');
  }

  /**
   * フル更新のメトリクス記録
   */
  recordFullUpdate(students: StudentActivity[]): PerformanceMetrics {
    const startTime = performance.now();
    
    // データサイズ計算
    const jsonString = JSON.stringify(students);
    const dataSize = new Blob([jsonString]).size;
    
    // 処理時間測定（シミュレート）
    const processingTime = performance.now() - startTime;
    
    // メモリ使用量推定
    const memoryUsage = this.estimateMemoryUsage(students);
    
    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      mode: 'full',
      dataSize,
      originalDataSize: dataSize,
      compressionRatio: 0, // フル更新は圧縮なし
      processingTime,
      memoryUsage,
      renderTime: 0, // 後で更新
      messageSize: dataSize,
      messageCount: 1,
      changeCount: students.length, // 全データが「変更」扱い
      totalStudentCount: students.length
    };

    if (this.isRecording) {
      this.metrics.push(metrics);
    }

    return metrics;
  }

  /**
   * 差分更新のメトリクス記録
   */
  recordDeltaUpdate(deltaPackage: DeltaPackage, totalStudents: number): PerformanceMetrics {
    const startTime = performance.now();
    
    // 差分データサイズ
    const deltaJson = JSON.stringify(deltaPackage);
    const deltaSize = new Blob([deltaJson]).size;
    
    // 元のフルデータサイズを推定
    const estimatedFullSize = totalStudents * 300; // 1学生約300bytes
    
    // 処理時間測定
    const processingTime = performance.now() - startTime;
    
    // メモリ使用量（差分のみ）
    const memoryUsage = deltaSize + (deltaPackage.changes.length * 50); // 変更処理のオーバーヘッド
    
    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      mode: 'delta',
      dataSize: deltaSize,
      originalDataSize: estimatedFullSize,
      compressionRatio: deltaPackage.metadata.compressionRatio,
      processingTime,
      memoryUsage,
      renderTime: 0, // 後で更新
      messageSize: deltaSize,
      messageCount: 1,
      changeCount: deltaPackage.changes.length,
      totalStudentCount: totalStudents
    };

    if (this.isRecording) {
      this.metrics.push(metrics);
    }

    return metrics;
  }

  /**
   * レンダリング時間を更新
   */
  updateRenderTime(timestamp: number, renderTime: number): void {
    const metric = this.metrics.find(m => Math.abs(m.timestamp - timestamp) < 100);
    if (metric) {
      metric.renderTime = renderTime;
    }
  }

  /**
   * 負荷比較分析
   */
  analyzePerfomanceComparison(): LoadComparison | null {
    const fullMetrics = this.metrics.filter(m => m.mode === 'full');
    const deltaMetrics = this.metrics.filter(m => m.mode === 'delta');
    
    if (fullMetrics.length === 0 || deltaMetrics.length === 0) {
      return null;
    }

    // 平均値計算
    const avgFull = this.calculateAverageMetrics(fullMetrics);
    const avgDelta = this.calculateAverageMetrics(deltaMetrics);

    // 改善率計算
    const dataSizeReduction = ((avgFull.dataSize - avgDelta.dataSize) / avgFull.dataSize) * 100;
    const processingSpeedup = ((avgFull.processingTime - avgDelta.processingTime) / avgFull.processingTime) * 100;
    const memoryReduction = ((avgFull.memoryUsage - avgDelta.memoryUsage) / avgFull.memoryUsage) * 100;
    
    // 帯域幅削減量（1分間の更新頻度を想定：12回/分）
    const updateFrequency = 12; // 5秒間隔
    const bandwidthSavings = (avgFull.dataSize - avgDelta.dataSize) * updateFrequency;

    return {
      fullUpdateMetrics: avgFull,
      deltaUpdateMetrics: avgDelta,
      improvements: {
        dataSizeReduction: Math.max(0, dataSizeReduction),
        processingSpeedup: Math.max(0, processingSpeedup),
        memoryReduction: Math.max(0, memoryReduction),
        bandwidthSavings
      }
    };
  }

  /**
   * リアルタイム統計取得
   */
  getRealTimeStats() {
    const recentMetrics = this.metrics.filter(
      m => m.timestamp > Date.now() - 60000 // 過去1分間
    );

    if (recentMetrics.length === 0) {
      return null;
    }

    const totalDataTransferred = recentMetrics.reduce((sum, m) => sum + m.dataSize, 0);
    const avgProcessingTime = recentMetrics.reduce((sum, m) => sum + m.processingTime, 0) / recentMetrics.length;
    const totalChangesProcessed = recentMetrics.reduce((sum, m) => sum + m.changeCount, 0);
    
    const deltaRatio = recentMetrics.filter(m => m.mode === 'delta').length / recentMetrics.length;

    return {
      sessionDuration: Date.now() - this.currentSessionStart,
      totalUpdates: recentMetrics.length,
      deltaUpdateRatio: deltaRatio * 100,
      totalDataTransferred,
      averageProcessingTime: avgProcessingTime,
      totalChangesProcessed,
      estimatedBandwidthSaved: this.calculateBandwidthSavings(recentMetrics)
    };
  }

  /**
   * パフォーマンス履歴取得
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * 統計クリア
   */
  clearMetrics(): void {
    this.metrics = [];
    this.currentSessionStart = Date.now();
  }

  /**
   * CSVエクスポート用データ生成
   */
  exportToCSV(): string {
    const headers = [
      'timestamp', 'mode', 'dataSize', 'originalDataSize', 'compressionRatio',
      'processingTime', 'memoryUsage', 'renderTime', 'messageSize', 
      'changeCount', 'totalStudentCount'
    ];

    const csvData = [
      headers.join(','),
      ...this.metrics.map(m => [
        new Date(m.timestamp).toISOString(),
        m.mode,
        m.dataSize,
        m.originalDataSize,
        m.compressionRatio.toFixed(3),
        m.processingTime.toFixed(2),
        m.memoryUsage,
        m.renderTime.toFixed(2),
        m.messageSize,
        m.changeCount,
        m.totalStudentCount
      ].join(','))
    ].join('\n');

    return csvData;
  }

  // プライベートヘルパーメソッド
  private estimateMemoryUsage(data: any): number {
    return JSON.stringify(data).length * 2; // 概算：JSON文字列の2倍
  }

  private calculateAverageMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
    const count = metrics.length;
    return {
      timestamp: metrics[metrics.length - 1].timestamp,
      mode: metrics[0].mode,
      dataSize: metrics.reduce((sum, m) => sum + m.dataSize, 0) / count,
      originalDataSize: metrics.reduce((sum, m) => sum + m.originalDataSize, 0) / count,
      compressionRatio: metrics.reduce((sum, m) => sum + m.compressionRatio, 0) / count,
      processingTime: metrics.reduce((sum, m) => sum + m.processingTime, 0) / count,
      memoryUsage: metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / count,
      renderTime: metrics.reduce((sum, m) => sum + m.renderTime, 0) / count,
      messageSize: metrics.reduce((sum, m) => sum + m.messageSize, 0) / count,
      messageCount: metrics.reduce((sum, m) => sum + m.messageCount, 0),
      changeCount: metrics.reduce((sum, m) => sum + m.changeCount, 0) / count,
      totalStudentCount: metrics[0].totalStudentCount
    };
  }

  private calculateBandwidthSavings(metrics: PerformanceMetrics[]): number {
    const fullMetrics = metrics.filter(m => m.mode === 'full');
    const deltaMetrics = metrics.filter(m => m.mode === 'delta');
    
    if (fullMetrics.length === 0 || deltaMetrics.length === 0) return 0;
    
    const avgFullSize = fullMetrics.reduce((sum, m) => sum + m.dataSize, 0) / fullMetrics.length;
    const avgDeltaSize = deltaMetrics.reduce((sum, m) => sum + m.dataSize, 0) / deltaMetrics.length;
    
    return (avgFullSize - avgDeltaSize) * metrics.length;
  }
}

// シングルトンインスタンス
export const performanceMonitor = new PerformanceMonitor();

// 自動測定ヘルパー
export const withPerformanceTracking = <T>(
  operation: () => T,
  label: string
): T => {
  const start = performance.now();
  console.time(label);
  
  try {
    const result = operation();
    const duration = performance.now() - start;
    console.timeEnd(label);
    console.log(`⚡ ${label}: ${duration.toFixed(2)}ms`);
    return result;
  } catch (error) {
    console.timeEnd(label);
    throw error;
  }
};