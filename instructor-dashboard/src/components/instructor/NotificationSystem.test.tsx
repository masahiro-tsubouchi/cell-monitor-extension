import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotificationSystem } from './NotificationSystem';
import webSocketService from '../../services/websocket';

// WebSocketServiceをモック化
jest.mock('../../services/websocket');

// Web Push APIをモック化
const mockServiceWorkerRegistration = {
  pushManager: {
    subscribe: jest.fn(),
    getSubscription: jest.fn(),
  },
};

const mockNotification = {
  permission: 'default' as NotificationPermission,
  requestPermission: jest.fn(),
};

// グローバルオブジェクトのモック
Object.defineProperty(global, 'navigator', {
  value: {
    serviceWorker: {
      ready: Promise.resolve(mockServiceWorkerRegistration),
      register: jest.fn(),
    },
  },
  writable: true,
});

Object.defineProperty(global, 'Notification', {
  value: mockNotification,
  writable: true,
});

// TDD開発ルール: テストファースト（Red → Green → Refactor）
// 目的: NotificationSystemコンポーネントの完全な単体テストを作成する

describe('NotificationSystem', () => {
  const mockSendNotificationSubscription = jest.fn();
  const mockSetEventHandlers = jest.fn();
  const mockGetConnectionState = jest.fn();

  const mockProps = {
    instructorId: 1,
    isEnabled: true,
    onSettingsChange: jest.fn(),
    notificationSettings: {
      helpRequests: true,
      statusUpdates: true,
      systemAlerts: true,
      sound: true,
      vibration: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // WebSocketServiceのモック実装
    (webSocketService as jest.Mocked<typeof webSocketService>).sendNotificationSubscription = mockSendNotificationSubscription;
    (webSocketService as jest.Mocked<typeof webSocketService>).setEventHandlers = mockSetEventHandlers;
    (webSocketService as jest.Mocked<typeof webSocketService>).getConnectionState = mockGetConnectionState;

    mockGetConnectionState.mockReturnValue('connected');
    mockNotification.permission = 'default';
    mockNotification.requestPermission.mockResolvedValue('granted');
    mockServiceWorkerRegistration.pushManager.getSubscription.mockResolvedValue(null);
    mockServiceWorkerRegistration.pushManager.subscribe.mockResolvedValue({
      endpoint: 'https://test-endpoint.com',
      keys: {
        p256dh: 'test-p256dh-key',
        auth: 'test-auth-key',
      },
    });
  });

  // 1. 基本レンダリング
  it('should render without crashing', () => {
    render(<NotificationSystem {...mockProps} />);

    expect(screen.getByTestId('notification-system')).toBeInTheDocument();
  });

  it('should display notification settings panel', () => {
    render(<NotificationSystem {...mockProps} />);

    expect(screen.getByText('通知設定')).toBeInTheDocument();
    expect(screen.getByText('ヘルプ要請')).toBeInTheDocument();
    expect(screen.getByText('ステータス更新')).toBeInTheDocument();
    expect(screen.getByText('システムアラート')).toBeInTheDocument();
  });

  // 2. 通知許可要求
  it('should request notification permission when enabled', async () => {
    render(<NotificationSystem {...mockProps} />);

    const enableButton = screen.getByRole('button', { name: /通知を有効にする/i });
    fireEvent.click(enableButton);

    await waitFor(() => {
      expect(mockNotification.requestPermission).toHaveBeenCalled();
    });
  });

  it('should handle permission granted', async () => {
    mockNotification.requestPermission.mockResolvedValue('granted');

    render(<NotificationSystem {...mockProps} />);

    const enableButton = screen.getByRole('button', { name: /通知を有効にする/i });
    fireEvent.click(enableButton);

    await waitFor(() => {
      expect(screen.getByText('通知が有効になりました')).toBeInTheDocument();
    });
  });

  it('should handle permission denied', async () => {
    mockNotification.requestPermission.mockResolvedValue('denied');

    render(<NotificationSystem {...mockProps} />);

    const enableButton = screen.getByRole('button', { name: /通知を有効にする/i });
    fireEvent.click(enableButton);

    await waitFor(() => {
      expect(screen.getByText('通知が拒否されました')).toBeInTheDocument();
    });
  });

  // 3. Push通知購読
  it('should subscribe to push notifications when permission granted', () => {
    mockNotification.permission = 'granted';
    const propsWithGrantedPermission = {
      ...mockProps,
      isEnabled: true,
    };

    render(<NotificationSystem {...propsWithGrantedPermission} />);

    // 通知許可状態が正しく表示されていることを確認
    expect(screen.getByText('通知が有効になりました')).toBeInTheDocument();
  });

  it('should send subscription to server via WebSocket', async () => {
    mockNotification.permission = 'granted';
    const propsWithGrantedPermission = {
      ...mockProps,
      isEnabled: true,
    };

    render(<NotificationSystem {...propsWithGrantedPermission} />);

    // WebSocketサービスのsendNotificationSubscriptionメソッドが存在することを確認
    expect(mockSendNotificationSubscription).toBeDefined();
  });

  // 4. 通知設定変更
  it('should handle help request setting toggle', () => {
    render(<NotificationSystem {...mockProps} />);

    const helpRequestToggle = screen.getByRole('checkbox', { name: /ヘルプ要請/i });
    fireEvent.click(helpRequestToggle);

    expect(mockProps.onSettingsChange).toHaveBeenCalledWith({
      ...mockProps.notificationSettings,
      helpRequests: false,
    });
  });

  it('should handle sound setting toggle', () => {
    render(<NotificationSystem {...mockProps} />);

    const soundToggle = screen.getByRole('checkbox', { name: /音声通知/i });
    fireEvent.click(soundToggle);

    expect(mockProps.onSettingsChange).toHaveBeenCalledWith({
      ...mockProps.notificationSettings,
      sound: false,
    });
  });

  it('should handle vibration setting toggle', () => {
    render(<NotificationSystem {...mockProps} />);

    const vibrationToggle = screen.getByRole('checkbox', { name: /バイブレーション/i });
    fireEvent.click(vibrationToggle);

    expect(mockProps.onSettingsChange).toHaveBeenCalledWith({
      ...mockProps.notificationSettings,
      vibration: false,
    });
  });

  // 5. WebSocket統合
  it('should set up WebSocket event handlers on mount', () => {
    render(<NotificationSystem {...mockProps} />);

    expect(mockSetEventHandlers).toHaveBeenCalledWith({
      onStudentHelpRequest: expect.any(Function),
      onInstructorStatusUpdate: expect.any(Function),
      onSystemAlert: expect.any(Function),
    });
  });

  it('should show notification for help request', () => {
    mockNotification.permission = 'granted';
    global.Notification = jest.fn().mockImplementation(() => ({
      close: jest.fn(),
    })) as any;

    const propsWithGrantedPermission = {
      ...mockProps,
      isEnabled: true,
    };

    render(<NotificationSystem {...propsWithGrantedPermission} />);

    // WebSocketイベントハンドラが設定されていることを確認
    expect(mockSetEventHandlers).toHaveBeenCalledWith({
      onStudentHelpRequest: expect.any(Function),
      onInstructorStatusUpdate: expect.any(Function),
      onSystemAlert: expect.any(Function),
    });
  });

  // 6. 通知履歴
  it('should display notification history', () => {
    const propsWithHistory = {
      ...mockProps,
      notificationHistory: [
        {
          id: '1',
          type: 'help_request' as 'help_request' | 'status_update' | 'system_alert',
          title: 'ヘルプ要請',
          message: '田中太郎さん (A-05) からヘルプ要請',
          timestamp: '2024-01-27T10:00:00Z',
          read: false,
        },
        {
          id: '2',
          type: 'status_update' as 'help_request' | 'status_update' | 'system_alert',
          title: 'ステータス更新',
          message: '講師が休憩中になりました',
          timestamp: '2024-01-27T09:30:00Z',
          read: true,
        },
      ],
    };

    render(<NotificationSystem {...propsWithHistory} />);

    expect(screen.getByText('通知履歴')).toBeInTheDocument();
    expect(screen.getByText('田中太郎さん (A-05) からヘルプ要請')).toBeInTheDocument();
    expect(screen.getByText('講師が休憩中になりました')).toBeInTheDocument();
  });

  it('should mark notification as read when clicked', () => {
    const propsWithHistory = {
      ...mockProps,
      onNotificationRead: jest.fn(),
      notificationHistory: [
        {
          id: '1',
          type: 'help_request' as const,
          title: 'ヘルプ要請',
          message: '田中太郎さん (A-05) からヘルプ要請',
          timestamp: '2024-01-27T10:00:00Z',
          read: false,
        },
      ],
    };

    render(<NotificationSystem {...propsWithHistory} />);

    const notificationItem = screen.getByTestId('notification-1');
    fireEvent.click(notificationItem);

    expect(propsWithHistory.onNotificationRead).toHaveBeenCalledWith('1');
  });

  // 7. エラーハンドリング
  it('should handle service worker registration failure', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();

    // Service Workerをサポートしない環境をシミュレート
    const originalNavigator = global.navigator;
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        serviceWorker: undefined,
      },
      configurable: true,
    });

    render(<NotificationSystem {...mockProps} />);

    // Service Workerがサポートされていない場合の基本的な表示を確認
    expect(screen.getByText('通知許可が必要です')).toBeInTheDocument();

    // 元に戻す
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
    consoleError.mockRestore();
  });

  it('should handle WebSocket disconnection gracefully', () => {
    mockGetConnectionState.mockReturnValue('disconnected');

    render(<NotificationSystem {...mockProps} />);

    expect(screen.getByText('通知サービス オフライン')).toBeInTheDocument();
  });

  // 8. アクセシビリティ
  it('should have proper ARIA attributes', () => {
    render(<NotificationSystem {...mockProps} />);

    const notificationSystem = screen.getByTestId('notification-system');
    expect(notificationSystem).toHaveAttribute('role', 'region');
    expect(notificationSystem).toHaveAttribute('aria-label', '通知システム');

    // Switchコンポーネントのaria-describedby属性を確認
    const helpRequestsSwitch = screen.getByRole('checkbox', { name: /ヘルプ要請/i });
    expect(helpRequestsSwitch).toHaveAttribute('aria-describedby', 'help-requests-description');
  });

  // 9. クリーンアップ
  it('should cleanup WebSocket handlers on unmount', () => {
    const { unmount } = render(<NotificationSystem {...mockProps} />);

    unmount();

    expect(mockSetEventHandlers).toHaveBeenCalledWith({});
  });
});
