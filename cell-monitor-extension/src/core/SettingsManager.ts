
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { createLogger, handleSettingsError } from '../utils';

/**
 * 設定管理クラス
 * JupyterLabの設定レジストリと連携してCell Monitor拡張機能の設定を管理
 */
export class SettingsManager {
  private settings: ISettingRegistry.ISettings | null = null;
  private logger = createLogger('SettingsManager');

  constructor() {
    // コンストラクタは空
  }

  /**
   * 設定を初期化
   */
  async initialize(settingRegistry: ISettingRegistry, pluginId: string): Promise<void> {
    try {
      this.settings = await settingRegistry.load(pluginId);

      // 設定変更の監視
      this.settings.changed.connect(() => {
        this.updateSettingsFromRegistry();
      });

      // 初回設定読み込み
      this.updateSettingsFromRegistry();

      this.logger.info('Settings initialized successfully');
    } catch (error) {
      handleSettingsError(
        error instanceof Error ? error : new Error(String(error)),
        'Settings initialization',
        '設定の初期化に失敗しました。デフォルト設定で継続します。'
      );
    }
  }

  /**
   * 設定レジストリから設定を更新
   */
  private updateSettingsFromRegistry(): void {
    if (!this.settings) return;

    try {
      // 設定値を取得して内部状態を更新
      const serverUrl = this.settings.get('serverUrl').composite as string;
      const emailAddress = this.settings.get('emailAddress').composite as string;
      const userName = this.settings.get('userName').composite as string;
      const teamName = this.settings.get('teamName').composite as string;
      const retryAttempts = this.settings.get('retryAttempts').composite as number;
      const showNotifications = this.settings.get('showNotifications').composite as boolean;

      this.logger.debug('Settings updated from registry', {
        serverUrl: serverUrl || 'default',
        emailAddress: emailAddress || 'student001@example.com',
        userName: userName || 'Anonymous',
        teamName: teamName || 'チームA',
        retryAttempts,
        showNotifications
      });
    } catch (error) {
      this.logger.warn('Failed to update settings from registry:', error);
    }
  }

  /**
   * 現在の設定を取得
   */
  getSettings(): ISettingRegistry.ISettings | null {
    return this.settings;
  }

  /**
   * ユーザー情報を取得
   */
  getUserInfo(): { emailAddress: string; userName: string; teamName: string } {
    if (!this.settings) {
      return {
        emailAddress: 'student001@example.com',
        userName: 'Anonymous',
        teamName: 'チームA'
      };
    }

    const settingEmailAddress = this.settings.get('emailAddress').composite as string;
    const settingUserName = this.settings.get('userName').composite as string;
    const settingTeamName = this.settings.get('teamName').composite as string;

    return {
      emailAddress: settingEmailAddress || 'student001@example.com',
      userName: settingUserName || 'Anonymous',
      teamName: settingTeamName || 'チームA'
    };
  }

  /**
   * サーバーURLを取得
   */
  getServerUrl(): string {
    if (!this.settings) {
      return 'http://localhost:8000/api/v1/events';
    }
    return this.settings.get('serverUrl').composite as string || 'http://localhost:8000/api/v1/events';
  }

  /**
   * リトライ回数を取得
   */
  getRetryAttempts(): number {
    if (!this.settings) {
      return 3;
    }
    return this.settings.get('retryAttempts').composite as number || 3;
  }

  /**
   * 通知設定を取得
   */
  getNotificationSettings(): { showNotifications: boolean } {
    if (!this.settings) {
      return { showNotifications: true };
    }
    const showNotifications = this.settings.get('showNotifications').composite as boolean;
    return { showNotifications: showNotifications !== undefined ? showNotifications : true };
  }
}
