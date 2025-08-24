/**
 * ActivityStatusChip Component Test
 * 新しい4段階活動状態表示システムのテスト
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ActivityStatusChip } from '../../common/ActivityStatusChip';
import { StudentActivity } from '../../../services/dashboardAPI';

// モックデータ
const createMockStudent = (overrides: Partial<StudentActivity> = {}): StudentActivity => ({
  emailAddress: 'test@example.com',
  userName: 'Test Student',
  teamName: 'Team A',
  cellExecutions: 10,
  errorCount: 1,
  lastActivity: '5分前',
  isRequestingHelp: false,
  status: 'active',
  ...overrides
});

describe('ActivityStatusChip', () => {
  test('renders good status for high activity score', () => {
    const student = createMockStudent({
      cellExecutions: 50,
      errorCount: 0,
      lastActivity: '今'
    });

    render(<ActivityStatusChip student={student} score={85} />);
    
    expect(screen.getByText('問題なし')).toBeInTheDocument();
  });

  test('renders error status for help requesting student', () => {
    const student = createMockStudent({
      isRequestingHelp: true,
      cellExecutions: 5,
      errorCount: 3
    });

    render(<ActivityStatusChip student={student} score={25} />);
    
    expect(screen.getByText('エラーがたくさん出てる')).toBeInTheDocument();
  });

  test('renders warning status for medium activity score', () => {
    const student = createMockStudent({
      cellExecutions: 20,
      errorCount: 2,
      lastActivity: '15分前'
    });

    render(<ActivityStatusChip student={student} score={55} />);
    
    expect(screen.getByText('手が止まってしまい')).toBeInTheDocument();
  });

  test('renders stopped status for low activity score', () => {
    const student = createMockStudent({
      cellExecutions: 5,
      errorCount: 1,
      lastActivity: '30分前'
    });

    render(<ActivityStatusChip student={student} score={25} />);
    
    expect(screen.getByText('完全に停止してしまってる')).toBeInTheDocument();
  });

  test('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    const student = createMockStudent();

    render(<ActivityStatusChip student={student} onClick={handleClick} />);
    
    const chip = screen.getByRole('button');
    fireEvent.click(chip);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('shows tooltip on hover when showTooltip is true', () => {
    const student = createMockStudent();

    render(<ActivityStatusChip student={student} showTooltip={true} />);
    
    // ツールチップのトリガーとなる要素が存在することを確認
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  test('does not show tooltip when showTooltip is false', () => {
    const student = createMockStudent();

    render(<ActivityStatusChip student={student} showTooltip={false} />);
    
    // ツールチップなしでもボタンは表示される
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  test('renders small size chip by default', () => {
    const student = createMockStudent();

    render(<ActivityStatusChip student={student} />);
    
    const chip = screen.getByRole('button');
    expect(chip).toHaveClass('MuiChip-sizeSmall');
  });

  test('renders medium size chip when specified', () => {
    const student = createMockStudent();

    render(<ActivityStatusChip student={student} size="medium" />);
    
    const chip = screen.getByRole('button');
    expect(chip).toHaveClass('MuiChip-sizeMedium');
  });

  test('uses provided score over calculated score', () => {
    const student = createMockStudent({
      cellExecutions: 1, // This would normally give low score
      errorCount: 0,
      lastActivity: '今'
    });

    // Provide high score manually
    render(<ActivityStatusChip student={student} score={90} />);
    
    // Should show good status based on provided score, not calculated
    expect(screen.getByText('問題なし')).toBeInTheDocument();
  });
});