import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LocationTracker } from './LocationTracker';
import webSocketService from '../../services/websocket';

// WebSocketServiceをモック化
jest.mock('../../services/websocket');

// TDD開発ルール: テストファースト（Red → Green → Refactor）
// 目的: LocationTrackerコンポーネントの完全な単体テストを作成する

describe('LocationTracker', () => {
  const mockSendLocationUpdate = jest.fn();
  const mockSetEventHandlers = jest.fn();
  const mockGetConnectionState = jest.fn();

  const mockProps = {
    instructorId: 1,
    currentLocation: { x: 100, y: 150, zone: 'A' },
    onLocationChange: jest.fn(),
    classroomLayout: {
      width: 800,
      height: 600,
      zones: [
        { id: 'A', name: 'エリアA', bounds: { x: 0, y: 0, width: 400, height: 300 } },
        { id: 'B', name: 'エリアB', bounds: { x: 400, y: 0, width: 400, height: 300 } },
        { id: 'C', name: 'エリアC', bounds: { x: 0, y: 300, width: 400, height: 300 } },
        { id: 'D', name: 'エリアD', bounds: { x: 400, y: 300, width: 400, height: 300 } },
      ]
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // WebSocketServiceのモック実装
    (webSocketService as jest.Mocked<typeof webSocketService>).sendLocationUpdate = mockSendLocationUpdate;
    (webSocketService as jest.Mocked<typeof webSocketService>).setEventHandlers = mockSetEventHandlers;
    (webSocketService as jest.Mocked<typeof webSocketService>).getConnectionState = mockGetConnectionState;

    mockGetConnectionState.mockReturnValue('connected');
  });

  // 1. 基本レンダリング
  it('should render without crashing', () => {
    render(<LocationTracker {...mockProps} />);

    expect(screen.getByTestId('location-tracker')).toBeInTheDocument();
  });

  it('should display current instructor location', () => {
    render(<LocationTracker {...mockProps} />);

    expect(screen.getByText('現在位置: エリアA')).toBeInTheDocument();
    expect(screen.getByTestId('location-indicator')).toBeInTheDocument();
  });

  it('should render classroom layout map', () => {
    render(<LocationTracker {...mockProps} />);

    const layoutMap = screen.getByTestId('classroom-layout-map');
    expect(layoutMap).toBeInTheDocument();

    // 各ゾーンが表示されることを確認
    expect(screen.getByTestId('zone-A')).toBeInTheDocument();
    expect(screen.getByTestId('zone-B')).toBeInTheDocument();
    expect(screen.getByTestId('zone-C')).toBeInTheDocument();
    expect(screen.getByTestId('zone-D')).toBeInTheDocument();
  });

  // 2. 位置更新機能
  it('should handle location click on map', async () => {
    render(<LocationTracker {...mockProps} />);

    const zoneB = screen.getByTestId('zone-B');
    fireEvent.click(zoneB);

    await waitFor(() => {
      expect(mockProps.onLocationChange).toHaveBeenCalledWith({
        x: expect.any(Number),
        y: expect.any(Number),
        zone: 'B'
      });
    });
  });

  it('should send location update via WebSocket', async () => {
    render(<LocationTracker {...mockProps} />);

    const zoneC = screen.getByTestId('zone-C');
    fireEvent.click(zoneC);

    await waitFor(() => {
      expect(mockSendLocationUpdate).toHaveBeenCalledWith({
        instructor_id: 1,
        location: {
          x: expect.any(Number),
          y: expect.any(Number),
          zone: 'C'
        },
        timestamp: expect.any(String),
      });
    });
  });

  // 3. WebSocket統合
  it('should set up WebSocket event handlers on mount', () => {
    render(<LocationTracker {...mockProps} />);

    expect(mockSetEventHandlers).toHaveBeenCalledWith({
      onInstructorLocationUpdate: expect.any(Function),
    });
  });

  it('should update location when receiving WebSocket event', async () => {
    render(<LocationTracker {...mockProps} />);

    // setEventHandlersで渡されたコールバック関数を取得
    const eventHandlers = mockSetEventHandlers.mock.calls[0][0];

    // 位置更新イベントをシミュレート
    const locationUpdateEvent = {
      instructor_id: 1,
      location: { x: 200, y: 250, zone: 'B' },
      timestamp: new Date().toISOString(),
    };

    eventHandlers.onInstructorLocationUpdate(locationUpdateEvent);

    await waitFor(() => {
      expect(mockProps.onLocationChange).toHaveBeenCalledWith({
        x: 200,
        y: 250,
        zone: 'B'
      });
    });
  });

  // 4. 位置履歴表示
  it('should display location history', () => {
    const propsWithHistory = {
      ...mockProps,
      locationHistory: [
        { zone: 'A', timestamp: '2024-01-27T10:00:00Z', duration: 300 },
        { zone: 'B', timestamp: '2024-01-27T10:05:00Z', duration: 180 },
        { zone: 'C', timestamp: '2024-01-27T10:08:00Z', duration: 120 },
      ]
    };

    render(<LocationTracker {...propsWithHistory} />);

    expect(screen.getByText('位置履歴')).toBeInTheDocument();
    expect(screen.getByText('エリアA (5分0秒)')).toBeInTheDocument();
    expect(screen.getByText('エリアB (3分0秒)')).toBeInTheDocument();
    expect(screen.getByText('エリアC (2分0秒)')).toBeInTheDocument();
  });

  // 5. 効率性分析
  it('should display movement efficiency metrics', () => {
    const propsWithMetrics = {
      ...mockProps,
      efficiencyMetrics: {
        totalDistance: 450.5,
        averageResponseTime: 125,
        zoneUtilization: {
          A: 0.4,
          B: 0.3,
          C: 0.2,
          D: 0.1
        }
      }
    };

    render(<LocationTracker {...propsWithMetrics} />);

    expect(screen.getByText('移動効率')).toBeInTheDocument();
    expect(screen.getByText('総移動距離: 450.5m')).toBeInTheDocument();
    expect(screen.getByText('平均応答時間: 2分5秒')).toBeInTheDocument();
  });

  // 6. エラーハンドリング
  it('should handle WebSocket connection error gracefully', () => {
    mockGetConnectionState.mockReturnValue('disconnected');

    render(<LocationTracker {...mockProps} />);

    expect(screen.getByText('位置追跡オフライン')).toBeInTheDocument();
    expect(screen.getByTestId('location-tracker')).toHaveClass('offline-mode');
  });

  it('should disable location updates when disconnected', () => {
    mockGetConnectionState.mockReturnValue('disconnected');

    render(<LocationTracker {...mockProps} />);

    const zoneA = screen.getByTestId('zone-A');
    fireEvent.click(zoneA);

    // WebSocket送信が呼ばれないことを確認
    expect(mockSendLocationUpdate).not.toHaveBeenCalled();
  });

  // 7. アクセシビリティ
  it('should have proper ARIA attributes', () => {
    render(<LocationTracker {...mockProps} />);

    const locationTracker = screen.getByTestId('location-tracker');
    expect(locationTracker).toHaveAttribute('role', 'application');
    expect(locationTracker).toHaveAttribute('aria-label', '講師位置追跡');

    const layoutMap = screen.getByTestId('classroom-layout-map');
    expect(layoutMap).toHaveAttribute('role', 'img');
    expect(layoutMap).toHaveAttribute('aria-label', '教室レイアウトマップ');
  });

  it('should support keyboard navigation', () => {
    render(<LocationTracker {...mockProps} />);

    const zones = screen.getAllByTestId(/zone-/);
    zones.forEach(zone => {
      expect(zone).toHaveAttribute('tabIndex', '0');
      expect(zone).toHaveAttribute('role', 'button');
    });
  });

  // 8. レスポンシブデザイン
  it('should adapt to different screen sizes', () => {
    // モバイルサイズをシミュレート
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    render(<LocationTracker {...mockProps} />);

    const layoutMap = screen.getByTestId('classroom-layout-map');
    expect(layoutMap).toHaveStyle('max-width: 100%');
  });

  // 9. クリーンアップ
  it('should cleanup WebSocket handlers on unmount', () => {
    const { unmount } = render(<LocationTracker {...mockProps} />);

    unmount();

    expect(mockSetEventHandlers).toHaveBeenCalledWith({});
  });
});
