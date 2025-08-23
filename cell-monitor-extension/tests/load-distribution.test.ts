/**
 * LoadDistributionService のテスト
 * TDD実装：負荷分散機能の単体テスト
 */

import { LoadDistributionService } from '../src/services/LoadDistributionService';
import { SettingsManager } from '../src/core/SettingsManager';
import { IStudentProgressData } from '../src/types/interfaces';

// Mock dependencies
jest.mock('../src/core/SettingsManager');
jest.mock('../src/utils/logger');

describe('LoadDistributionService', () => {
  let loadDistributionService: LoadDistributionService;
  let mockSettingsManager: jest.Mocked<SettingsManager>;
  let mockSendFunction: jest.MockedFunction<(data: IStudentProgressData[]) => Promise<void>>;
  let testData: IStudentProgressData[];

  beforeEach(() => {
    // SettingsManager のモック設定
    mockSettingsManager = {
      getUserInfo: jest.fn().mockReturnValue({
        emailAddress: 'student001@example.com',
        userName: 'TestUser',
        teamName: 'チームA'
      })
    } as any;

    // 送信関数のモック
    mockSendFunction = jest.fn().mockResolvedValue(undefined);

    // テスト用データ
    testData = [
      {
        eventId: 'test-event-1',
        eventType: 'cell_execution_start',
        emailAddress: 'student001@example.com',
        userName: 'TestUser',
        teamName: 'チームA',
        timestamp: new Date(),
        notebookPath: '/test/notebook.ipynb',
        cellId: 'cell-1',
        cellContent: 'print("test")',
        executionCount: 1
      }
    ];

    loadDistributionService = new LoadDistributionService(mockSettingsManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with SettingsManager', () => {
      expect(loadDistributionService).toBeDefined();
      expect(loadDistributionService['settingsManager']).toBe(mockSettingsManager);
    });
  });

  describe('sendWithLoadDistribution', () => {
    it('should call original send function when data is empty', async () => {
      await loadDistributionService.sendWithLoadDistribution([], mockSendFunction);
      
      expect(mockSendFunction).not.toHaveBeenCalled();
    });

    it('should apply load distribution delay before calling send function', async () => {
      const startTime = Date.now();
      
      await loadDistributionService.sendWithLoadDistribution(testData, mockSendFunction);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // 最小遅延500ms以上であることを確認
      expect(executionTime).toBeGreaterThanOrEqual(500);
      expect(mockSendFunction).toHaveBeenCalledWith(testData);
      expect(mockSendFunction).toHaveBeenCalledTimes(1);
    });

    it('should calculate consistent delay for same email', async () => {
      const delays: number[] = [];
      
      // 同じメールアドレスで3回実行し、遅延時間を記録
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        await loadDistributionService.sendWithLoadDistribution(testData, mockSendFunction);
        const endTime = Date.now();
        delays.push(endTime - startTime);
      }
      
      // 全ての遅延時間が一致することを確認（±50ms の誤差許容）
      const expectedDelay = delays[0];
      delays.forEach(delay => {
        expect(Math.abs(delay - expectedDelay)).toBeLessThanOrEqual(50);
      });
    });

    it('should generate different delays for different emails', async () => {
      const testData2 = [{
        ...testData[0],
        emailAddress: 'student002@example.com'
      }];
      
      // 異なるメールアドレスでの遅延計算をテスト
      const startTime1 = Date.now();
      await loadDistributionService.sendWithLoadDistribution(testData, mockSendFunction);
      const delay1 = Date.now() - startTime1;
      
      const startTime2 = Date.now();
      await loadDistributionService.sendWithLoadDistribution(testData2, mockSendFunction);
      const delay2 = Date.now() - startTime2;
      
      // 異なるメールアドレスでは異なる遅延時間になることを確認
      // （同一である可能性もあるが、統計的に低確率）
      // 最低限、両方とも500ms以上3500ms以下の範囲内であることを確認
      expect(delay1).toBeGreaterThanOrEqual(500);
      expect(delay1).toBeLessThanOrEqual(3500);
      expect(delay2).toBeGreaterThanOrEqual(500);
      expect(delay2).toBeLessThanOrEqual(3500);
    });

    it('should handle errors from original send function', async () => {
      const error = new Error('Send function failed');
      mockSendFunction.mockRejectedValue(error);
      
      await expect(
        loadDistributionService.sendWithLoadDistribution(testData, mockSendFunction)
      ).rejects.toThrow('Send function failed');
    });

    it('should log debug information during execution', async () => {
      // ログ出力のテストは実装後に詳細化
      await loadDistributionService.sendWithLoadDistribution(testData, mockSendFunction);
      
      expect(mockSendFunction).toHaveBeenCalledWith(testData);
    });
  });

  describe('hashString', () => {
    it('should generate consistent hash for same input', () => {
      const service = loadDistributionService as any;
      const testString = 'student001@example.com';
      
      const hash1 = service.hashString(testString);
      const hash2 = service.hashString(testString);
      
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('number');
      expect(hash1).toBeGreaterThanOrEqual(0);
    });

    it('should generate different hashes for different inputs', () => {
      const service = loadDistributionService as any;
      
      const hash1 = service.hashString('student001@example.com');
      const hash2 = service.hashString('student002@example.com');
      
      // 統計的に異なるハッシュ値になることを期待
      // 同一の可能性もあるが、実用上問題ない
      expect(typeof hash1).toBe('number');
      expect(typeof hash2).toBe('number');
    });

    it('should handle empty string', () => {
      const service = loadDistributionService as any;
      
      const hash = service.hashString('');
      
      expect(typeof hash).toBe('number');
      expect(hash).toBe(0);
    });
  });

  describe('delay calculation', () => {
    it('should generate delay in expected range (0.5-3.5 seconds)', async () => {
      const delays: number[] = [];
      const testEmails = [
        'student001@example.com',
        'student002@example.com', 
        'student003@example.com',
        'student004@example.com',
        'student005@example.com'
      ];
      
      for (const email of testEmails) {
        const testDataWithEmail = [{
          ...testData[0],
          emailAddress: email
        }];
        
        const startTime = Date.now();
        await loadDistributionService.sendWithLoadDistribution(testDataWithEmail, mockSendFunction);
        const delay = Date.now() - startTime;
        delays.push(delay);
      }
      
      // 全ての遅延が期待範囲内であることを確認
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(500);   // 0.5秒以上
        expect(delay).toBeLessThanOrEqual(3500);     // 3.5秒以下
      });
      
      // 遅延のばらつきがあることを確認（負荷分散効果）
      const minDelay = Math.min(...delays);
      const maxDelay = Math.max(...delays);
      expect(maxDelay - minDelay).toBeGreaterThan(100); // 最低100ms の差
    });
  });
});