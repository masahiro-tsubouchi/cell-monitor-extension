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
   * 新しいセッションの開始
   */
  private startNewSession(): void {
    this.logger.info('Starting new learning session');
    this.eventManager.startNewSession();

    const { showNotifications: showSessionNotifications } = this.settingsManager.getNotificationSettings();
    if (showSessionNotifications) {
      Notification.info('新しい学習セッションを開始しました', { autoClose: 2000 });
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
