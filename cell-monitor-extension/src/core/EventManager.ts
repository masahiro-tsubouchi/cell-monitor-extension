/**
 * イベント管理クラス
 * JupyterLabのノートブックイベントを監視し、学習進捗データを収集・送信
 */

import { INotebookTracker, NotebookActions } from '@jupyterlab/notebook';
import { Notification, ToolbarButton } from '@jupyterlab/apputils';
import { IStudentProgressData, EventType } from '../types/interfaces';
import { generateUUID, createLogger, handleCellProcessingError, handleUIError } from '../utils';
import { SettingsManager } from './SettingsManager';
import { DataTransmissionService } from '../services/DataTransmissionService';

export class EventManager {
  private notebookTracker: INotebookTracker;
  private settingsManager: SettingsManager;
  private dataTransmissionService: DataTransmissionService;
  private sessionId: string;
  private executionHandlerRegistered: boolean = false;
  private helpSession: Map<string, boolean> = new Map();
  private processedCells: Map<string, number> = new Map();
  private logger = createLogger('EventManager');
  // private lastProcessedTime: number = 0; // 将来の実装用に残しておく

  constructor(
    notebookTracker: INotebookTracker,
    settingsManager: SettingsManager,
    dataTransmissionService: DataTransmissionService
  ) {
    this.notebookTracker = notebookTracker;
    this.settingsManager = settingsManager;
    this.dataTransmissionService = dataTransmissionService;
    this.sessionId = generateUUID();
  }

  /**
   * イベントハンドラを初期化
   */
  initialize(): void {
    this.setupNotebookTracking();
    this.setupExecutionTracking();
  }

  /**
   * ノートブック関連イベントの追跡設定
   */
  private setupNotebookTracking(): void {
    this.notebookTracker.widgetAdded.connect((sender, widget) => {
      const notebookPath = widget.context.path || 'unknown';
      this.sendNotebookEvent('notebook_opened', notebookPath);

      // 元のコードと同じように各ノートブックのツールバーにヘルプボタンを追加
      this.addHelpButtonToNotebook(widget);
    });
  }

  /**
   * セル実行イベントの追跡設定（元のコードと同じ方式）
   */
  private setupExecutionTracking(): void {
    if (this.executionHandlerRegistered) {
      return;
    }

    // 元のコードと同じ方式でNotebookActions.executed.connectを使用
    NotebookActions.executed.connect((_: any, args) => {
      const { cell } = args;
      this.processCellExecution(cell);
    });

    this.executionHandlerRegistered = true;
    this.logger.info('Cell execution handler registered (once)');
  }

