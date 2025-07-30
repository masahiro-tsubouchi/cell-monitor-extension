import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StatusPanel } from './StatusPanel';
import { InstructorStatus } from '../../types/api';
import webSocketService from '../../services/websocket';

// WebSocketServiceをモック化
jest.mock('../../services/websocket');

// TDD開発ルール: テストファースト（Red → Green → Refactor）
// 目的: StatusPanelコンポーネントの完全な単体テストを作成する

describe('StatusPanel', () => {
  const mockSendStatusUpdate = jest.fn();
  const mockSetEventHandlers = jest.fn();
  const mockGetConnectionState = jest.fn();

  const mockProps = {
    currentStatus: InstructorStatus.AVAILABLE,
    instructorId: 1,
    onStatusChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // WebSocketServiceのモック実装
    (webSocketService as jest.Mocked<typeof webSocketService>).sendStatusUpdate = mockSendStatusUpdate;
    (webSocketService as jest.Mocked<typeof webSocketService>).setEventHandlers = mockSetEventHandlers;
    (webSocketService as jest.Mocked<typeof webSocketService>).getConnectionState = mockGetConnectionState;

    mockGetConnectionState.mockReturnValue('connected');
  });

  // 1. 基本レンダリング
  it('should render without crashing', () => {
    render(<StatusPanel {...mockProps} />);

    expect(screen.getByTestId('status-panel')).toBeInTheDocument();
  });

  it('should display current instructor status', () => {
    render(<StatusPanel {...mockProps} />);

    const statusIndicator = screen.getByTestId('status-indicator');
    expect(statusIndicator).toHaveClass('status-available');
    expect(statusIndicator).toBeInTheDocument();
  });

  // 2. ステータス変更機能
  it('should handle status change to IN_SESSION', async () => {
    render(<StatusPanel {...mockProps} />);

    const sessionButton = screen.getByRole('button', { name: /授業中/i });
    fireEvent.click(sessionButton);

    await waitFor(() => {
      expect(mockProps.onStatusChange).toHaveBeenCalledWith(InstructorStatus.IN_SESSION);
      expect(mockSendStatusUpdate).toHaveBeenCalledWith({
        instructor_id: 1,
        status: InstructorStatus.IN_SESSION,
        timestamp: expect.any(String),
      });
    });
  });

  it('should handle status change to BREAK', async () => {
    render(<StatusPanel {...mockProps} />);

    const breakButton = screen.getByRole('button', { name: /休憩中/i });
    fireEvent.click(breakButton);

    await waitFor(() => {
      expect(mockProps.onStatusChange).toHaveBeenCalledWith(InstructorStatus.BREAK);
      expect(mockSendStatusUpdate).toHaveBeenCalledWith({
        instructor_id: 1,
        status: InstructorStatus.BREAK,
        timestamp: expect.any(String),
      });
    });
  });

  it('should handle status change to OFFLINE', async () => {
    render(<StatusPanel {...mockProps} />);

    const offlineButton = screen.getByRole('button', { name: /オフライン/i });
    fireEvent.click(offlineButton);

    await waitFor(() => {
      expect(mockProps.onStatusChange).toHaveBeenCalledWith(InstructorStatus.OFFLINE);
      expect(mockSendStatusUpdate).toHaveBeenCalledWith({
        instructor_id: 1,
        status: InstructorStatus.OFFLINE,
        timestamp: expect.any(String),
      });
    });
  });

  // 3. WebSocket統合
  it('should set up WebSocket event handlers on mount', () => {
    render(<StatusPanel {...mockProps} />);

    expect(mockSetEventHandlers).toHaveBeenCalledWith({
      onInstructorStatusUpdate: expect.any(Function),
    });
  });

  it('should update status when receiving WebSocket event', async () => {
    render(<StatusPanel {...mockProps} />);

    // setEventHandlersで渡されたコールバック関数を取得
    const eventHandlers = mockSetEventHandlers.mock.calls[0][0];

    // ステータス更新イベントをシミュレート
    const statusUpdateEvent = {
      instructor_id: 1,
      status: InstructorStatus.IN_SESSION,
      session_id: 123,
    };

    eventHandlers.onInstructorStatusUpdate(statusUpdateEvent);

    await waitFor(() => {
      expect(mockProps.onStatusChange).toHaveBeenCalledWith(InstructorStatus.IN_SESSION);
    });
  });

  // 4. UI状態表示
  it('should show correct status indicator for each status', () => {
    const statuses = [
      { status: InstructorStatus.AVAILABLE, class: 'status-available' },
      { status: InstructorStatus.IN_SESSION, class: 'status-in-session' },
      { status: InstructorStatus.BREAK, class: 'status-break' },
      { status: InstructorStatus.OFFLINE, class: 'status-offline' },
    ];

    statuses.forEach(({ status, class: className }) => {
      const { unmount } = render(<StatusPanel {...mockProps} currentStatus={status} />);

      const statusIndicator = screen.getByTestId('status-indicator');
      expect(statusIndicator).toHaveClass(className);

      unmount(); // クリーンアップ
    });
  });

  // 5. エラーハンドリング
  it('should handle WebSocket connection error gracefully', () => {
    mockGetConnectionState.mockReturnValue('disconnected');

    render(<StatusPanel {...mockProps} />);

    expect(screen.getByText('接続エラー')).toBeInTheDocument();
    expect(screen.getByTestId('status-panel')).toHaveClass('connection-error');
  });

  it('should disable status change buttons when disconnected', () => {
    mockGetConnectionState.mockReturnValue('disconnected');

    render(<StatusPanel {...mockProps} />);

    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  // 6. アクセシビリティ
  it('should have proper ARIA attributes', () => {
    render(<StatusPanel {...mockProps} />);

    const statusPanel = screen.getByTestId('status-panel');
    expect(statusPanel).toHaveAttribute('role', 'region');
    expect(statusPanel).toHaveAttribute('aria-label', '講師ステータス管理');

    const statusButtons = screen.getAllByRole('button');
    statusButtons.forEach(button => {
      expect(button).toHaveAttribute('aria-pressed');
    });
  });

  // 7. クリーンアップ
  it('should cleanup WebSocket handlers on unmount', () => {
    const { unmount } = render(<StatusPanel {...mockProps} />);

    unmount();

    expect(mockSetEventHandlers).toHaveBeenCalledWith({});
  });
});
