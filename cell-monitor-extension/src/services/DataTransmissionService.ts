/**
 * データ送信サービス
 * APIへのデータ送信、再試行処理、通知表示を担当
 */

import axios, { AxiosInstance } from 'axios';
import { Notification } from '@jupyterlab/apputils';
import { IStudentProgressData, ICellExecutionData } from '../types/interfaces';
import { createLogger, handleDataTransmissionError, handleNetworkError } from '../utils';
import { SettingsManager } from '../core/SettingsManager';
import { LoadDistributionService } from './LoadDistributionService';

/**
 * データ送信サービス
 * 学習進捗データとレガシーセル実行データをサーバーに送信
 */
export class DataTransmissionService {
  private settingsManager: SettingsManager;
  private loadDistributionService: LoadDistributionService;
  private logger = createLogger('DataTransmissionService');
  private axiosInstance: AxiosInstance;
  private legacyAxiosInstance: AxiosInstance;
  private connectionPoolCleanupInterval: any | null = null;
  // Phase 2.2: HTTP重複送信防止
  private pendingRequests: Map<string, Promise<void>> = new Map();

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
    this.loadDistributionService = new LoadDistributionService(settingsManager);
    
    // HTTP接続プール設定（Phase 2.1: 接続プール最適化）
    this.axiosInstance = axios.create({
      timeout: 8000,
      headers: { 
        'Connection': 'keep-alive',
        'Content-Type': 'application/json'
      },
      maxRedirects: 3,
      validateStatus: (status) => status < 500
    });
    
    // レガシー用接続プール
    this.legacyAxiosInstance = axios.create({
      timeout: 8000,
      headers: { 
        'Connection': 'keep-alive',
        'Content-Type': 'application/json'
      },
      maxRedirects: 3,
      validateStatus: (status) => status < 500
    });
    
