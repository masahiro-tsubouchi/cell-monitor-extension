import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Dashboard from './Dashboard';
import { Seat, Instructor, HelpRequest } from '../types/index';

// TDD開発ルール: テストファースト
// 目的: Dashboardページの完全な統合テストを作成する

// モックデータ
const mockInstructor: Instructor = {
  id: 'instructor1',
  name: '田中先生',
  status: 'AVAILABLE',
  currentLocation: '教室A'
};

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
  }
];

const mockHelpRequests: HelpRequest[] = [
  {
    id: 'help1',
    seatNumber: 'A-02',
    studentId: 'student2',
    studentName: '佐藤花子',
    urgency: 'high',
    timestamp: '2025-01-27T12:00:00Z',
    description: 'エラーが解決できません'
  }
];

describe('Dashboard', () => {
  const mockProps = {
    instructor: mockInstructor,
    seats: mockSeats,
    helpRequests: mockHelpRequests,
    onSeatClick: jest.fn(),
    onHelpRequestClick: jest.fn(),
    onStatusChange: jest.fn(),
    onLogout: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. 基本レンダリング
  it('should render without crashing', () => {
    render(<Dashboard {...mockProps} />);

    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();
    expect(screen.getByTestId('seat-map-section')).toBeInTheDocument();
    expect(screen.getByTestId('help-requests-section')).toBeInTheDocument();
  });

  // 2. 講師情報の表示確認
  it('should display instructor information in header', () => {
    render(<Dashboard {...mockProps} />);

    expect(screen.getByText('田中先生')).toBeInTheDocument();
    expect(screen.getByText('対応可能')).toBeInTheDocument();
    // 複数の要素に対応
    const locationElements = screen.getAllByText((content, element) => {
      return element?.textContent?.includes('教室A') || false;
    });
    expect(locationElements.length).toBeGreaterThan(0);
  });

  it('should display current time and date', () => {
    render(<Dashboard {...mockProps} />);

    // 現在時刻が表示されることを確認（具体的な時刻は変動するため存在確認のみ）
    expect(screen.getByTestId('current-time')).toBeInTheDocument();
    expect(screen.getByTestId('current-date')).toBeInTheDocument();
  });

  // 3. 座席マップセクション
  it('should display seat map with student information', () => {
    render(<Dashboard {...mockProps} />);

    const seatMapSection = screen.getByTestId('seat-map-section');
    expect(seatMapSection).toBeInTheDocument();

    // 座席マップ内の学生情報を確認
    const studentNames = screen.getAllByText('田中太郎');
    expect(studentNames.length).toBeGreaterThan(0);

    const seatNumbers = screen.getAllByText('佐藤花子');
    expect(seatNumbers.length).toBeGreaterThan(0);

    expect(screen.getByText('空席')).toBeInTheDocument();
  });

  it('should handle seat click events', () => {
    render(<Dashboard {...mockProps} />);

    const seat = screen.getByTestId('seat-1');
    fireEvent.click(seat);

    expect(mockProps.onSeatClick).toHaveBeenCalledWith(mockSeats[0]);
  });

  // 4. ヘルプ要請セクション
  it('should display help requests list', () => {
    render(<Dashboard {...mockProps} />);

    expect(screen.getByText('ヘルプ要請一覧')).toBeInTheDocument();

    const helpRequestSection = screen.getByTestId('help-requests-section');
    // ヘルプ要請リスト内の座席番号を確認
    const helpRequestItems = screen.getAllByTestId('help-request-seat-number');
    expect(helpRequestItems.length).toBeGreaterThan(0);
    expect(helpRequestSection).toContainElement(screen.getByText('エラーが解決できません'));
  });

  it('should display urgency indicators', () => {
    render(<Dashboard {...mockProps} />);

    const helpRequestItem = screen.getByTestId('help-request-help1');
    expect(helpRequestItem).toHaveClass('urgency-high');
  });

  it('should handle help request click events', () => {
    render(<Dashboard {...mockProps} />);

    const helpRequest = screen.getByTestId('help-request-help1');
    fireEvent.click(helpRequest);

    expect(mockProps.onHelpRequestClick).toHaveBeenCalledWith(mockHelpRequests[0]);
  });

  // 5. 講師ステータス管理
  it('should display status change controls', () => {
    render(<Dashboard {...mockProps} />);

    expect(screen.getByTestId('status-controls')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /対応可能/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /休憩中/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /授業中/i })).toBeInTheDocument();
  });

  it('should handle status change', () => {
    render(<Dashboard {...mockProps} />);

    const breakButton = screen.getByRole('button', { name: /休憩中/i });
    fireEvent.click(breakButton);

    expect(mockProps.onStatusChange).toHaveBeenCalledWith('BREAK');
  });

  // 6. ログアウト機能
  it('should display logout button', () => {
    render(<Dashboard {...mockProps} />);

    expect(screen.getByRole('button', { name: /ログアウト/i })).toBeInTheDocument();
  });

  it('should handle logout', () => {
    render(<Dashboard {...mockProps} />);

    const logoutButton = screen.getByRole('button', { name: /ログアウト/i });
    fireEvent.click(logoutButton);

    expect(mockProps.onLogout).toHaveBeenCalledTimes(1);
  });

  // 7. レスポンシブデザイン
  it('should be responsive on mobile devices', () => {
    // モバイルサイズでのレンダリングをシミュレート
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    render(<Dashboard {...mockProps} />);

    const dashboard = screen.getByTestId('dashboard');
    expect(dashboard).toHaveStyle('display: flex');
    expect(dashboard).toHaveStyle('flex-direction: column');
  });

  // 8. リアルタイム更新のシミュレーション
  it('should update when props change', async () => {
    const { rerender } = render(<Dashboard {...mockProps} />);

    // 新しいヘルプ要請を追加
    const newHelpRequest: HelpRequest = {
      id: 'help2',
      seatNumber: 'A-01',
      studentId: 'student1',
      studentName: '田中太郎',
      urgency: 'medium',
      timestamp: '2025-01-27T12:05:00Z',
      description: '質問があります'
    };

    const updatedProps = {
      ...mockProps,
      helpRequests: [...mockHelpRequests, newHelpRequest]
    };

    rerender(<Dashboard {...updatedProps} />);

    await waitFor(() => {
      expect(screen.getByText('質問があります')).toBeInTheDocument();
    });
  });

  // 9. エラー処理
  it('should handle empty help requests gracefully', () => {
    const propsWithoutHelp = {
      ...mockProps,
      helpRequests: []
    };

    render(<Dashboard {...propsWithoutHelp} />);

    expect(screen.getByText('現在ヘルプ要請はありません')).toBeInTheDocument();
  });

  it('should handle missing instructor information', () => {
    const propsWithoutInstructor = {
      ...mockProps,
      instructor: null
    };

    render(<Dashboard {...propsWithoutInstructor} />);

    expect(screen.getByText('講師情報なし')).toBeInTheDocument();
  });

  // 10. アクセシビリティ
  it('should have proper ARIA labels', () => {
    render(<Dashboard {...mockProps} />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('should support keyboard navigation', () => {
    render(<Dashboard {...mockProps} />);

    const firstSeat = screen.getByTestId('seat-1');
    const helpRequest = screen.getByTestId('help-request-help1');

    // Tab navigation should work
    expect(firstSeat).toHaveAttribute('tabindex', '0');
    expect(helpRequest).toHaveAttribute('tabindex', '0');
  });
});
