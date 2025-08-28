/**
 * メモリ効率的なタイマー管理プール
 * Promise蓄積を防止し、同時実行数を制限してメモリ使用量を最適化
 */

import { createLogger } from './logger';

export class TimerPool {
  private static activeTimers: Set<number> = new Set(); // ブラウザ環境ではnumber
  private static readonly MAX_CONCURRENT_TIMERS = 10; // 同時実行制限
  private static logger = createLogger('TimerPool');

  /**
   * メモリ効率的な遅延実行
   * @param ms 遅延時間（ミリ秒）
   * @returns Promise<void>
   */
  static async delay(ms: number): Promise<void> {
    // 同時実行数制限チェック
    if (this.activeTimers.size >= this.MAX_CONCURRENT_TIMERS) {
      await this.waitForAvailableSlot();
    }

    return new Promise<void>(resolve => {
      const timer = setTimeout(() => {
        this.activeTimers.delete(timer); // 使用後即座に削除
        resolve();
      }, ms) as unknown as number; // ブラウザ環境での型変換
      
      this.activeTimers.add(timer);
      
      this.logger.debug('Timer created', {
        activeCount: this.activeTimers.size,
        delayMs: ms
      });
    });
  }

  /**
   * 利用可能なスロットまで待機
   * @private
   */
  private static async waitForAvailableSlot(): Promise<void> {
    this.logger.debug('Timer pool full, waiting for available slot', {
      activeCount: this.activeTimers.size,
      maxConcurrent: this.MAX_CONCURRENT_TIMERS
    });

    while (this.activeTimers.size >= this.MAX_CONCURRENT_TIMERS) {
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms待機
    }
  }

  /**
   * アクティブなタイマー数を取得（デバッグ用）
   * @returns number
   */
  static getActiveTimerCount(): number {
    return this.activeTimers.size;
  }

  /**
   * 全タイマーをクリア（緊急時用）
   */
  static clearAllTimers(): void {
    for (const timer of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
    
    this.logger.warn('All timers cleared (emergency cleanup)');
  }

  /**
   * タイマープールの統計情報を取得
   */
  static getStats(): {
    activeTimers: number;
    maxConcurrent: number;
    memoryEstimateMB: number;
  } {
    return {
      activeTimers: this.activeTimers.size,
      maxConcurrent: this.MAX_CONCURRENT_TIMERS,
      memoryEstimateMB: (this.activeTimers.size * 0.001) // 概算値
    };
  }
}