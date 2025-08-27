/**
 * Phase 2.3実装のユニットテスト
 * 継続HELP送信システムとバルククリーンアップのテスト
 */

import { EventManager } from '../src/core/EventManager';
import { SettingsManager } from '../src/core/SettingsManager';
import { DataTransmissionService } from '../src/services/DataTransmissionService';
import { INotebookTracker } from '@jupyterlab/notebook';

// Timer関数をモック化
jest.useFakeTimers();

// モジュールをモック化
jest.mock('../src/core/SettingsManager');
jest.mock('../src/services/DataTransmissionService');

const MockedSettingsManager = SettingsManager as jest.MockedClass<typeof SettingsManager>;
const MockedDataTransmissionService = DataTransmissionService as jest.MockedClass<typeof DataTransmissionService>;

describe('EventManager - Phase 2.3 Tests', () => {
  let eventManager: EventManager;
  let mockNotebookTracker: jest.Mocked<INotebookTracker>;
  let mockSettingsManager: jest.Mocked<SettingsManager>;
  let mockDataTransmissionService: jest.Mocked<DataTransmissionService>;
  let mockNotebookWidget: any;

  beforeEach(() => {
    // NotebookTrackerのモック
    mockNotebookWidget = {
      context: {
        path: '/test/notebook.ipynb'
      }
    };

    mockNotebookTracker = {
      currentWidget: mockNotebookWidget,
      widgetAdded: {
        connect: jest.fn()
      }
    } as any;

    // SettingsManagerのモック
    mockSettingsManager = new MockedSettingsManager() as jest.Mocked<SettingsManager>;
    mockSettingsManager.getUserInfo = jest.fn().mockReturnValue({
      emailAddress: 'test@example.com',
      userName: 'TestUser',
      teamName: 'TestTeam'
    });
    mockSettingsManager.getNotificationSettings = jest.fn().mockReturnValue({
      showNotifications: false
    });

    // DataTransmissionServiceのモック
    mockDataTransmissionService = new MockedDataTransmissionService(mockSettingsManager) as jest.Mocked<DataTransmissionService>;
    mockDataTransmissionService.sendProgressData = jest.fn().mockResolvedValue(undefined);

    // EventManagerインスタンス作成
    eventManager = new EventManager(
      mockNotebookTracker,
      mockSettingsManager,
      mockDataTransmissionService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    eventManager.startNewSession(); // クリーンアップ
  });

  describe('Phase 2.3: 継続HELP送信システム', () => {
    
    test('✅ startHelpSession()で即座に1回目のHELP送信が実行される', () => {
      eventManager.startHelpSession();

      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(1);
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledWith([
        expect.objectContaining({
          eventType: 'help',
          notebookPath: '/test/notebook.ipynb',
          eventId: expect.any(String),
          eventTime: expect.any(String)
        })
      ]);
    });

    test('✅ 10秒間隔で継続的にHELPイベントが送信される', () => {
      eventManager.startHelpSession();

      // 初回送信確認
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(1);

      // 10秒進める
      jest.advanceTimersByTime(10000);
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(2);

      // さらに10秒進める
      jest.advanceTimersByTime(10000);
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(3);

      // さらに10秒進める
      jest.advanceTimersByTime(10000);
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(4);
    });

    test('✅ 既に継続送信中のセッションでstartHelpSession()が重複実行されない', () => {
      // 1回目のstartHelpSession
      eventManager.startHelpSession();
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(1);

      // 2回目のstartHelpSession（重複）
      eventManager.startHelpSession();
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(1); // 増加しない

      // 10秒後でも継続送信は1つのintervalのみ
      jest.advanceTimersByTime(10000);
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(2);
    });

    test('✅ stopHelpSession()で継続送信が停止される', () => {
      eventManager.startHelpSession();
      
      // 10秒進めて継続送信を確認
      jest.advanceTimersByTime(10000);
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(2);

      // ヘルプセッション停止
      eventManager.stopHelpSession();
      
      // help_stopイベントが送信される
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(3);
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenLastCalledWith([
        expect.objectContaining({
          eventType: 'help_stop'
        })
      ]);

      // 停止後、さらに10秒進めても継続送信されない
      jest.advanceTimersByTime(10000);
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(3);
    });

    test('✅ currentWidgetが存在しない場合は何もしない', () => {
      mockNotebookTracker.currentWidget = null;
      
      eventManager.startHelpSession();
      expect(mockDataTransmissionService.sendProgressData).not.toHaveBeenCalled();

      eventManager.stopHelpSession();
      expect(mockDataTransmissionService.sendProgressData).not.toHaveBeenCalled();
    });
  });

  describe('Phase 2.3: バルククリーンアップシステム', () => {
    
    test('✅ stopHelpSession()でバルククリーンアップが実行される', () => {
      // Phase 2.3のプライベートメソッドテスト用
      const bulkCleanupSpy = jest.spyOn(eventManager as any, 'bulkCleanupOldSessions');
      
      eventManager.startHelpSession();
      eventManager.stopHelpSession();
      
      expect(bulkCleanupSpy).toHaveBeenCalledTimes(1);
    });

    test('✅ 30分以上前のセッションが削除される', async () => {
      // 現在時刻のモック
      const originalDateNow = Date.now;
      const mockNow = 1000000000; // 基準時刻
      Date.now = jest.fn(() => mockNow);

      // 古いタイムスタンプでhelpSessionTimestampsを設定
      const oldTimestamp = mockNow - (35 * 60 * 1000); // 35分前
      (eventManager as any).helpSessionTimestamps.set('/old/notebook.ipynb', oldTimestamp);
      (eventManager as any).helpSession.set('/old/notebook.ipynb', true);
      
      // 新しいタイムスタンプでhelpSessionTimestampsを設定
      const recentTimestamp = mockNow - (5 * 60 * 1000); // 5分前
      (eventManager as any).helpSessionTimestamps.set('/recent/notebook.ipynb', recentTimestamp);
      (eventManager as any).helpSession.set('/recent/notebook.ipynb', true);

      // バルククリーンアップ実行
      (eventManager as any).bulkCleanupOldSessions();

      // 古いセッションが削除され、新しいセッションは残る
      expect((eventManager as any).helpSession.has('/old/notebook.ipynb')).toBe(false);
      expect((eventManager as any).helpSession.has('/recent/notebook.ipynb')).toBe(true);
      expect((eventManager as any).helpSessionTimestamps.has('/old/notebook.ipynb')).toBe(false);
      expect((eventManager as any).helpSessionTimestamps.has('/recent/notebook.ipynb')).toBe(true);

      // Date.nowを元に戻す
      Date.now = originalDateNow;
    });

    test('✅ 緊急時FIFO制限が20セッション制限で動作する', () => {
      const maxSessions = 25; // MAX_HELP_SESSIONSの20を超える数
      
      // 25個のセッションを追加
      for (let i = 0; i < maxSessions; i++) {
        (eventManager as any).helpSession.set(`/notebook${i}.ipynb`, true);
        (eventManager as any).helpSessionTimestamps.set(`/notebook${i}.ipynb`, Date.now());
      }

      expect((eventManager as any).helpSession.size).toBe(25);

      // 緊急FIFO制限を実行
      (eventManager as any).emergencyFIFOCleanup();

      // 20未満になるまで削除される
      expect((eventManager as any).helpSession.size).toBeLessThan(20);
    });
  });

  describe('Phase 2.3: 統合動作テスト', () => {
    
    test('✅ 継続送信 → 停止 → バルククリーンアップの完全フロー', () => {
      // ヘルプセッション開始
      eventManager.startHelpSession();
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(1);

      // 30秒間継続送信
      jest.advanceTimersByTime(30000); // 3回の追加送信
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(4);

      // セッション停止
      eventManager.stopHelpSession();
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(5); // help_stop追加

      // 停止後は継続送信されない
      jest.advanceTimersByTime(20000);
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(5);
    });

    test('✅ 複数ノートブックでの独立動作', () => {
      // 1つ目のノートブック
      mockNotebookTracker.currentWidget = {
        context: { path: '/notebook1.ipynb' }
      };
      eventManager.startHelpSession();

      // 2つ目のノートブック
      mockNotebookTracker.currentWidget = {
        context: { path: '/notebook2.ipynb' }
      };
      eventManager.startHelpSession();

      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(2);

      // 10秒後、両方の継続送信が動作
      jest.advanceTimersByTime(10000);
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(4);

      // 1つ目を停止
      mockNotebookTracker.currentWidget = {
        context: { path: '/notebook1.ipynb' }
      };
      eventManager.stopHelpSession();
      
      // さらに10秒後、2つ目のみ継続送信
      jest.advanceTimersByTime(10000);
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(6); // stop + 2つ目継続
    });

    test('✅ startNewSession()で全クリーンアップが実行される', () => {
      // ヘルプセッション開始
      eventManager.startHelpSession();
      jest.advanceTimersByTime(10000);
      
      expect((eventManager as any).helpIntervals.size).toBe(1);
      expect((eventManager as any).helpSession.size).toBe(1);

      // 新セッション開始
      eventManager.startNewSession();

      // 全てクリアされる
      expect((eventManager as any).helpIntervals.size).toBe(0);
      expect((eventManager as any).helpSession.size).toBe(0);
      expect((eventManager as any).helpSessionTimestamps.size).toBe(0);

      // 継続送信も停止される
      jest.advanceTimersByTime(10000);
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(2); // 増加しない
    });
  });

  describe('Phase 2.3: エラーハンドリング', () => {
    
    test('✅ データ送信失敗時も継続送信が停止しない', async () => {
      mockDataTransmissionService.sendProgressData.mockRejectedValueOnce(new Error('Network error'));
      
      eventManager.startHelpSession();
      
      // 10秒後も継続送信が継続される（エラーで停止しない）
      jest.advanceTimersByTime(10000);
      expect(mockDataTransmissionService.sendProgressData).toHaveBeenCalledTimes(2);
    });

    test('✅ 不正なnotebookPathでもクラッシュしない', () => {
      mockNotebookTracker.currentWidget = {
        context: { path: null }
      };
      
      expect(() => {
        eventManager.startHelpSession();
        eventManager.stopHelpSession();
      }).not.toThrow();
    });
  });
});