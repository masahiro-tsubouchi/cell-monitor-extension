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
      const rawTimeDiff = currentTime - lastTime;
      const timeDiff = Math.max(0, Math.min(rawTimeDiff, 300000)); // 5分上限
      
      // 異常値検出とログ出力
      if (rawTimeDiff > 300000) {
        this.logger.warn('Abnormal timestamp detected', {
          currentTime, 
          lastTime, 
          rawDiff: rawTimeDiff
        });
      }

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
  startHelpSession(): void {
    const currentWidget = this.notebookTracker.currentWidget;
    if (!currentWidget) {
      this.logger.warn('No notebook widget available for help session start');
      return;
    }

    const notebookPath = currentWidget.context.path || 'unknown';
    const { emailAddress, userName, teamName } = this.settingsManager.getUserInfo();

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

    // 背景でサーバー通信（エラーはUIをブロックしない）
    this.dataTransmissionService.sendProgressData([progressData])
      .then(() => {
        const { showNotifications } = this.settingsManager.getNotificationSettings();
        if (showNotifications) {
          Notification.info('ヘルプセッションを開始しました', { autoClose: 2000 });
        }
        this.logger.debug('Help session started successfully');
      })
      .catch((error) => {
        this.logger.error('Failed to start help session:', error);
        // エラーはログのみ、UIはブロックしない
      });
  }

  /**
   * ヘルプセッションを停止
   */
  stopHelpSession(): void {
    const currentWidget = this.notebookTracker.currentWidget;
    if (!currentWidget) {
      this.logger.warn('No notebook widget available for help session stop');
      return;
    }

    const notebookPath = currentWidget.context.path || 'unknown';
    const { emailAddress, userName, teamName } = this.settingsManager.getUserInfo();

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

    // 背景でサーバー通信（エラーはUIをブロックしない）
    this.dataTransmissionService.sendProgressData([progressData])
      .then(() => {
        const { showNotifications } = this.settingsManager.getNotificationSettings();
        if (showNotifications) {
          Notification.success('ヘルプセッションを停止しました', { autoClose: 2000 });
        }
        this.logger.debug('Help session stopped successfully');
      })
      .catch((error) => {
        this.logger.error('Failed to stop help session:', error);
        // エラーはログのみ、UIはブロックしない
      });
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
   * ヘルプボタンを作成する（DOM安全版）
   */
  private createHelpButton(): ToolbarButton {
    this.logger.debug('Creating help button with DOM-safe implementation...');

    const helpButton: ToolbarButton = new ToolbarButton({
      className: 'jp-help-button jp-ToolbarButton',
      onClick: () => {
        this.logger.debug('Help button clicked!');
        this.toggleHelpState(helpButton);
      },
      tooltip: 'ヘルプ要請ボタン - クリックでON/OFF切替',
      label: '🆘 講師に助けを求める',
      iconClass: 'jp-help-button__icon',
      enabled: true
    });

    this.logger.debug('ToolbarButton created with persistent onClick handler');
    return helpButton;
  }


  /**
   * ヘルプ状態を切り替え（シンプルトグル）
   */
  private toggleHelpState(button: ToolbarButton): void {
    const currentWidget = this.notebookTracker.currentWidget;
    if (!currentWidget) {
      Notification.warning('ノートブックが開かれていません');
      return;
    }

    // UI状態で判定（シンプルで確実）
    const isCurrentlyActive = button.node.classList.contains('jp-help-button--active');
    
    this.logger.debug('toggleHelpState called, currently active:', isCurrentlyActive);

    if (!isCurrentlyActive) {
      // OFF → ON: 即座にUI切替 + 背景でサーバー通信
      this.activateHelpButton(button);
      this.startHelpSession(); // await削除、エラーは内部処理
    } else {
      // ON → OFF: 即座にUI切替 + 背景でサーバー通信
      this.deactivateHelpButton(button);
      this.stopHelpSession(); // await削除、エラーは内部処理
    }
  }

  /**
   * ヘルプボタンをアクティブ状態に切り替え（DOM安全版）
   */
  private activateHelpButton(button: ToolbarButton): void {
    // CSS状態変更（イベントハンドラー保持）
    button.node.classList.add('jp-help-button--active');
    
    // テキストコンテンツのみ変更（DOM構造保持）
    const textElement = button.node.querySelector('.jp-ToolbarButtonComponent-label');
    if (textElement) {
      textElement.textContent = '🆘 ヘルプ要請中...';
    }
    
    // タイトル属性でツールチップ更新
    button.node.setAttribute('title', 'ヘルプ要請中 - クリックで停止');
    
    // 内部状態も更新
    const currentWidget = this.notebookTracker.currentWidget;
    if (currentWidget) {
      const notebookPath = currentWidget.context.path || 'unknown';
      this.helpSession.set(notebookPath, true);
    }
    
    this.logger.debug('Help button activated with DOM-safe method');
  }

  /**
   * ヘルプボタンを非アクティブ状態に切り替え（DOM安全版）
   */
  private deactivateHelpButton(button: ToolbarButton): void {
    // CSS状態変更（イベントハンドラー保持）
    button.node.classList.remove('jp-help-button--active');
    
    // テキストコンテンツのみ変更（DOM構造保持）
    const textElement = button.node.querySelector('.jp-ToolbarButtonComponent-label');
    if (textElement) {
      textElement.textContent = '🆘 講師に助けを求める';
    }
    
    // タイトル属性でツールチップ更新
    button.node.setAttribute('title', 'ヘルプ要請ボタン - クリックでON/OFF切替');
    
    // 内部状態も更新
    const currentWidget = this.notebookTracker.currentWidget;
    if (currentWidget) {
      const notebookPath = currentWidget.context.path || 'unknown';
      this.helpSession.set(notebookPath, false);
    }
    
    this.logger.debug('Help button deactivated with DOM-safe method');
  }
}
