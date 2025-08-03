import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILabShell
} from '@jupyterlab/application';

import { Notification, ToolbarButton } from '@jupyterlab/apputils';

import { INotebookTracker, NotebookActions } from '@jupyterlab/notebook';
// PageConfig is used in the commented-out code for future features
// import { PageConfig } from '@jupyterlab/coreutils';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { Widget } from '@lumino/widgets';
import axios from 'axios';

/**
 * Settings interface for the cell-monitor extension
 */
interface ISettings {
  serverUrl: string;
  userId: string;
  userName: string;
  batchSize: number;
  retryAttempts: number;
  maxNotifications: number;
  showNotifications: boolean;
}

/**
 * イベントタイプの定義
 * 学習進捗データの種別を表す
 */
type EventType = 'cell_executed' | 'notebook_opened' | 'notebook_saved' | 'notebook_closed' | 'help';

/**
 * セル種別の定義
 * Jupyter Notebookのセル種別を表す
 */
type CellType = 'code' | 'markdown' | 'raw';

/**
 * 学習進捗データインターフェース（拡張版）
 * 受講生の学習進捗をより詳細に追跡するためのデータ構造
 */
interface IStudentProgressData {
  // --- 基本情報 ---
  eventId: string;         // イベントの一意なID
  eventType: EventType;    // イベントの種類
  eventTime: string;       // イベント発生時刻 (ISO 8601形式)

  // --- 受講生情報 ---
  userId: string;          // 受講生を識別する一意なID
  userName: string;        // 受講生の表示名（任意）
  sessionId: string;       // 学習セッションを識別するID

  // --- ノートブック情報 ---
  notebookPath: string;    // ノートブックのパス
  // --- セル情報（セル実行イベントの場合のみ使用） ---
  cellId?: string;         // セルのID
  cellIndex?: number;      // ノートブック内でのセルの位置
  cellType?: CellType;     // セルの種類
  code?: string;           // 実行されたコード
  executionCount?: number; // そのセルの実行回数

  // --- 実行結果情報 ---
  hasError?: boolean;      // エラーの有無
  errorMessage?: string;   // エラーメッセージ（エラーがある場合）
  result?: string;         // 実行結果
  executionDurationMs?: number; // セル実行にかかった時間（ミリ秒）
}

/**
 * 従来の Cell execution data interface (後方互換性のため保持)
 */
interface ICellExecutionData {
  cellId: string;
  code: string;
  executionTime: string;
  result: string;
  hasError: boolean;
  notebookPath: string;
}

/**
 * ユーティリティ関数: UUIDを生成する
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * ユーティリティ関数: パスからファイル名を抽出する
 * 将来的な拡張のために用意されている関数
 */
// 未使用警告を避けるため一時的にコメントアウト
/* function extractFilenameFromPath(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
} */

/**
 * ユーティリティ関数: JupyterLabからユーザー情報を取得する
 * 設定からユーザー情報を取得し、設定がない場合はデフォルト値を使用
 * 一度生成されたIDは保持し、一貫性のある識別を保証する
 */
// 永続的なユーザーIDを保持する変数（生成したIDを保存）
let persistentUserId: string = '';

function getUserInfo(): { userId: string; userName: string } {
  // 設定からユーザー情報を取得
  let userId = globalSettings.userId;
  const userName = globalSettings.userName || 'Anonymous';

  // 設定で明示的に指定されているIDがある場合はそれを優先
  if (userId && userId.length > 0) {
    // 設定の値を永続IDにも保存
    persistentUserId = userId;
    return { userId, userName };
  }

  // 過去に生成したIDがある場合はそれを使用
  if (persistentUserId && persistentUserId.length > 0) {
    return { userId: persistentUserId, userName };
  }

  // どちらもない場合は生成して保存
  persistentUserId = generateUUID();
  return { userId: persistentUserId, userName };
}

// グローバル変数
let globalServerUrl = '';
let sessionId = generateUUID(); // セッションIDの初期化
let globalSettings: ISettings = {
  serverUrl: '',
  userId: '',
  userName: 'Anonymous',
  batchSize: 1,
  retryAttempts: 3,
  maxNotifications: 3,
  showNotifications: true
};

