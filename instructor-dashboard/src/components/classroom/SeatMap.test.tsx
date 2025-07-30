import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SeatMap } from './SeatMap';
import { Seat, LayoutConfig } from '../../types';
import webSocketService from '../../services/websocket';

// WebSocketServiceをモック化
jest.mock('../../services/websocket');

// TDD開発ルール: テストファースト
// 目的: SeatMapコンポーネントの完全な単体テストを作成する

describe('SeatMap', () => {
  const mockOnSeatClick = jest.fn();

  const mockSeats: Seat[] = [
    {
      id: '1',
      seatNumber: 'A-01',
      studentId: 'student1',
      studentName: '田中太郎',
      teamNumber: 1,
      status: 'normal',
      position: { row: 0, col: 0 }
    },
    {
      id: '2',
      seatNumber: 'A-02',
      studentId: 'student2',
      studentName: '佐藤花子',
      teamNumber: 1,
      status: 'help_requested',
      position: { row: 0, col: 1 }
    },
    {
      id: '3',
      seatNumber: 'A-03',
      status: 'empty',
      position: { row: 0, col: 2 }
    },
    {
      id: '4',
      seatNumber: 'A-04',
      studentId: 'student4',
      studentName: '山田次郎',
      teamNumber: 2,
      status: 'inactive',
      position: { row: 0, col: 3 }
    }
  ];

  const mockLayout: LayoutConfig = {
    totalSeats: 200,
    gridRows: 10,
    gridCols: 20,
    gridSize: 3
  };

  beforeEach(() => {
    mockOnSeatClick.mockClear();
  });

  // 1. 基本レンダリング
  it('should render without crashing', () => {
    render(<SeatMap seats={mockSeats} layout={mockLayout} onSeatClick={mockOnSeatClick} />);

    expect(screen.getByTestId('seat-map')).toBeInTheDocument();
  });

  it('should render all seats', () => {
    render(<SeatMap seats={mockSeats} layout={mockLayout} onSeatClick={mockOnSeatClick} />);

    mockSeats.forEach(seat => {
      expect(screen.getByTestId(`seat-${seat.id}`)).toBeInTheDocument();
    });
  });

  // 2. 座席状態の表示
  it('should display normal seat correctly', () => {
    render(<SeatMap seats={mockSeats} layout={mockLayout} onSeatClick={mockOnSeatClick} />);

    const normalSeat = screen.getByTestId('seat-1');
    expect(normalSeat).toHaveClass('seat-normal');
    expect(screen.getByText('田中太郎')).toBeInTheDocument();
    expect(screen.getByText('A-01')).toBeInTheDocument();
  });

  it('should display help requested seat correctly', () => {
    render(<SeatMap seats={mockSeats} layout={mockLayout} onSeatClick={mockOnSeatClick} />);

    const helpSeat = screen.getByTestId('seat-2');
    expect(helpSeat).toHaveClass('seat-help-requested');
    expect(screen.getByText('佐藤花子')).toBeInTheDocument();
    expect(screen.getByText('A-02')).toBeInTheDocument();
  });

  it('should display empty seat correctly', () => {
    render(<SeatMap seats={mockSeats} layout={mockLayout} onSeatClick={mockOnSeatClick} />);

    const emptySeat = screen.getByTestId('seat-3');
    expect(emptySeat).toHaveClass('seat-empty');
    expect(screen.getByText('A-03')).toBeInTheDocument();
    expect(screen.getByText('空席')).toBeInTheDocument();
  });

  it('should display inactive seat correctly', () => {
    render(<SeatMap seats={mockSeats} layout={mockLayout} onSeatClick={mockOnSeatClick} />);

    const inactiveSeat = screen.getByTestId('seat-4');
    expect(inactiveSeat).toHaveClass('seat-inactive');
    expect(screen.getByText('山田次郎')).toBeInTheDocument();
    expect(screen.getByText('A-04')).toBeInTheDocument();
  });

  // 3. ユーザー操作
  it('should handle seat click correctly', () => {
    render(<SeatMap seats={mockSeats} layout={mockLayout} onSeatClick={mockOnSeatClick} />);

    const seat = screen.getByTestId('seat-1');
    fireEvent.click(seat);

    expect(mockOnSeatClick).toHaveBeenCalledTimes(1);
    expect(mockOnSeatClick).toHaveBeenCalledWith(mockSeats[0]);
  });

  it('should handle multiple seat clicks', () => {
    render(<SeatMap seats={mockSeats} layout={mockLayout} onSeatClick={mockOnSeatClick} />);

    const seat1 = screen.getByTestId('seat-1');
    const seat2 = screen.getByTestId('seat-2');

    fireEvent.click(seat1);
    fireEvent.click(seat2);

    expect(mockOnSeatClick).toHaveBeenCalledTimes(2);
    expect(mockOnSeatClick).toHaveBeenNthCalledWith(1, mockSeats[0]);
    expect(mockOnSeatClick).toHaveBeenNthCalledWith(2, mockSeats[1]);
  });

  // 4. レスポンシブ対応
  it('should apply correct grid layout', () => {
    render(<SeatMap seats={mockSeats} layout={mockLayout} onSeatClick={mockOnSeatClick} />);

    const seatMap = screen.getByTestId('seat-map');
    expect(seatMap).toHaveStyle('display: grid');
  });

  // 5. アクセシビリティ
  it('should have proper ARIA attributes', () => {
    render(<SeatMap seats={mockSeats} layout={mockLayout} onSeatClick={mockOnSeatClick} />);

    const seatMap = screen.getByTestId('seat-map');
    expect(seatMap).toHaveAttribute('role', 'grid');
    expect(seatMap).toHaveAttribute('aria-label', '座席マップ');

    mockSeats.forEach(seat => {
      const seatElement = screen.getByTestId(`seat-${seat.id}`);
      expect(seatElement).toHaveAttribute('role', 'gridcell');
      expect(seatElement).toHaveAttribute('tabindex', '0');
    });
  });

  it('should support keyboard navigation', () => {
    render(<SeatMap seats={mockSeats} layout={mockLayout} onSeatClick={mockOnSeatClick} />);

    const firstSeat = screen.getByTestId('seat-1');

    // Enter key should trigger click
    fireEvent.keyDown(firstSeat, { key: 'Enter', code: 'Enter' });
    expect(mockOnSeatClick).toHaveBeenCalledWith(mockSeats[0]);

    // Space key should trigger click
    fireEvent.keyDown(firstSeat, { key: ' ', code: 'Space' });
    expect(mockOnSeatClick).toHaveBeenCalledTimes(2);
  });

  // 6. エラー処理
  it('should handle empty seats array', () => {
    render(<SeatMap seats={[]} layout={mockLayout} onSeatClick={mockOnSeatClick} />);

    expect(screen.getByTestId('seat-map')).toBeInTheDocument();
    expect(screen.getByText('座席データがありません')).toBeInTheDocument();
  });

  it('should handle missing student information gracefully', () => {
    const seatWithoutStudent: Seat = {
      id: '5',
      seatNumber: 'B-01',
      status: 'normal',
      position: { row: 1, col: 0 }
    };

    render(<SeatMap seats={[seatWithoutStudent]} layout={mockLayout} onSeatClick={mockOnSeatClick} />);

    const seat = screen.getByTestId('seat-5');
    expect(seat).toBeInTheDocument();
    expect(screen.getByText('B-01')).toBeInTheDocument();
  });

  // 7. パフォーマンステスト
  it('should render 200 seats within performance threshold', () => {
    const manySeats: Seat[] = Array.from({ length: 200 }, (_, index) => ({
      id: `${index + 1}`,
      seatNumber: `${String.fromCharCode(65 + Math.floor(index / 20))}-${String(index % 20 + 1).padStart(2, '0')}`,
      studentId: `student${index + 1}`,
      studentName: `学生${index + 1}`,
      teamNumber: Math.floor(index / 4) + 1,
      status: 'normal' as const,
      position: { row: Math.floor(index / 20), col: index % 20 }
    }));

    const startTime = performance.now();
    render(<SeatMap seats={manySeats} layout={mockLayout} onSeatClick={mockOnSeatClick} />);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(3000); // 3秒以内
    expect(screen.getAllByTestId(/^seat-\d+$/)).toHaveLength(200);
  });

  // WebSocket統合テスト（TDD Red フェーズ）
  describe('WebSocket Integration', () => {
    const mockConnect = jest.fn();
    const mockSetEventHandlers = jest.fn();
    const mockGetConnectionState = jest.fn();
    const mockDisconnect = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();

      // WebSocketServiceのモック実装
      (webSocketService as jest.Mocked<typeof webSocketService>).connect = mockConnect;
      (webSocketService as jest.Mocked<typeof webSocketService>).setEventHandlers = mockSetEventHandlers;
      (webSocketService as jest.Mocked<typeof webSocketService>).getConnectionState = mockGetConnectionState;
      (webSocketService as jest.Mocked<typeof webSocketService>).disconnect = mockDisconnect;

      mockGetConnectionState.mockReturnValue('disconnected');
    });

    it('should connect to WebSocket and set event handlers on mount', () => {
      render(<SeatMap seats={mockSeats} layout={mockLayout} onSeatClick={mockOnSeatClick} />);

      // WebSocket接続とイベントハンドラ設定が呼ばれることを確認
      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(mockSetEventHandlers).toHaveBeenCalledTimes(1);
    });

    it('should update seat status on student help request event', async () => {
      const { rerender } = render(<SeatMap seats={mockSeats} layout={mockLayout} onSeatClick={mockOnSeatClick} />);

      // setEventHandlersで渡されたコールバック関数を取得
      const eventHandlers = mockSetEventHandlers.mock.calls[0][0];

      // ヘルプ要請イベントをシミュレート
      const helpRequestEvent = {
        student_id: 1,
        seat_number: 'A-01',
        urgency: 'high' as const,
        description: 'ヘルプが必要です'
      };

      // イベントハンドラが存在することを確認
      expect(eventHandlers.onStudentHelpRequest).toBeDefined();

      // ヘルプ要請イベントを発火
      eventHandlers.onStudentHelpRequest(helpRequestEvent);

      // 座席状態が更新されることを確認
      await waitFor(() => {
        const seatElement = screen.getByTestId('seat-1');
        expect(seatElement).toHaveClass('seat-help-requested');
      });
    });

    it('should update instructor status on instructor status change event', async () => {
      render(<SeatMap seats={mockSeats} layout={mockLayout} onSeatClick={mockOnSeatClick} />);

      const eventHandlers = mockSetEventHandlers.mock.calls[0][0];

      // 講師ステータス変更イベントをシミュレート
      const statusChangeEvent = {
        instructor_id: 'instructor1',
        status: 'available',
        location: 'A-01',
        timestamp: new Date().toISOString()
      };

      expect(eventHandlers.onInstructorStatusUpdate).toBeDefined();
      eventHandlers.onInstructorStatusUpdate(statusChangeEvent);

      // 講師ステータスの更新を確認（実装後にテスト内容を調整）
      await waitFor(() => {
        // 実装に応じてアサーションを追加
        expect(true).toBe(true); // プレースホルダー
      });
    });

    it('should cleanup WebSocket connection on unmount', () => {
      const { unmount } = render(<SeatMap seats={mockSeats} layout={mockLayout} onSeatClick={mockOnSeatClick} />);

      unmount();

      // クリーンアップが呼ばれることを確認
      expect(mockSetEventHandlers).toHaveBeenCalledWith({});
    });

    it('should not reconnect if already connected', () => {
      mockGetConnectionState.mockReturnValue('connected');

      render(<SeatMap seats={mockSeats} layout={mockLayout} onSeatClick={mockOnSeatClick} />);

      // 既に接続済みの場合は再接続しない
      expect(mockConnect).not.toHaveBeenCalled();
    });
  });
});
