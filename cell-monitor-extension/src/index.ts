/**
 * Cell Monitor JupyterLab Extension
 * リファクタリング版 - モジュール化されたアーキテクチャ
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILabShell
} from '@jupyterlab/application';

import { ToolbarButton, Notification } from '@jupyterlab/apputils';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';

// 新しいモジュール化されたインポート
import { SettingsManager } from './core/SettingsManager';
import { EventManager } from './core/EventManager';
import { DataTransmissionService } from './services/DataTransmissionService';
import { createLogger, handleInitializationError, errorHandler } from './utils';

// プラグインの識別子
const PLUGIN_ID = 'cell-monitor:plugin';

// プラグインのメイン機能を管理するクラス
class CellMonitorPlugin {
  private app: JupyterFrontEnd;
  private settingsManager: SettingsManager;
  private dataTransmissionService: DataTransmissionService;
  private eventManager: EventManager;
  private logger = createLogger('CellMonitorPlugin');

  constructor(
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry,
    labShell: ILabShell
  ) {
    this.app = app;

    // 依存関係を注入してインスタンスを作成
    this.settingsManager = new SettingsManager();
    this.dataTransmissionService = new DataTransmissionService(this.settingsManager);
    this.eventManager = new EventManager(
      notebookTracker,
      this.settingsManager,
      this.dataTransmissionService
    );

    this.initialize(settingRegistry, labShell);
  }

  /**
   * プラグインの初期化
   */
  private async initialize(settingRegistry: ISettingRegistry, labShell: ILabShell): Promise<void> {
    try {
      this.logger.info('Initializing Cell Monitor extension...');

      // 設定管理の初期化
      await this.settingsManager.initialize(settingRegistry, PLUGIN_ID);

      // 設定変更の監視（チーム名バリデーション）
      this.setupSettingsValidation();

      // エラーハンドラーの設定を更新
      const { showNotifications } = this.settingsManager.getNotificationSettings();
      errorHandler.configure({ showNotifications });

      // イベント管理の初期化
      this.eventManager.initialize();

      // UIコンポーネントの初期化
      this.setupToolbarButtons(labShell);

      // 成功通知
      if (showNotifications) {
        Notification.success('Cell Monitor Extension Activated', { autoClose: 2000 });
      }

      this.logger.info('Cell Monitor extension activated successfully');
    } catch (error) {
      handleInitializationError(
        error instanceof Error ? error : new Error(String(error)),
        'Plugin initialization'
      );
      throw error; // JupyterLabに拡張機能の初期化失敗を知らせる
    }
  }

  /**
   * ツールバーボタンの設定
   */
  private setupToolbarButtons(labShell: ILabShell): void {
    // 新しいセッション開始ボタンのみを作成（ヘルプボタンは各ノートブックに個別追加）
    const newSessionButton = new ToolbarButton({
      label: '新セッション',
      tooltip: '新しい学習セッションを開始します',
      onClick: () => this.startNewSession(),
      className: 'jp-new-session-button'
    });

    // ツールバーに追加
    this.app.shell.add(newSessionButton, 'top', { rank: 1001 });
    this.logger.debug('New session button added to toolbar');
  }

  /**
   * 設定バリデーションの監視設定
   */
  private setupSettingsValidation(): void {
    const settings = this.settingsManager.getSettings();
    if (!settings) return;

    // 設定変更を監視
    settings.changed.connect(() => {
      const userInfo = this.settingsManager.getUserInfo();
      const validation = this.settingsManager.validateTeamName(userInfo.teamName);
      
      if (!validation.isValid) {
        // バリデーションエラーの通知
        Notification.error(
          `チーム名設定エラー: ${validation.error}`, 
          { autoClose: 5000 }
        );
        this.logger.error('Team name validation failed:', validation.error);
      }
    });
  }

  /**
   * 新しいセッションの開始
   */
  private startNewSession(): void {
    this.logger.info('Starting new learning session');
    
    // セッション開始前にチーム名をバリデーション
    const userInfo = this.settingsManager.getUserInfo();
    const validation = this.settingsManager.validateTeamName(userInfo.teamName);
    
    if (!validation.isValid) {
      Notification.error(
        `セッション開始失敗: ${validation.error}`, 
        { autoClose: 5000 }
      );
      return;
    }

    this.eventManager.startNewSession();

    const { showNotifications: showSessionNotifications } = this.settingsManager.getNotificationSettings();
    if (showSessionNotifications) {
      Notification.success(`新しい学習セッションを開始しました (${userInfo.teamName})`, { autoClose: 2000 });
    }
  }
}

/**
 * JupyterLab拡張機能の定義
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  description: 'JupyterLab extension for cell execution monitoring',
  autoStart: true,
  requires: [INotebookTracker, ISettingRegistry, ILabShell],
  activate: async (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry,
    labShell: ILabShell
  ): Promise<void> => {
    // プラグインクラスのインスタンス化と初期化
    new CellMonitorPlugin(app, notebookTracker, settingRegistry, labShell);
  }
};;

export default extension;