// ヘルプセッション管理用のグローバル変数
let helpSession = {
  isActive: false,
  timerId: null as number | null
};

// sendProgressData関数のグローバル参照
let globalSendProgressData: ((data: IStudentProgressData[]) => void) | null = null;

// セル実行の重複防止用のグローバル変数
let processedCells = new Set<string>();
let lastProcessedTime = new Map<string, number>();

// 設定から最大表示メッセージ数を取得するユーティリティ関数
function getMaxNotifications(settings: ISettingRegistry.ISettings): number {
  return settings.get('maxNotifications').composite as number;
}

/**
 * ヘルプイベントデータを作成する関数
 */
function createHelpEventData(): IStudentProgressData {
  const { userId, userName } = getUserInfo();
  return {
    eventId: generateUUID(),
    eventType: 'help',
    eventTime: new Date().toISOString(),
    userId: userId,
    userName: userName,
    sessionId: sessionId,
    notebookPath: '',
    cellId: '',
    cellIndex: undefined,
    cellType: undefined,
    code: '',
    executionCount: undefined,
    hasError: undefined,
    errorMessage: undefined,
    result: '',
    executionDurationMs: undefined
  };
}

/**
 * ヘルプ要請タイマーを開始する関数
 */
function startHelpRequestTimer(): void {
  if (helpSession.timerId) {
    clearInterval(helpSession.timerId);
  }

  helpSession.timerId = setInterval(() => {
    if (helpSession.isActive && globalSendProgressData) {
      const helpEventData = createHelpEventData();
      console.log('Sending help event data:', helpEventData);
      globalSendProgressData([helpEventData]);
    }
  }, 5000) as any; // 5秒間隔
}

/**
 * ヘルプ要請タイマーを停止する関数
 */
function stopHelpRequestTimer(): void {
  if (helpSession.timerId) {
    clearInterval(helpSession.timerId);
    helpSession.timerId = null;
  }
}

/**
 * ヘルプボタンの外観を更新する関数
 */
function updateHelpButtonAppearance(button: any): void {
  // DOMノードの存在確認（NotFoundError対策）
  if (!button || !button.node) {
    console.warn('Help button or button.node is not available');
    return;
  }

  try {
    if (helpSession.isActive) {
      // ON状態: アクティブスタイルと「ヘルプ要請中...」表示
      button.addClass('jp-mod-active');
      button.node.textContent = 'ヘルプ要請中...';
      button.node.setAttribute('aria-pressed', 'true');
      button.node.style.backgroundColor = '#ff6b35'; // オレンジ色でアクティブ状態を示す
      button.node.style.color = 'white';
      console.log('Help button set to ACTIVE state');
    } else {
      // OFF状態: 通常スタイルと「HELP」表示
      button.removeClass('jp-mod-active');
      button.node.textContent = 'HELP'; // 新要件: OFF時は「HELP」表示
      button.node.setAttribute('aria-pressed', 'false');
      button.node.style.backgroundColor = '#007acc'; // 青色で通常状態を示す
      button.node.style.color = 'white';
      console.log('Help button set to INACTIVE state (HELP)');
    }
  } catch (error) {
    console.error('Error updating help button appearance:', error);
  }
}

/**
 * ヘルプ状態を切り替える関数（改善版）
 */
function toggleHelpState(button: any): void {
  console.log('toggleHelpState called, current state:', helpSession.isActive);

  // 状態を切り替え
  helpSession.isActive = !helpSession.isActive;

  console.log('New help state:', helpSession.isActive ? 'ACTIVE (ON)' : 'INACTIVE (OFF)');

  if (helpSession.isActive) {
    // ON状態: タイマー開始
    console.log('Starting help request timer...');
    startHelpRequestTimer();

    // 即座に1回目のヘルプイベントを送信
    if (globalSendProgressData) {
      const helpEventData = createHelpEventData();
      console.log('Sending immediate help event on activation:', helpEventData);
      globalSendProgressData([helpEventData]);
    }
  } else {
    // OFF状態: タイマー停止
    console.log('Stopping help request timer...');
    stopHelpRequestTimer();
  }

  // ボタンの外観を更新
  updateHelpButtonAppearance(button);

  console.log('toggleHelpState completed');
}

