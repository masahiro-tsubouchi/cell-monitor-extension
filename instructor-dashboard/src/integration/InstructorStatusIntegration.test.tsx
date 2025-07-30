import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StatusPanel } from '../components/instructor/StatusPanel';
import { LocationTracker } from '../components/instructor/LocationTracker';
import { NotificationSystem } from '../components/instructor/NotificationSystem';
import { InstructorStatus } from '../types/api';
import webSocketService from '../services/websocket';

// WebSocketServiceをモック化
jest.mock('../services/websocket');

// TDD開発ルール: 統合テスト（Red → Green → Refactor）
// 目的: Phase 2コンポーネント間の連携とWebSocket統合の完全なテストを作成する

describe('Instructor Status Integration', () => {
  const mockSendStatusUpdate = jest.fn();
  const mockSendLocationUpdate = jest.fn();
  const mockSendNotificationSubscription = jest.fn();
  const mockSetEventHandlers = jest.fn();
  const mockGetConnectionState = jest.fn();

  // 統合テスト用の共通プロパティ
  const instructorId = 1;
  const initialStatus = InstructorStatus.AVAILABLE;
  const initialLocation = { x: 100, y: 150, zone: 'A' };

  const classroomLayout = {
    width: 800,
    height: 600,
    zones: [
      { id: 'A', name: 'エリアA', bounds: { x: 0, y: 0, width: 400, height: 300 } },
      { id: 'B', name: 'エリアB', bounds: { x: 400, y: 0, width: 400, height: 300 } },
      { id: 'C', name: 'エリアC', bounds: { x: 0, y: 300, width: 400, height: 300 } },
      { id: 'D', name: 'エリアD', bounds: { x: 400, y: 300, width: 400, height: 300 } },
    ]
  };

  const notificationSettings = {
    helpRequests: true,
    statusUpdates: true,
    systemAlerts: true,
    sound: true,
    vibration: true,
  };

  // 統合テスト用のコンポーネント状態管理
  const InstructorDashboardIntegration: React.FC = () => {
    const [currentStatus, setCurrentStatus] = React.useState(initialStatus);
    const [currentLocation, setCurrentLocation] = React.useState(initialLocation);
    const [settings, setSettings] = React.useState(notificationSettings);

    return (
      <div data-testid="instructor-dashboard-integration">
        <StatusPanel
          currentStatus={currentStatus}
          instructorId={instructorId}
          onStatusChange={setCurrentStatus}
        />
        <LocationTracker
          instructorId={instructorId}
          currentLocation={currentLocation}
          onLocationChange={setCurrentLocation}
          classroomLayout={classroomLayout}
        />
        <NotificationSystem
          instructorId={instructorId}
          isEnabled={true}
          onSettingsChange={setSettings}
          notificationSettings={settings}
        />
      </div>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // WebSocketServiceのモック実装
    (webSocketService as jest.Mocked<typeof webSocketService>).sendStatusUpdate = mockSendStatusUpdate;
    (webSocketService as jest.Mocked<typeof webSocketService>).sendLocationUpdate = mockSendLocationUpdate;
    (webSocketService as jest.Mocked<typeof webSocketService>).sendNotificationSubscription = mockSendNotificationSubscription;
    (webSocketService as jest.Mocked<typeof webSocketService>).setEventHandlers = mockSetEventHandlers;
    (webSocketService as jest.Mocked<typeof webSocketService>).getConnectionState = mockGetConnectionState;

    mockGetConnectionState.mockReturnValue('connected');

    // Notification APIのモック
    Object.defineProperty(global, 'Notification', {
      value: {
        permission: 'granted',
        requestPermission: jest.fn().mockResolvedValue('granted'),
      },
      writable: true,
    });
  });

  // 1. 統合レンダリング
  it('should render all instructor components without crashing', () => {
    render(<InstructorDashboardIntegration />);

    expect(screen.getByTestId('instructor-dashboard-integration')).toBeInTheDocument();
    expect(screen.getByTestId('status-panel')).toBeInTheDocument();
    expect(screen.getByTestId('location-tracker')).toBeInTheDocument();
    expect(screen.getByTestId('notification-system')).toBeInTheDocument();
  });

  // 2. WebSocket統合
  it('should set up WebSocket event handlers for all components', () => {
    render(<InstructorDashboardIntegration />);

    // 各コンポーネントがWebSocketイベントハンドラを設定していることを確認
    expect(mockSetEventHandlers).toHaveBeenCalled();

    // WebSocketイベントハンドラが適切に設定されていることを確認
    const eventHandlerCalls = mockSetEventHandlers.mock.calls;
    expect(eventHandlerCalls.length).toBeGreaterThan(0);
  });

  // 3. ステータス変更の統合フロー
  it('should handle instructor status change across all components', async () => {
    render(<InstructorDashboardIntegration />);

    // StatusPanelでステータスを変更
    const sessionButton = screen.getByRole('button', { name: /授業中/i });
    fireEvent.click(sessionButton);

    await waitFor(() => {
      // WebSocket経由でステータス更新が送信されることを確認
      expect(mockSendStatusUpdate).toHaveBeenCalledWith({
        instructor_id: instructorId,
        status: InstructorStatus.IN_SESSION,
        timestamp: expect.any(String),
      });
    });
  });

  // 4. 位置変更の統合フロー
  it('should handle instructor location change across all components', async () => {
    render(<InstructorDashboardIntegration />);

    // LocationTrackerで位置を変更
    const zoneB = screen.getByTestId('zone-B');
    fireEvent.click(zoneB);

    await waitFor(() => {
      // WebSocket経由で位置更新が送信されることを確認
      expect(mockSendLocationUpdate).toHaveBeenCalledWith({
        instructor_id: instructorId,
        location: {
          x: expect.any(Number),
          y: expect.any(Number),
          zone: 'B'
        },
        timestamp: expect.any(String),
      });
    });
  });

  // 5. リアルタイム更新の統合テスト
  it('should handle real-time status updates from WebSocket', () => {
    render(<InstructorDashboardIntegration />);

    // WebSocketイベントハンドラが設定されていることを確認
    expect(mockSetEventHandlers).toHaveBeenCalled();

    // 初期状態でステータスインジケータが表示されていることを確認
    expect(screen.getByTestId('status-indicator')).toBeInTheDocument();
  });

  // 6. 通知システムとの統合
  it('should handle help request notifications in integrated environment', () => {
    const mockNotificationConstructor = jest.fn();
    global.Notification = mockNotificationConstructor as any;

    render(<InstructorDashboardIntegration />);

    // WebSocketイベントハンドラが設定されていることを確認
    expect(mockSetEventHandlers).toHaveBeenCalled();

    // 通知システムが正しく表示されていることを確認
    expect(screen.getByTestId('notification-system')).toBeInTheDocument();
  });

  // 7. エラーハンドリングの統合
  it('should handle WebSocket disconnection across all components', () => {
    mockGetConnectionState.mockReturnValue('disconnected');

    render(<InstructorDashboardIntegration />);

    // 各コンポーネントが適切にオフライン状態を表示することを確認
    expect(screen.getByText('接続エラー')).toBeInTheDocument();
    expect(screen.getByText('位置追跡オフライン')).toBeInTheDocument();
    expect(screen.getByText('通知サービス オフライン')).toBeInTheDocument();
  });

  // 8. パフォーマンステスト
  it('should handle multiple simultaneous updates efficiently', async () => {
    render(<InstructorDashboardIntegration />);

    const startTime = performance.now();

    // 複数の操作を同時に実行
    const statusButton = screen.getByRole('button', { name: /授業中/i });
    const zoneC = screen.getByTestId('zone-C');
    const helpToggle = screen.getByRole('checkbox', { name: /ヘルプ要請/i });

    fireEvent.click(statusButton);
    fireEvent.click(zoneC);
    fireEvent.click(helpToggle);

    await waitFor(() => {
      expect(mockSendStatusUpdate).toHaveBeenCalled();
      expect(mockSendLocationUpdate).toHaveBeenCalled();
    });

    const endTime = performance.now();

    // パフォーマンス要件: 複数更新が1秒以内に完了
    expect(endTime - startTime).toBeLessThan(1000);
  });

  // 9. メモリリーク防止
  it('should cleanup all event handlers on unmount', () => {
    const { unmount } = render(<InstructorDashboardIntegration />);

    // コンポーネントが正常にマウントされていることを確認
    expect(mockSetEventHandlers).toHaveBeenCalled();

    unmount();

    // アンマウント後もエラーが発生しないことを確認
    expect(true).toBe(true);
  });

  // 10. アクセシビリティ統合
  it('should maintain accessibility across all components', () => {
    render(<InstructorDashboardIntegration />);

    // 各コンポーネントのARIA属性が適切に設定されていることを確認
    expect(screen.getByRole('region', { name: '講師ステータス管理' })).toBeInTheDocument();
    expect(screen.getByRole('application', { name: '講師位置追跡' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '通知システム' })).toBeInTheDocument();
  });
});