  /**
   * セル実行を処理（元のコードと完全に同じロジック）
   */
  private processCellExecution(cell: any): void {
    try {
      if (!cell || !cell.model) return;

      // 処理開始時間（パフォーマンス計測用）
      const startTime = performance.now();

      const cellId = cell.model.id;

      // 重複処理防止機構（元のコードと同じ）
      const currentTime = Date.now();
      const lastTime = this.processedCells.get(cellId) || 0;
      const timeDiff = currentTime - lastTime;

      this.logger.perfDebug('Cell execution processing', {
        cellId,
        timeSinceLastProcessing: timeDiff,
        alreadyProcessed: this.processedCells.has(cellId),
        memoryUsage: `${this.processedCells.size} / 50 max`
      });

      // 500ms以内の重複処理を防止（デバウンス）
      if (timeDiff < 500 && this.processedCells.has(cellId)) {
        this.logger.debug('Skipping duplicate cell execution processing', { cellId, timeDiff });
        return;
      }

      // 処理済みマークを更新
      this.processedCells.set(cellId, currentTime);

      // 軽量メモリ管理（受講生PCの負荷最小化）
      if (this.processedCells.size >= 50) {  // 100→50に削減
        // 重いソート処理を避け、最初のエントリを削除（FIFO方式）
        const firstKey = this.processedCells.keys().next().value;
        if (firstKey) {
          this.processedCells.delete(firstKey);
          this.logger.debug('Memory cleanup: removed oldest cell entry', {
            removedKey: firstKey,
            currentSize: this.processedCells.size
          });
        }
      }

      // 安全にセルのコードを取得する方法
      let code = '';
      try {
        if (cell.model.sharedModel && cell.model.sharedModel.source) {
          code = cell.model.sharedModel.source;
        } else if (cell.model.value && cell.model.value.text) {
          code = cell.model.value.text;
        } else if (cell.editor && cell.editor.model && cell.editor.model.value) {
          code = cell.editor.model.value.text;
        }
      } catch (error) {
        this.logger.warn('Failed to get cell code:', error);
      }

      // Get notebook widget from cell
      const notebookWidget = this.notebookTracker.currentWidget;
      if (!notebookWidget) return;

      // Get notebook path
      const notebookPath = notebookWidget.context?.path || '';

      // Get cell index and type
      let cellIndex: number | undefined = undefined;
      let cellType: string | undefined = undefined;

      try {
        // セルのインデックスを取得
        const cells = notebookWidget.content.widgets;
        for (let i = 0; i < cells.length; i++) {
          if (cells[i].model.id === cellId) {
            cellIndex = i;
            break;
          }
        }

        // セルのタイプを取得
        if (cell.model.type) {
          cellType = cell.model.type as any;
        }
      } catch (error) {
        this.logger.warn('Failed to get cell index or type:', error);
      }

      // Get execution results
      let hasError = false;
      let resultText = '';
      let errorMessage = '';
      let executionCount: number | undefined = undefined;

      if (cell.outputArea) {
        // 実行カウントを取得
        try {
          executionCount = cell.model.executionCount || undefined;
        } catch (error) {
          this.logger.warn('Failed to get execution count:', error);
        }

        const outputs = cell.outputArea.model.toJSON();
        for (const output of outputs) {
          if (output.output_type === 'error') {
            hasError = true;
            errorMessage = `${output.ename}: ${output.evalue}`;
            resultText = errorMessage;
            break;
          } else if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
            if (output.data) {
              if (output.data['text/plain']) {
                resultText = output.data['text/plain'];
              }
            }
          }
        }
      }

      // 実行時間の計測
      const endTime = performance.now();
      const executionDurationMs = Math.round(endTime - startTime);

      // ユーザー情報を取得
      const { emailAddress, userName, teamName } = this.settingsManager.getUserInfo();

      // 新しいデータモデル
      const progressData: IStudentProgressData = {
        eventId: generateUUID(),
        eventType: 'cell_executed',
        eventTime: new Date().toISOString(),
        emailAddress,
        teamName,
        userName,
        sessionId: this.sessionId,
        notebookPath,
        cellId,
        cellIndex,
        cellType: cellType as any,
        code,
        executionCount,
        hasError,
        errorMessage: hasError ? errorMessage : undefined,
        result: resultText,
        executionDurationMs
      };

      // データを送信
      this.dataTransmissionService.sendProgressData([progressData]);
    } catch (error) {
      handleCellProcessingError(
        error instanceof Error ? error : new Error(String(error)),
        'Cell execution processing',
        { cellId: cell?.model?.id }
      );
    }
  }

  /**
   * ノートブックイベントを送信
   */
  private async sendNotebookEvent(eventType: EventType, notebookPath: string): Promise<void> {
    try {
      const { emailAddress, userName, teamName } = this.settingsManager.getUserInfo();

      const progressData: IStudentProgressData = {
        eventId: generateUUID(),
        eventType,
        eventTime: new Date().toISOString(),
        emailAddress,
        teamName,
        userName,
        sessionId: this.sessionId,
        notebookPath
      };

      await this.dataTransmissionService.sendProgressData([progressData]);
    } catch (error) {
      handleCellProcessingError(
        error instanceof Error ? error : new Error(String(error)),
        'Notebook event transmission',
        { eventType, notebookPath }
      );
    }
  }

  /**
   * ヘルプセッションを開始
   */
  async startHelpSession(): Promise<void> {
    try {
      const currentWidget = this.notebookTracker.currentWidget;
      if (!currentWidget) {
        Notification.warning('ノートブックが開かれていません');
        return;
      }

      const notebookPath = currentWidget.context.path || 'unknown';
      const { emailAddress, userName, teamName } = this.settingsManager.getUserInfo();

      this.helpSession.set(notebookPath, true);

      const progressData: IStudentProgressData = {
        eventId: generateUUID(),
        eventType: 'help',
        eventTime: new Date().toISOString(),
        emailAddress,
        teamName,
        userName,
        sessionId: this.sessionId,
        notebookPath
      };

      await this.dataTransmissionService.sendProgressData([progressData]);

      const { showNotifications } = this.settingsManager.getNotificationSettings();
      if (showNotifications) {
        Notification.info('ヘルプセッションを開始しました', { autoClose: 2000 });
      }
    } catch (error) {
      handleUIError(
        error instanceof Error ? error : new Error(String(error)),
        'Help session start',
        'ヘルプセッションの開始に失敗しました。'
      );
    }
  }

  /**
   * ヘルプセッションを停止
   */
  async stopHelpSession(): Promise<void> {
    try {
      const currentWidget = this.notebookTracker.currentWidget;
      if (!currentWidget) {
        return;
      }

      const notebookPath = currentWidget.context.path || 'unknown';

      if (!this.helpSession.get(notebookPath)) {
        return;
      }

      const { emailAddress, userName, teamName } = this.settingsManager.getUserInfo();

      this.helpSession.set(notebookPath, false);

      const progressData: IStudentProgressData = {
        eventId: generateUUID(),
        eventType: 'help_stop',
        eventTime: new Date().toISOString(),
        emailAddress,
        teamName,
        userName,
        sessionId: this.sessionId,
        notebookPath
      };

      await this.dataTransmissionService.sendProgressData([progressData]);

      const { showNotifications } = this.settingsManager.getNotificationSettings();
      if (showNotifications) {
        Notification.success('ヘルプセッションを停止しました', { autoClose: 2000 });
      }
    } catch (error) {
      handleUIError(
        error instanceof Error ? error : new Error(String(error)),
        'Help session stop',
        'ヘルプセッションの停止に失敗しました。'
      );
    }
  }

  /**
   * 新しいセッションを開始
   */
  startNewSession(): void {
    this.sessionId = generateUUID();
    this.helpSession.clear();
    this.processedCells.clear();
    // this.lastProcessedTime = 0;
    this.logger.info('New session started:', this.sessionId);
  }

  /**
   * ノートブックのツールバーにヘルプボタンを追加（元のコードと同じ方式）
   */
  private addHelpButtonToNotebook(widget: any): void {
    if (widget.toolbar) {
      try {
        // 既存のヘルプボタンを削除（重複防止）
        const existingHelpButton = widget.toolbar.node.querySelector('.jp-help-button');
        if (existingHelpButton) {
          this.logger.debug('Removing existing help button to prevent duplicates');
          existingHelpButton.remove();
        }

        const helpButton = this.createHelpButton();
        widget.toolbar.addItem('help-button', helpButton);
        this.logger.info('Help button added to notebook toolbar');

      } catch (error) {
        handleUIError(
          error instanceof Error ? error : new Error(String(error)),
          'Help button creation',
          'ヘルプボタンの作成に失敗しました。'
        );
      }
    }
  }

  /**
   * ヘルプボタンを作成する（元のコードベース）
   */
  private createHelpButton(): ToolbarButton {
    this.logger.debug('Creating help button with best practices...');

    const helpButton: ToolbarButton = new ToolbarButton({
      className: 'jp-help-button jp-ToolbarButton',
      onClick: () => {}, // 初期化時は空関数
      tooltip: 'ヘルプ要請ボタン - クリックでON/OFF切替',
      label: '講師に助けを求める',
      iconClass: '',
      enabled: true
    });

    this.logger.debug('ToolbarButton created:', helpButton);

    // DOM挿入後にクリックイベントを設定
    setTimeout(() => {
      helpButton.onClick = () => {
        this.logger.debug('Help button clicked!');
        this.toggleHelpState(helpButton);
      };

      // バックアップとしてDOMイベントリスナーも追加
      const buttonNode = helpButton.node;
      buttonNode.addEventListener('click', (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        this.logger.debug('Help button DOM click event triggered');
        this.toggleHelpState(helpButton);
      });

      this.logger.debug('Help button click handlers set up');
    }, 100);

    return helpButton;
  }

  /**
   * ヘルプ状態を切り替え（元のコードロジック）
   */
  private toggleHelpState(button: ToolbarButton): void {
    const currentWidget = this.notebookTracker.currentWidget;
    if (!currentWidget) {
      Notification.warning('ノートブックが開かれていません');
      return;
    }

    const notebookPath = currentWidget.context.path || 'unknown';
    const isHelpActive = this.helpSession.get(notebookPath) || false;

    this.logger.debug('toggleHelpState called, current state:', isHelpActive);

    if (!isHelpActive) {
      // ヘルプセッション開始
      this.startHelpSession();
      button.node.style.backgroundColor = '#ff6b6b';
      button.node.style.color = 'white';
      button.node.textContent = 'ヘルプ中...';
    } else {
      // ヘルプセッション停止
      this.stopHelpSession();
      button.node.style.backgroundColor = '';
      button.node.style.color = '';
      button.node.textContent = '講師に助けを求める';
    }
  }
}