/**
 * ヘルプボタンを作成する関数（ベストプラクティス実装）
 */
function createHelpButton(): ToolbarButton {
  console.log('Creating help button with best practices...');

  // 仮説8対策: JupyterLabのToolbarButtonベストプラクティスに従った実装
  const helpButton: ToolbarButton = new ToolbarButton({
    className: 'jp-help-button jp-ToolbarButton', // JupyterLab標準クラスを追加
    onClick: () => {}, // 初期化時は空関数
    tooltip: 'ヘルプ要請ボタン - クリックでON/OFF切替',
    label: 'HELP', // ラベルを明示的に設定
    iconClass: '', // アイコンは使用しない
    enabled: true // 有効化
  });

  console.log('ToolbarButton created with best practices:', helpButton);
  console.log('ToolbarButton node:', helpButton.node);

  // 仮説7対策: DOM挿入タイミング問題を避けるため、後からonClickを設定
  setTimeout(() => {
    // ボタンのクリックイベントを安全に設定
    helpButton.onClick = () => {
      console.log('Help button clicked!');
      toggleHelpState(helpButton);
    };

    // バックアップとしてDOMイベントリスナーも追加
    const buttonNode = helpButton.node;
    buttonNode.addEventListener('click', (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      console.log('Help button DOM click event triggered!');
      toggleHelpState(helpButton);
    });

    console.log('Help button onClick handler and DOM event listener set');
  }, 0);

  // 仮説1-4対策: ベストプラクティスCSSスタイル設定
  const buttonNode = helpButton.node;

  // 基本スタイル設定
  buttonNode.textContent = 'HELP'; // 新要件: 初期状態で「HELP」表示
  buttonNode.setAttribute('aria-label', 'ヘルプ要請ボタン');
  buttonNode.setAttribute('aria-pressed', 'false');
  buttonNode.setAttribute('role', 'button');
  buttonNode.setAttribute('tabindex', '0');
  buttonNode.setAttribute('data-help-button', 'true'); // 識別用属性

  // 仮説1-4対策: 強制的な表示スタイル（!important使用）
  const forceVisibleStyles = {
    'display': 'inline-flex !important',
    'visibility': 'visible !important',
    'opacity': '1 !important',
    'z-index': '1000 !important',
    'position': 'relative !important',
    'min-width': '60px !important',
    'min-height': '32px !important',
    'max-width': 'none !important',
    'max-height': 'none !important',
    'width': 'auto !important',
    'height': 'auto !important',
    'overflow': 'visible !important',
    'background-color': '#007acc !important',
    'color': 'white !important',
    'border': '2px solid #005a9e !important',
    'border-radius': '4px !important',
    'padding': '6px 12px !important',
    'margin': '0 2px !important',
    'font-size': '13px !important',
    'font-weight': '600 !important',
    'font-family': 'var(--jp-ui-font-family) !important',
    'text-align': 'center !important',
    'cursor': 'pointer !important',
    'user-select': 'none !important',
    'box-sizing': 'border-box !important',
    'align-items': 'center !important',
    'justify-content': 'center !important'
  };

  // スタイルを順次適用
  Object.entries(forceVisibleStyles).forEach(([property, value]) => {
    buttonNode.style.setProperty(property, value.replace(' !important', ''), 'important');
  });

  // ホバーエフェクトを追加
  buttonNode.addEventListener('mouseenter', () => {
    buttonNode.style.setProperty('background-color', '#005a9e', 'important');
  });

  buttonNode.addEventListener('mouseleave', () => {
    buttonNode.style.setProperty('background-color', '#007acc', 'important');
  });

  console.log('Help button styled with best practices and forced visibility');

  return helpButton;
}

