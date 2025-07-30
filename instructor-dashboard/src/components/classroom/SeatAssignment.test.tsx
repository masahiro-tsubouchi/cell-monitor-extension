import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SeatAssignment } from './SeatAssignment';
import { Seat, SeatStatus } from '../../types/api';

// モックデータ
const mockSeats: Seat[] = [
  {
    id: 'seat-a01',
    seatNumber: 'A-01',
    position: { x: 100, y: 100 },
    status: SeatStatus.AVAILABLE,
    studentId: null,
    studentName: null,
  },
  {
    id: 'seat-a02',
    seatNumber: 'A-02',
    position: { x: 200, y: 100 },
    status: SeatStatus.OCCUPIED,
    studentId: 'student-1',
    studentName: '田中太郎',
  },
  {
    id: 'seat-a03',
    seatNumber: 'A-03',
    position: { x: 300, y: 100 },
    status: SeatStatus.HELP_REQUESTED,
    studentId: 'student-2',
    studentName: '佐藤花子',
  },
];

const mockStudents = [
  { id: 'student-1', name: '田中太郎', email: 'tanaka@example.com' },
  { id: 'student-2', name: '佐藤花子', email: 'sato@example.com' },
  { id: 'student-3', name: '鈴木一郎', email: 'suzuki@example.com' },
  { id: 'student-4', name: '高橋美咲', email: 'takahashi@example.com' },
];

const mockProps = {
  seats: mockSeats,
  students: mockStudents,
  onSeatAssign: jest.fn(),
  onSeatUnassign: jest.fn(),
  onBulkAssign: jest.fn(),
  onAutoAssign: jest.fn(),
  onExportAssignment: jest.fn(),
  onImportAssignment: jest.fn(),
};

