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

    // 学生IDベースの一意な遅延計算（再現可能）
    const userEmail = data[0]?.emailAddress || '';
    const studentHash = this.hashString(userEmail);
    const baseDelay = (studentHash % 3000) + 500; // 0.5-3.5秒の遅延
    
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