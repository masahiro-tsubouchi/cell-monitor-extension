/**
 * データ送信サービス
 * APIへのデータ送信、再試行処理、通知表示を担当
 */

import axios from 'axios';
import { Notification } from '@jupyterlab/apputils';
import { IStudentProgressData, ICellExecutionData } from '../types/interfaces';
import { createLogger, handleDataTransmissionError, handleNetworkError } from '../utils';
import { SettingsManager } from '../core/SettingsManager';

/**
 * データ送信サービス
 * 学習進捗データとレガシーセル実行データをサーバーに送信
 */
export class DataTransmissionService {
  private settingsManager: SettingsManager;
  private logger = createLogger('DataTransmissionService');

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
  }

  /**
   * 学習進捗データを送信
   */
  async sendProgressData(data: IStudentProgressData[]): Promise<void> {
    if (data.length === 0) return;

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
        await axios.post(serverUrl, data);
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
            undefined // Let the error handler decide the message
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
        await axios.post(legacyUrl, data);
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