/**
 * Initialization data for the cell-monitor extension
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'cell-monitor:plugin',
  autoStart: true,
  requires: [INotebookTracker, ISettingRegistry, ILabShell],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker, settingRegistry: ISettingRegistry, labShell: ILabShell) => {
    console.log('JupyterLab extension cell-monitor is activated!');

    // Display activation notification to the user
    Notification.success('Cell Monitor Activated', {
      autoClose: 2000  // Close automatically after 2 seconds
    });

    // セッション管理の初期化
    sessionId = generateUUID();

    // 設定のロード
    settingRegistry
      .load(plugin.id)
      .then((registrySettings: ISettingRegistry.ISettings) => {
        console.log('JupyterLab extension cell-monitor: settings loaded.');

        // スキーマデータの確認のためのデバッグログ
        const schema = registrySettings.schema;
        console.log('Schema loaded:', schema.title, schema.description);

        // サーバーURLを設定から取得
        globalServerUrl = registrySettings.get('serverUrl').composite as string;
        globalSettings.serverUrl = globalServerUrl;

        // ユーザー設定の取得と適用
        const userIdSetting = registrySettings.get('userId').composite as string;
        const userNameSetting = registrySettings.get('userName').composite as string;
        const showNotificationsSetting = registrySettings.get('showNotifications').composite as boolean;

        // 設定値の確認と適切なデフォルト値の適用
        globalSettings.userId = userIdSetting || '';
        globalSettings.userName = userNameSetting || 'Anonymous';
        globalSettings.showNotifications = showNotificationsSetting !== undefined ? showNotificationsSetting : true;

        console.log('=== SETTINGS LOADED DEBUG ===');
        console.log('User ID:', globalSettings.userId);
        console.log('User Name:', globalSettings.userName);
        console.log('Show Notifications:', globalSettings.showNotifications);
        console.log('Server URL:', globalSettings.serverUrl);
        console.log('==============================');

        // 仮説2対策: 設定変更の即座反映のためのリスナー追加
        registrySettings.changed.connect(() => {
          const newShowNotifications = registrySettings.get('showNotifications').composite as boolean;
          const oldValue = globalSettings.showNotifications;
          globalSettings.showNotifications = newShowNotifications !== undefined ? newShowNotifications : true;

          console.log('=== SETTINGS CHANGED ===');
          console.log('Show Notifications changed:', oldValue, '->', globalSettings.showNotifications);
          console.log('========================');
        });

        // 設定のIDがある場合は永続IDにも適用
        if (userIdSetting && userIdSetting.length > 0) {
            persistentUserId = userIdSetting;
            console.log('User ID set from settings:', persistentUserId);
        } else {
            // 設定がない場合は生成されたIDが使用される
            const userInfo = getUserInfo();
            console.log('Generated user ID will be used:', userInfo.userId);
        }

        globalSettings.retryAttempts = registrySettings.get('retryAttempts').composite as number;
        console.log('Server URL set to:', globalServerUrl);
        console.log('User settings - ID:', globalSettings.userId || '<auto-generated>',
                  'Name:', globalSettings.userName);

        // Get the maxNotifications value from settings
        const maxNotifications = getMaxNotifications(registrySettings);
        console.log('Max notifications:', maxNotifications);
      })
      .catch(reason => {
        console.error('Failed to load cell-monitor settings', reason);
      });

    // デフォルト設定は既にglobalSettingsとして設定済み

    // 将来的にバッファリングが必要になった場合のために、設定は残しておく

    // Send data to server function - 従来のデータモデル用（後方互換性のため保持）
    const sendLegacyData = async (data: ICellExecutionData[]): Promise<void> => {
      if (data.length === 0) return;

      // 従来のエンドポイントに送信
      let retries = 0;
      const legacyUrl = globalSettings.serverUrl.replace('student-progress', 'cell-monitor');

      while (retries <= globalSettings.retryAttempts) {
        try {
          await axios.post(legacyUrl, data);
          console.log('Legacy cell execution data sent successfully:', data.length, 'items');
          break;
        } catch (error) {
          console.error('Failed to send legacy cell execution data:', error);
          retries++;
          if (retries > globalSettings.retryAttempts) {
            console.error('Max retry attempts reached. Legacy data will be lost.');
            break;
          }
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
        }
      }
    };

    // 新しい拡張データモデル用の送信関数
    const sendProgressData = async (data: IStudentProgressData[]): Promise<void> => {
      if (data.length === 0) return;

      // 仮説1対策: showNotifications設定チェックを追加
      console.log('=== SEND PROGRESS DATA DEBUG ===');
      console.log('Data to send:', JSON.stringify(data, null, 2));
      console.log('showNotifications setting:', globalSettings.showNotifications);
      console.log('================================');

      // 新しいエンドポイントに送信
      let retries = 0;
      while (retries <= globalSettings.retryAttempts) {
        try {
          await axios.post(globalSettings.serverUrl, data);
          console.log('Student progress data sent successfully:', data.length, 'events');

          // 仮説1対策: showNotifications設定に基づいて通知制御
          if (data.length > 0 && globalSettings.showNotifications) {
            Notification.info(`Learning data sent (${data.length} events)`, {
              autoClose: 3000
            });
            console.log('Notification displayed (showNotifications: ON)');
          } else if (data.length > 0) {
            console.log('Notification suppressed (showNotifications: OFF)');
          }
          break;
        } catch (error) {
          console.error('Failed to send student progress data:', error);
          retries++;
          if (retries > globalSettings.retryAttempts) {
            console.error('Max retry attempts reached. Progress data will be lost.');
            break;
          }
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
        }
      }
    };

    // グローバル変数に代入してヘルプタイマーからアクセスできるようにする
    globalSendProgressData = sendProgressData;
    console.log('globalSendProgressData function assigned for help timer');

    // Process cell execution
    const processCellExecution = (cell: any): void => {
      try {
        if (!cell || !cell.model) return;

        // 処理開始時間（パフォーマンス計測用）
        const startTime = performance.now();

        const cellId = cell.model.id;

        // 仮説7対策: 重複処理防止機構
        const currentTime = Date.now();
        const lastTime = lastProcessedTime.get(cellId) || 0;
        const timeDiff = currentTime - lastTime;

        console.log('=== CELL EXECUTION DEBUG ===');
        console.log('Cell ID:', cellId);
        console.log('Time since last processing:', timeDiff, 'ms');
        console.log('Already processed:', processedCells.has(cellId));

        // 仮説9対策: 500ms以内の重複処理を防止（デバウンス）
        if (timeDiff < 500 && processedCells.has(cellId)) {
          console.log('Skipping duplicate cell execution processing');
          console.log('============================');
          return;
        }

        // 処理済みマークを更新
        processedCells.add(cellId);
        lastProcessedTime.set(cellId, currentTime);

        // 古いエントリをクリーンアップ（メモリリーク防止）
        if (processedCells.size > 100) {
          const oldestEntries = Array.from(lastProcessedTime.entries())
            .sort(([,a], [,b]) => a - b)
            .slice(0, 50);
          oldestEntries.forEach(([id]) => {
            processedCells.delete(id);
            lastProcessedTime.delete(id);
          });
        }

        // 安全にセルのコードを取得する方法
        let code = '';
        try {
          // NotebookActions.executed イベントで、cell は CodeCell であることが期待される
          // 新しい JupyterLab での取得方法を試みる
          if (cell.model.sharedModel && cell.model.sharedModel.source) {
            code = cell.model.sharedModel.source;
          }
          // 従来の方法もフォールバックとして残す
          else if (cell.model.value && cell.model.value.text) {
            code = cell.model.value.text;
          }
          // エディタから直接取得する方法も試す
          else if (cell.editor && cell.editor.model && cell.editor.model.value) {
            code = cell.editor.model.value.text;
          }
        } catch (error) {
          console.warn('Failed to get cell code:', error);
        }

        // Get notebook widget from cell
        const notebookWidget = tracker.currentWidget;
        if (!notebookWidget) return;

        // Get notebook path
        const notebookPath = notebookWidget.context?.path || '';

        // Get cell index and type
        let cellIndex: number | undefined = undefined;
        let cellType: CellType | undefined = undefined;

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
            cellType = cell.model.type as CellType;
          }
        } catch (error) {
          console.warn('Failed to get cell index or type:', error);
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
            console.warn('Failed to get execution count:', error);
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
        const { userId, userName } = getUserInfo();

        // 旧式のデータモデル（後方互換性のため）
        const legacyData: ICellExecutionData = {
          cellId,
          code,
          executionTime: new Date().toISOString(),
          result: resultText,
          hasError,
          notebookPath
        };

        // 新しいデータモデル
        const progressData: IStudentProgressData = {
          eventId: generateUUID(),
          eventType: 'cell_executed',
          eventTime: new Date().toISOString(),
          userId,
          userName,
          sessionId,
          notebookPath,
          cellId,
          cellIndex,
          cellType,
          code,
          executionCount,
          hasError,
          errorMessage: hasError ? errorMessage : undefined,
          result: resultText,
          executionDurationMs
        };

        // 両方のデータを送信（新旧両方のエンドポイントをサポート）
        sendLegacyData([legacyData]); // 後方互換性のため
        sendProgressData([progressData]); // 新しい拡張データ
      } catch (error) {
        console.error('Error processing cell execution:', error);
      }
    };

    // Listen to cell executed signal
    tracker.currentChanged.connect(() => {
      // Add notebook tracker if not already done
      if (!tracker.currentWidget) return;

      // Add the executed signal handler for cell execution
      NotebookActions.executed.connect((_: any, args) => {
        const { cell } = args;
        processCellExecution(cell);
      });

      // ノートブックが閉じられたときのイベントハンドラ
      labShell.currentChanged.connect((_, change: { oldValue: Widget | null, newValue: Widget | null }) => {
        // 以前アクティブだったパネルがノートブックで、現在は別のパネルに切り替わった場合
        const oldWidget = change.oldValue as any; // 型キャストで対応
        if (oldWidget && oldWidget.hasOwnProperty('context') &&
            oldWidget.context && oldWidget.context.path) {
          // 閉じられたノートブックのパスを取得
          const notebookPath = oldWidget.context.path;

          // 最新のユーザー情報を取得
          const { userId, userName } = getUserInfo();

          // ノートブックが閉じられたイベントデータを作成
          const notebookClosedData: IStudentProgressData = {
            eventId: generateUUID(),
            eventType: 'notebook_closed',
            eventTime: new Date().toISOString(),
            userId: userId,
            userName: userName,
            sessionId: sessionId,
            notebookPath: notebookPath
          };

          // データを送信
          sendProgressData([notebookClosedData]);
        }
      });

      console.log('Cell execution tracker added to', tracker.currentWidget?.context.path);

      // Load settings from registry
      settingRegistry.load(plugin.id).then(
        (registrySettings: ISettingRegistry.ISettings) => {
          // グローバル設定を更新
          globalServerUrl = registrySettings.get('serverUrl').composite as string;
          globalSettings.serverUrl = globalServerUrl;
          globalSettings.userId = registrySettings.get('userId').composite as string || '';
          globalSettings.userName = registrySettings.get('userName').composite as string || 'Anonymous';
          globalSettings.retryAttempts = registrySettings.get('retryAttempts').composite as number;

          // ノートブック関連のイベントを監視
          tracker.widgetAdded.connect((sender, panel: any) => {
            // ヘルプボタンをノートブックツールバーに追加
            if (panel.toolbar) {
              try {
                // 既存のヘルプボタンを削除（重複防止）
                const existingHelpButton = panel.toolbar.node.querySelector('.jp-help-button');
                if (existingHelpButton) {
                  console.log('Removing existing help button to prevent duplicates');
                  existingHelpButton.remove();
                }

                const helpButton = createHelpButton();
                panel.toolbar.addItem('help-button', helpButton);
                console.log('Help button added to notebook toolbar');

                // デバッグ: DOM要素の存在確認
                console.log('Help button DOM node:', helpButton.node);
                console.log('Help button parent:', helpButton.node.parentElement);
                console.log('Toolbar children count:', panel.toolbar.node.children.length);

                // ヘルプボタンが実際に表示されているか確認
                setTimeout(() => {
                  const addedButton = panel.toolbar.node.querySelector('.jp-help-button');
                  if (addedButton) {
                    console.log('=== HELP BUTTON DEBUG INFO ===');
                    console.log('Help button found in DOM:', addedButton);

                    // 仮説1-4: CSS/スタイル関連の検証
                    const computedStyle = window.getComputedStyle(addedButton);
                    console.log('CSS Display:', computedStyle.display);
                    console.log('CSS Visibility:', computedStyle.visibility);
                    console.log('CSS Opacity:', computedStyle.opacity);
                    console.log('CSS Z-Index:', computedStyle.zIndex);
                    console.log('CSS Width:', computedStyle.width);
                    console.log('CSS Height:', computedStyle.height);
                    console.log('CSS Background Color:', computedStyle.backgroundColor);
                    console.log('CSS Color:', computedStyle.color);
                    console.log('CSS Position:', computedStyle.position);
                    console.log('CSS Overflow:', computedStyle.overflow);

                    // 仮説5-6: DOM構造・位置の検証
                    const rect = addedButton.getBoundingClientRect();
                    console.log('Element Rect:', rect);
                    console.log('Element Parent:', addedButton.parentElement);
                    console.log('Element Siblings Count:', addedButton.parentElement?.children.length);
                    console.log('Element Index in Parent:', Array.from(addedButton.parentElement?.children || []).indexOf(addedButton));

                    // 仮説8: ToolbarButton実装の検証
                    console.log('Element Tag Name:', addedButton.tagName);
                    console.log('Element Class List:', addedButton.classList.toString());
                    console.log('Element Text Content:', addedButton.textContent);
                    console.log('Element Inner HTML:', addedButton.innerHTML);

                    // 仮説10: レンダリング問題の検証
                    console.log('Element Offset Width:', addedButton.offsetWidth);
                    console.log('Element Offset Height:', addedButton.offsetHeight);
                    console.log('Element Client Width:', addedButton.clientWidth);
                    console.log('Element Client Height:', addedButton.clientHeight);

                    // ベストプラクティス修正: 強制的な表示スタイル適用
                    addedButton.style.display = 'inline-block !important';
                    addedButton.style.visibility = 'visible !important';
                    addedButton.style.opacity = '1 !important';
                    addedButton.style.zIndex = '9999 !important';
                    addedButton.style.minWidth = '50px !important';
                    addedButton.style.minHeight = '30px !important';
                    addedButton.style.backgroundColor = '#007acc !important';
                    addedButton.style.color = 'white !important';
                    addedButton.style.border = '2px solid #ff0000 !important'; // 緑色のボーダーで確認
                    addedButton.style.padding = '8px 12px !important';
                    addedButton.style.fontSize = '14px !important';
                    addedButton.style.fontWeight = 'bold !important';

                    console.log('Applied forced visibility styles to help button');
                    console.log('=== END DEBUG INFO ===');
                  } else {
                    console.error('Help button not found in DOM after adding');
                  }
                }, 100);

              } catch (error) {
                console.error('Error adding help button to toolbar:', error);
              }
            }

            // ノートブックが開かれたイベントを処理
            // 最新のユーザー情報を取得
            const { userId, userName } = getUserInfo();

            const notebookOpenedData: IStudentProgressData = {
              eventId: generateUUID(),
              eventType: 'notebook_opened',
              eventTime: new Date().toISOString(),
              userId: userId,
              userName: userName,
              sessionId: sessionId,
              notebookPath: panel.context.path
            };

            // データを送信
            sendProgressData([notebookOpenedData]);

            // ノートブック保存イベントを監視
            if (panel.context && panel.context.saveState && panel.context.saveState.stateChanged) {
              panel.context.saveState.stateChanged.connect((_: any, state: string) => {
                if (state === 'completed') {
                  // 最新のユーザー情報を取得
                  const { userId, userName } = getUserInfo();

                  const notebookSavedData: IStudentProgressData = {
                    eventId: generateUUID(),
                    eventType: 'notebook_saved',
                    eventTime: new Date().toISOString(),
                    userId: userId,
                    userName: userName,
                    sessionId: sessionId,
                    notebookPath: panel.context.path
                  };

                  // データを送信
                  sendProgressData([notebookSavedData]);
                }
              });
            }

            // Add executed signal handler for content changes
            if (panel.content && panel.content.model && panel.content.model.contentChanged) {
              panel.content.model.contentChanged.connect(() => {
                console.debug('notebook content changed');
              });
            }
          });
        }
      );

    });
  }
};

export default plugin;