    // 接続プールのクリーンアップ設定
    this.setupConnectionPoolCleanup();
  }

  private setupConnectionPoolCleanup(): void {
    // 30秒ごとに接続プールの状況をログ出力（ブラウザでは自動クリーンアップされる）
    this.connectionPoolCleanupInterval = setInterval(() => {
      this.logger.debug('HTTP connection pool status check - automatic cleanup by browser');
    }, 30000);
  }

  /**
   * クリーンアップメソッド（必要に応じて呼び出し）
   */
  dispose(): void {
    if (this.connectionPoolCleanupInterval) {
      clearInterval(this.connectionPoolCleanupInterval);
      this.connectionPoolCleanupInterval = null;
    }
    
    // Phase 2.2: 未完了のリクエストをクリーンアップ
    this.pendingRequests.clear();
    
    this.logger.debug('DataTransmissionService disposed', {
      pendingRequestsCleared: true
    });
  }

  /**
   * 学習進捗データを送信（負荷分散機能付き + 重複送信防止）
   */
  async sendProgressData(data: IStudentProgressData[]): Promise<void> {
    if (data.length === 0) return;

    // Phase 2.2: 重複送信防止機能を適用
    for (const event of data) {
      await this.sendSingleEventWithDeduplication(event);
    }
  }

  /**
   * Phase 2.2: 重複送信防止付き単一イベント送信
   */
  private async sendSingleEventWithDeduplication(event: IStudentProgressData): Promise<void> {
    // 重複チェック用キー（セルID + イベントタイプ + タイムスタンプ分単位）
    const timeKey = Math.floor(Date.now() / 60000); // 1分単位でキー生成
    const requestKey = `${event.cellId || 'unknown'}-${event.eventType}-${timeKey}`;
    
    // 既に同じリクエストが進行中なら待機
    if (this.pendingRequests.has(requestKey)) {
      this.logger.debug('Duplicate request detected, waiting...', { 
        cellId: event.cellId?.substring(0, 8) + '...',
        eventType: event.eventType,
        requestKey: requestKey.substring(0, 20) + '...'
      });
      await this.pendingRequests.get(requestKey);
      return;
    }
    
    // 新規リクエストを実行
    const promise = this.sendSingleEventInternal([event]);
    this.pendingRequests.set(requestKey, promise);
    
    promise.finally(() => {
      this.pendingRequests.delete(requestKey);
    });
    
    await promise;
  }

  /**
   * Phase 2.2: 単一イベントの内部送信処理（負荷分散考慮）
   */
  private async sendSingleEventInternal(data: IStudentProgressData[]): Promise<void> {
    // 負荷分散設定が有効な場合（デフォルトは有効）
    let useLoadDistribution = true; // デフォルト値
    
    try {
      const settings = this.settingsManager.getSettings();
      if (settings && settings.get) {
        const loadDistSetting = settings.get('useLoadDistribution');
        if (loadDistSetting && loadDistSetting.composite !== undefined) {
          useLoadDistribution = loadDistSetting.composite as boolean;
        }
      }
    } catch (error) {
      this.logger.debug('Failed to get load distribution setting, using default', error);
    }
    
    if (useLoadDistribution) {
      // 負荷分散付き送信
      await this.loadDistributionService.sendWithLoadDistribution(
        data, 
        (data) => this.sendProgressDataInternal(data)
      );
    } else {
      // 従来通りの送信
      await this.sendProgressDataInternal(data);
    }
  }

  /**
   * 内部送信機能（既存ロジック）
   */
  private async sendProgressDataInternal(data: IStudentProgressData[]): Promise<void> {
    const { showNotifications } = this.settingsManager.getNotificationSettings();

    this.logger.debug('Sending progress data', {
      eventCount: data.length,
      showNotifications,
      events: data.map(d => ({ eventType: d.eventType, eventId: d.eventId }))
    });

    const serverUrl = this.settingsManager.getServerUrl();
    const maxRetries = this.settingsManager.getRetryAttempts();
    let retries = 0;

    while (retries <= maxRetries) {
      try {
        // Phase 2.1: 接続プール付きaxiosインスタンスを使用
        await this.axiosInstance.post(serverUrl, data);
        this.logger.info('Student progress data sent successfully', { eventCount: data.length });

        if (data.length > 0 && showNotifications) {
          Notification.info(`Learning data sent (${data.length} events)`, {
            autoClose: 3000
          });
        }
        break;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));

        if (retries >= maxRetries) {
          handleDataTransmissionError(
            errorObj,
            'Progress data transmission - max retries exceeded',
            { eventCount: data.length, retryAttempt: retries }
          );
          break;
        } else {
          handleNetworkError(
            errorObj,
            `Progress data transmission - retry ${retries}/${maxRetries}`,
            undefined
          );
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
        }

        retries++;
      }
    }
  }

  /**
   * レガシーセル実行データを送信（後方互換性のため）
   */
  async sendLegacyData(data: ICellExecutionData[]): Promise<void> {
    if (data.length === 0) return;

    const serverUrl = this.settingsManager.getServerUrl();
    const legacyUrl = serverUrl.replace('student-progress', 'cell-monitor');
    const maxRetries = this.settingsManager.getRetryAttempts();
    let retries = 0;

    while (retries <= maxRetries) {
      try {
        // Phase 2.1: レガシー用接続プール付きaxiosインスタンスを使用
        await this.legacyAxiosInstance.post(legacyUrl, data);
        this.logger.info('Legacy cell execution data sent successfully', { itemCount: data.length });
        break;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));

        if (retries >= maxRetries) {
          handleDataTransmissionError(
            errorObj,
            'Legacy data transmission - max retries exceeded',
            { itemCount: data.length, retryAttempt: retries }
          );
          break;
        } else {
          handleNetworkError(
            errorObj,
            `Legacy data transmission - retry ${retries}/${maxRetries}`
          );
        }

        retries++;
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
      }
    }
  }
}