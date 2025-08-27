/**
 * Phase 2実装のユニットテスト
 * HTTP接続プール最適化と重複送信防止のテスト
 */

import { DataTransmissionService } from '../src/services/DataTransmissionService';
import { SettingsManager } from '../src/core/SettingsManager';
import { IStudentProgressData } from '../src/types/interfaces';
import axios from 'axios';

// axiosをモック化
jest.mock('axios', () => ({
  create: jest.fn(),
  post: jest.fn()
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockAxiosInstance = {
  post: jest.fn(),
  defaults: { headers: {} }
};

describe('DataTransmissionService - Phase 2 Tests', () => {
  let service: DataTransmissionService;
  let mockSettingsManager: jest.Mocked<SettingsManager>;
  let mockProgressData: IStudentProgressData[];

  beforeEach(() => {
    // axiosのcreateメソッドがmockAxiosInstanceを返すように設定
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    
    // SettingsManagerのモックを作成
    mockSettingsManager = {
      getServerUrl: jest.fn().mockReturnValue('http://localhost:8000/api/v1/events'),
      getRetryAttempts: jest.fn().mockReturnValue(3),
      getNotificationSettings: jest.fn().mockReturnValue({ showNotifications: false }),
      getSettings: jest.fn().mockReturnValue(null),
      getUserInfo: jest.fn().mockReturnValue({
        emailAddress: 'test@example.com',
        userName: 'TestUser',
        teamName: 'TestTeam'
      })
    } as any;

    // テスト用データ
    mockProgressData = [{
      eventId: 'test-event-1',
      eventType: 'cell_executed',
      eventTime: new Date().toISOString(),
      emailAddress: 'test@example.com',
      userName: 'TestUser',
      teamName: 'TestTeam',
      sessionId: 'test-session',
      notebookPath: '/test/notebook.ipynb',
      cellId: 'test-cell-123',
      cellIndex: 0,
      cellType: 'code',
      code: 'print("Hello World")',
      executionCount: 1,
      hasError: false,
      result: 'Hello World',
      executionDurationMs: 100
    }];

    service = new DataTransmissionService(mockSettingsManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.dispose();
  });

  describe('Phase 2.1: HTTP接続プール最適化', () => {
    
    test('✅ axiosインスタンスが接続プール設定で作成される', () => {
      // axios.createが2回呼び出される（通常用とレガシー用）
      expect(mockedAxios.create).toHaveBeenCalledTimes(2);
      
      // 接続プール設定が正しく適用されている
      const expectedConfig = {
        timeout: 8000,
        headers: { 
          'Connection': 'keep-alive',
          'Content-Type': 'application/json'
        },
        maxRedirects: 3,
        validateStatus: expect.any(Function)
      };
      
      expect(mockedAxios.create).toHaveBeenCalledWith(expectedConfig);
    });

    test('✅ HTTP送信時に接続プール付きaxiosインスタンスが使用される', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: 'success' });
      
      await service.sendProgressData(mockProgressData);
      
      // 接続プール付きaxiosインスタンスのpostメソッドが呼び出される
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/events',
        [mockProgressData[0]]
      );
    });

    test('✅ 接続プールのクリーンアップが正しく動作する', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      service.dispose();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Phase 2.2: HTTP重複送信防止', () => {
    
    test('✅ 同一セル・同一イベントの重複送信が防止される', async () => {
      mockAxiosInstance.post.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: 'success' }), 100))
      );
      
      // 同じデータを同時に3回送信
      const promises = [
        service.sendProgressData([mockProgressData[0]]),
        service.sendProgressData([mockProgressData[0]]),
        service.sendProgressData([mockProgressData[0]])
      ];
      
      await Promise.all(promises);
      
      // HTTP送信は1回のみ実行される（重複が防止される）
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    test('✅ 異なるセルIDの場合は重複送信防止が適用されない', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: 'success' });
      
      const data1 = { ...mockProgressData[0], cellId: 'cell-1' };
      const data2 = { ...mockProgressData[0], cellId: 'cell-2' };
      
      await Promise.all([
        service.sendProgressData([data1]),
        service.sendProgressData([data2])
      ]);
      
      // 異なるセルIDなので両方送信される
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    test('✅ 異なるイベントタイプの場合は重複送信防止が適用されない', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: 'success' });
      
      const data1 = { ...mockProgressData[0], eventType: 'cell_executed' as const };
      const data2 = { ...mockProgressData[0], eventType: 'help' as const };
      
      await Promise.all([
        service.sendProgressData([data1]),
        service.sendProgressData([data2])
      ]);
      
      // 異なるイベントタイプなので両方送信される
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('統合テスト: Phase 2.1 + 2.2', () => {
    
    test('✅ 接続プール + 重複送信防止が同時に動作する', async () => {
      mockAxiosInstance.post.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: 'success' }), 50))
      );
      
      // 同じデータを複数回送信
      const promises = Array(5).fill(null).map(() => 
        service.sendProgressData([mockProgressData[0]])
      );
      
      await Promise.all(promises);
      
      // 重複送信防止により1回のみ送信
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
      
      // 接続プール付きaxiosインスタンスが使用されている
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/events',
        [mockProgressData[0]]
      );
    });
  });
});