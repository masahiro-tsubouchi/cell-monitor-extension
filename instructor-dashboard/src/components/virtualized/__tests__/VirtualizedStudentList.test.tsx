/**
 * VirtualizedStudentList Integration Test
 * 新しいEnhancedStudentListHeaderとの統合テスト
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VirtualizedStudentList } from '../VirtualizedStudentList';
import { StudentActivity } from '../../../services/dashboardAPI';

// モックデータ
const mockStudents: StudentActivity[] = [
  {
    emailAddress: 'student1@example.com',
    userName: 'テスト学生1',
    currentNotebook: 'notebook1.ipynb',
    lastActivity: '今',
    cellExecutions: 15,
    errorCount: 2,
    status: 'active',
    isRequestingHelp: true,
    teamName: 'チームA'
  },
  {
    emailAddress: 'student2@example.com',
    userName: 'テスト学生2',
    currentNotebook: 'notebook2.ipynb',
    lastActivity: '5分前',
    cellExecutions: 8,
    errorCount: 0,
    status: 'active',
    isRequestingHelp: false,
    teamName: 'チームB'
  },
  {
    emailAddress: 'student3@example.com',
    userName: 'テスト学生3',
    currentNotebook: 'notebook3.ipynb',
    lastActivity: '2時間前',
    cellExecutions: 3,
    errorCount: 5,
    status: 'inactive',
    isRequestingHelp: false,
    teamName: 'チームA'
  }
];

describe('VirtualizedStudentList', () => {
  it('新しいヘッダーが表示されること', () => {
    render(<VirtualizedStudentList students={mockStudents} />);
    
    // メインタイトルの確認（絵文字込み）
    expect(screen.getByText(/学習指導サポート/)).toBeInTheDocument();
    
    // サブタイトルの確認
    expect(screen.getByText('リアルタイム学習活動監視・個別指導支援システム')).toBeInTheDocument();
  });

  it('緊急対応アラートが表示されること', () => {
    render(<VirtualizedStudentList students={mockStudents} />);
    
    // ヘルプ要請学生がいる場合の緊急アラート
    expect(screen.getByText(/緊急対応が必要です/)).toBeInTheDocument();
  });

  it('4段階ステータスグリッドが表示されること', () => {
    render(<VirtualizedStudentList students={mockStudents} />);
    
    // ステータスカテゴリーの確認
    expect(screen.getByText('緊急対応')).toBeInTheDocument();
    expect(screen.getByText('要注意')).toBeInTheDocument();
    expect(screen.getByText('順調')).toBeInTheDocument();
    expect(screen.getByText('クラス活動度')).toBeInTheDocument();
  });

  it('学生リストコンテナが表示されること', () => {
    render(<VirtualizedStudentList students={mockStudents} />);
    
    // react-windowのリストコンテナが存在することを確認
    const listContainer = document.querySelector('[style*="overflow"]');
    expect(listContainer).toBeInTheDocument();
  });

  it('空のデータでも正常に表示されること', () => {
    render(<VirtualizedStudentList students={[]} />);
    
    // 空状態のメッセージ確認
    expect(screen.getByText('📭 表示する学生がいません')).toBeInTheDocument();
    expect(screen.getByText('フィルターを調整するか、学生データを確認してください')).toBeInTheDocument();
  });

  it('showControlsがfalseの場合にヘッダーが非表示になること', () => {
    render(<VirtualizedStudentList students={mockStudents} showControls={false} />);
    
    // ヘッダーが表示されないことを確認
    expect(screen.queryByText('学習指導サポート')).not.toBeInTheDocument();
  });
});