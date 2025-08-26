/**
 * 負荷分散サービス
 * 学生IDベースの一意な遅延により、サーバー負荷を分散
 */

import { SettingsManager } from '../core/SettingsManager';
import { IStudentProgressData } from '../types/interfaces';
import { createLogger } from '../utils/logger';

export class LoadDistributionService {
  private logger = createLogger('LoadDistributionService');

  constructor(_settingsManager: SettingsManager) {
    // settingsManagerは将来の拡張で使用予定
  }

  /**
   * 負荷分散付きデータ送信
   */
  async sendWithLoadDistribution(
    data: IStudentProgressData[], 
    originalSendFunction: (data: IStudentProgressData[]) => Promise<void>
  ): Promise<void> {
    if (data.length === 0) return;

    // 動的遅延計算（セルID + タイムスタンプベース）
    const userEmail = data[0]?.emailAddress || '';
    const cellId = data[0]?.cellId || '';
    const timestamp = Date.now();
    const combinedSeed = `${userEmail}-${cellId}-${Math.floor(timestamp/1000)}`;
    const dynamicHash = this.hashString(combinedSeed);
    const baseDelay = (dynamicHash % 2000) + 200; // 0.2-2.2秒で動的変動
    
    this.logger.debug('Load distribution delay calculated', {
      userEmail: userEmail.substring(0, 5) + '***', // プライバシー保護
      delay: baseDelay,
      eventCount: data.length
    });

    // 遅延実行
    await new Promise(resolve => setTimeout(resolve, baseDelay));
    
    // 既存の送信機能を実行（指数バックオフ付き）
    await originalSendFunction(data);
  }

  /**
   * 文字列ハッシュ関数（一意性確保）
   */
  private hashString(str: string): number {
    if (!str) return 0;
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return Math.abs(hash);
  }
}