describe('SeatAssignment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', () => {
    render(<SeatAssignment {...mockProps} />);
    expect(screen.getByText('座席割り当て')).toBeInTheDocument();
  });

  it('should display seat assignment overview', () => {
    render(<SeatAssignment {...mockProps} />);

    expect(screen.getByText('総座席数: 3')).toBeInTheDocument();
    expect(screen.getByText('割り当て済み: 2')).toBeInTheDocument();
    expect(screen.getByText('空席: 1')).toBeInTheDocument();
  });

  it('should display seat list with current assignments', () => {
    render(<SeatAssignment {...mockProps} />);

    expect(screen.getByText('A-01')).toBeInTheDocument();
    expect(screen.getByText('A-02')).toBeInTheDocument();
    expect(screen.getByText('A-03')).toBeInTheDocument();

    expect(screen.getByText('田中太郎')).toBeInTheDocument();
    expect(screen.getByText('佐藤花子')).toBeInTheDocument();
    expect(screen.getByText('未割り当て')).toBeInTheDocument();
  });

  it('should display unassigned students list', () => {
    render(<SeatAssignment {...mockProps} />);

    expect(screen.getByText('未割り当て学生')).toBeInTheDocument();
    expect(screen.getByText('鈴木一郎')).toBeInTheDocument();
    expect(screen.getByText('高橋美咲')).toBeInTheDocument();
  });

  it('should handle manual seat assignment', () => {
    render(<SeatAssignment {...mockProps} />);

    // 空席をクリック
    const emptySeat = screen.getByTestId('seat-assignment-seat-a01');
    fireEvent.click(emptySeat);

    // 学生選択ダイアログが表示される
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('学生を選択')).toBeInTheDocument();
    expect(within(dialog).getByText('座席: A-01')).toBeInTheDocument();

    // 学生を選択して割り当て
    const student = within(dialog).getByText('鈴木一郎');
    fireEvent.click(student);

    expect(mockProps.onSeatAssign).toHaveBeenCalledWith('seat-a01', 'student-3');
  });

  it('should handle seat unassignment', () => {
    render(<SeatAssignment {...mockProps} />);

    // 割り当て済み座席をクリック
    const assignedSeat = screen.getByTestId('seat-assignment-seat-a02');

    // 座席内の割り当て解除ボタンをクリック
    const unassignButton = within(assignedSeat).getByLabelText('割り当て解除');
    fireEvent.click(unassignButton);

    expect(mockProps.onSeatUnassign).toHaveBeenCalledWith('seat-a02');
  });

  it('should show student assignment dialog', () => {
    render(<SeatAssignment {...mockProps} />);

    const emptySeat = screen.getByTestId('seat-assignment-seat-a01');
    fireEvent.click(emptySeat);

    expect(screen.getByText('学生を選択')).toBeInTheDocument();
    expect(screen.getByText('座席: A-01')).toBeInTheDocument();

    // 学生リストが表示される
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('鈴木一郎')).toBeInTheDocument();
    expect(within(dialog).getByText('suzuki@example.com')).toBeInTheDocument();
    expect(within(dialog).getByText('高橋美咲')).toBeInTheDocument();
    expect(within(dialog).getByText('takahashi@example.com')).toBeInTheDocument();
  });

  it('should filter students by search query', () => {
    render(<SeatAssignment {...mockProps} />);

    const emptySeat = screen.getByTestId('seat-assignment-seat-a01');
    fireEvent.click(emptySeat);

    // 学生検索
    const searchInput = screen.getByLabelText('学生検索');
    fireEvent.change(searchInput, { target: { value: '鈴木' } });

    // ダイアログ内の学生リストで検索結果を確認
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('鈴木一郎')).toBeInTheDocument();
    expect(within(dialog).queryByText('高橋美咲')).not.toBeInTheDocument();
  });

  it('should handle auto assignment', () => {
    render(<SeatAssignment {...mockProps} />);

    const autoAssignButton = screen.getByRole('button', { name: /自動割り当て/i });
    fireEvent.click(autoAssignButton);

    // 確認ダイアログが表示される
    expect(screen.getByText('自動割り当てを実行しますか？')).toBeInTheDocument();
    expect(screen.getByText('未割り当ての学生を空席に自動で割り当てます。')).toBeInTheDocument();

    // 実行確認
    const confirmButton = screen.getByRole('button', { name: /実行/i });
    fireEvent.click(confirmButton);

    expect(mockProps.onAutoAssign).toHaveBeenCalled();
  });

  it('should handle bulk assignment', () => {
    render(<SeatAssignment {...mockProps} />);

    const bulkAssignButton = screen.getByRole('button', { name: /一括割り当て/i });
    fireEvent.click(bulkAssignButton);

    // 一括割り当てダイアログが表示される
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // CSVアップロードエリア
    expect(screen.getByText('CSVファイルをアップロード')).toBeInTheDocument();
    expect(screen.getByText('座席番号,学生ID,学生名の形式でアップロードしてください')).toBeInTheDocument();
  });

  it('should handle CSV file upload for bulk assignment', async () => {
    render(<SeatAssignment {...mockProps} />);

    const bulkAssignButton = screen.getByRole('button', { name: /一括割り当て/i });
    fireEvent.click(bulkAssignButton);

    // CSVファイルをアップロード（モック）
    const fileInput = screen.getByLabelText('CSVファイル選択');
    const csvContent = 'A-01,student-3,鈴木一郎\nA-02,student-4,高橋美咲';
    const file = new File([csvContent], 'assignments.csv', { type: 'text/csv' });

    // FileReaderをモック
    const mockFileReader = {
      readAsText: jest.fn(),
      onload: null as any,
      result: csvContent
    };

    global.FileReader = jest.fn(() => mockFileReader) as any;

    fireEvent.change(fileInput, { target: { files: [file] } });

    // アップロード実行
    const uploadButton = screen.getByRole('button', { name: /アップロード/i });
    fireEvent.click(uploadButton);

    // FileReaderのonloadを手動で呼び出し
    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: csvContent } } as any);
    }

    expect(mockProps.onBulkAssign).toHaveBeenCalledWith([
      { seatNumber: 'A-01', studentId: 'student-3', studentName: '鈴木一郎' },
      { seatNumber: 'A-02', studentId: 'student-4', studentName: '高橋美咲' },
    ]);
  });

  it('should handle assignment export', () => {
    render(<SeatAssignment {...mockProps} />);

    const exportButton = screen.getByRole('button', { name: /エクスポート/i });
    fireEvent.click(exportButton);

    expect(mockProps.onExportAssignment).toHaveBeenCalled();
  });

  it('should show assignment statistics', () => {
    render(<SeatAssignment {...mockProps} />);

    expect(screen.getByText('割り当て統計')).toBeInTheDocument();
    expect(screen.getByText('総座席数: 3')).toBeInTheDocument();
    expect(screen.getByText('割り当て済み: 2')).toBeInTheDocument();
    expect(screen.getByText('空席: 1')).toBeInTheDocument();
    expect(screen.getByText('割り当て率: 66.7%')).toBeInTheDocument();
  });

  it('should display seat status indicators', () => {
    render(<SeatAssignment {...mockProps} />);

    const availableSeat = screen.getByTestId('seat-assignment-seat-a01');
    expect(availableSeat).toHaveClass('available');

    const occupiedSeat = screen.getByTestId('seat-assignment-seat-a02');
    expect(occupiedSeat).toHaveClass('occupied');

    const helpRequestedSeat = screen.getByTestId('seat-assignment-seat-a03');
    expect(helpRequestedSeat).toHaveClass('help-requested');
  });

  it('should handle seat drag and drop assignment', () => {
    render(<SeatAssignment {...mockProps} />);

    // 学生をドラッグして座席にドロップ
    const studentList = screen.getByRole('list', { name: '未割り当て学生' });
    const student = within(studentList).getByText('鈴木一郎');
    fireEvent.dragStart(student, {
      dataTransfer: {
        setData: jest.fn(),
        getData: jest.fn(() => 'student-3'),
      },
    });

    // 座席にドロップ
    const seat = screen.getByTestId('seat-assignment-seat-a01');
    fireEvent.drop(seat, {
      dataTransfer: {
        getData: jest.fn(() => 'student-3'),
      },
    });

    expect(mockProps.onSeatAssign).toHaveBeenCalledWith('seat-a01', 'student-3');
  });

  it('should have proper ARIA attributes', () => {
    render(<SeatAssignment {...mockProps} />);

    expect(screen.getByRole('region', { name: '座席割り当て' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '座席一覧' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '未割り当て学生' })).toBeInTheDocument();

    const seatItems = screen.getAllByRole('listitem');
    expect(seatItems.length).toBeGreaterThan(0);
  });

  it('should support keyboard navigation', async () => {
    render(<SeatAssignment {...mockProps} />);

    const firstSeat = screen.getByTestId('seat-assignment-seat-a01');
    firstSeat.focus();

    // Enterキーで座席選択
    fireEvent.keyDown(firstSeat, { key: 'Enter' });
    expect(screen.getByText('学生を選択')).toBeInTheDocument();

    // ダイアログのキャンセルボタンで閉じる
    const dialog = screen.getByRole('dialog');
    const cancelButton = within(dialog).getByRole('button', { name: /キャンセル/i });
    fireEvent.click(cancelButton);

    // ダイアログが閉じるまで待機
    await waitFor(() => {
      expect(screen.queryByText('学生を選択')).not.toBeInTheDocument();
    });
  });

  it('should handle assignment validation errors', () => {
    const propsWithError = {
      ...mockProps,
      error: '座席割り当てに失敗しました',
    };

    render(<SeatAssignment {...propsWithError} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('座席割り当てに失敗しました')).toBeInTheDocument();
  });

  it('should handle loading states', () => {
    const propsWithLoading = {
      ...mockProps,
      isLoading: true,
    };

    render(<SeatAssignment {...propsWithLoading} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('座席割り当てを処理中...')).toBeInTheDocument();
  });
});
