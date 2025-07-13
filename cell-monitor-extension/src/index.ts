import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILabShell
} from '@jupyterlab/application';

import { Notification } from '@jupyterlab/apputils';

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
}

/**
 * イベントタイプの定義
 * 学習進捗データの種別を表す
 */
type EventType = 'cell_executed' | 'notebook_opened' | 'notebook_saved' | 'notebook_closed';

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
  serverUrl: 'http://localhost:8000/student-progress',
  userId: '',
  userName: 'Anonymous',
  batchSize: 1,
  retryAttempts: 3,
  maxNotifications: 3
};

// 設定から最大表示メッセージ数を取得するユーティリティ関数
function getMaxNotifications(settings: ISettingRegistry.ISettings): number {
  return settings.get('maxNotifications').composite as number;
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
        
        // 設定値の確認と適切なデフォルト値の適用
        globalSettings.userId = userIdSetting || '';
        globalSettings.userName = userNameSetting || 'Anonymous';
        
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
      
      // 新しいエンドポイントに送信
      let retries = 0;
      while (retries <= globalSettings.retryAttempts) {
        try {
          await axios.post(globalSettings.serverUrl, data);
          console.log('Student progress data sent successfully:', data.length, 'events');
          
          // Show notification when data is sent successfully
          if (data.length > 0) {
            Notification.info(`Learning data sent (${data.length} events)`, {
              autoClose: 3000
            });
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

    // Process cell execution
    const processCellExecution = (cell: any): void => {
      try {
        if (!cell || !cell.model) return;
        
        // 処理開始時間（パフォーマンス計測用）
        const startTime = performance.now();
        
        const cellId = cell.model.id;
        
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
            
            // Add executed signal handler for content changes
            panel.content.model?.contentChanged.connect(() => {
              console.debug('notebook content changed');
            });
          });
        }
      );

    });
  }
};

export default plugin;
