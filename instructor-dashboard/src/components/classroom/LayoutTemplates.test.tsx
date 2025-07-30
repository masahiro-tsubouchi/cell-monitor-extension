import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LayoutTemplates } from './LayoutTemplates';
import { LayoutTemplate, LayoutConfig, SeatStatus } from '../../types/api';

// モックデータ
const mockTemplates: LayoutTemplate[] = [
  {
    id: 'template-1',
    name: '標準レイアウト',
    description: '一般的な授業向けの座席配置',
    layout: {
      id: 'layout-1',
      name: '標準レイアウト',
      width: 800,
      height: 600,
      maxSeats: 50,
      gridSize: 20,
      zones: [],
    },
    seats: [
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
        status: SeatStatus.AVAILABLE,
        studentId: null,
        studentName: null,
      },
    ],
    previewImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  },
  {
    id: 'template-2',
    name: 'グループワーク',
    description: 'グループ学習向けの座席配置',
    layout: {
      id: 'layout-2',
      name: 'グループワーク',
      width: 800,
      height: 600,
      maxSeats: 30,
      gridSize: 20,
      zones: [],
    },
    seats: [
      {
        id: 'seat-g101',
        seatNumber: 'G1-01',
        position: { x: 150, y: 150 },
        status: SeatStatus.AVAILABLE,
        studentId: null,
        studentName: null,
      },
    ],
    previewImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  },
];

const mockProps = {
  templates: mockTemplates,
  selectedTemplate: null as LayoutTemplate | null,
  onTemplateSelect: jest.fn(),
  onTemplateCreate: jest.fn(),
  onTemplateUpdate: jest.fn(),
  onTemplateDelete: jest.fn(),
  onTemplatePreview: jest.fn(),
};

describe('LayoutTemplates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', () => {
    render(<LayoutTemplates {...mockProps} />);
    expect(screen.getByText('レイアウトテンプレート')).toBeInTheDocument();
  });

  it('should display all templates', () => {
    render(<LayoutTemplates {...mockProps} />);

    expect(screen.getByText('標準レイアウト')).toBeInTheDocument();
    expect(screen.getByText('一般的な授業向けの座席配置')).toBeInTheDocument();
    expect(screen.getByText('グループワーク')).toBeInTheDocument();
    expect(screen.getByText('グループ学習向けの座席配置')).toBeInTheDocument();
  });

  it('should show template preview images', () => {
    render(<LayoutTemplates {...mockProps} />);

    const previewImages = screen.getAllByRole('img');
    expect(previewImages).toHaveLength(2);
    expect(previewImages[0]).toHaveAttribute('alt', '標準レイアウト プレビュー');
    expect(previewImages[1]).toHaveAttribute('alt', 'グループワーク プレビュー');
  });

  it('should handle template selection', () => {
    render(<LayoutTemplates {...mockProps} />);

    const selectButton = screen.getAllByRole('button', { name: /選択/i })[0];
    fireEvent.click(selectButton);

    expect(mockProps.onTemplateSelect).toHaveBeenCalledWith(mockTemplates[0]);
  });

  it('should show template preview dialog', () => {
    render(<LayoutTemplates {...mockProps} />);

    const previewButton = screen.getAllByRole('button', { name: /プレビュー/i })[0];
    fireEvent.click(previewButton);

    expect(mockProps.onTemplatePreview).toHaveBeenCalledWith(mockTemplates[0]);
  });

  it('should show create template dialog', () => {
    render(<LayoutTemplates {...mockProps} />);

    const createButton = screen.getByRole('button', { name: /新規作成/i });
    fireEvent.click(createButton);

    expect(screen.getByText('新しいテンプレートを作成')).toBeInTheDocument();
    expect(screen.getByLabelText('テンプレート名')).toBeInTheDocument();
    expect(screen.getByLabelText('説明')).toBeInTheDocument();
  });

  it('should create new template', () => {
    render(<LayoutTemplates {...mockProps} />);

    // 新規作成ダイアログを開く
    const createButton = screen.getByRole('button', { name: /新規作成/i });
    fireEvent.click(createButton);

    // テンプレート情報を入力
    fireEvent.change(screen.getByLabelText('テンプレート名'), { target: { value: 'カスタムレイアウト' } });
    fireEvent.change(screen.getByLabelText('説明'), { target: { value: 'カスタム座席配置' } });

    // 作成実行
    const confirmButton = screen.getByRole('button', { name: /作成/i });
    fireEvent.click(confirmButton);

    expect(mockProps.onTemplateCreate).toHaveBeenCalledWith({
      name: 'カスタムレイアウト',
      description: 'カスタム座席配置',
    });
  });

  it('should show edit template dialog', () => {
    render(<LayoutTemplates {...mockProps} />);

    const editButton = screen.getAllByRole('button', { name: /編集/i })[0];
    fireEvent.click(editButton);

    expect(screen.getByText('テンプレートを編集')).toBeInTheDocument();
    expect(screen.getByDisplayValue('標準レイアウト')).toBeInTheDocument();
    expect(screen.getByDisplayValue('一般的な授業向けの座席配置')).toBeInTheDocument();
  });

  it('should update template', () => {
    render(<LayoutTemplates {...mockProps} />);

    // 編集ダイアログを開く
    const editButton = screen.getAllByRole('button', { name: /編集/i })[0];
    fireEvent.click(editButton);

    // テンプレート情報を変更
    const nameInput = screen.getByDisplayValue('標準レイアウト');
    fireEvent.change(nameInput, { target: { value: '更新されたレイアウト' } });

    // 更新実行
    const updateButton = screen.getByRole('button', { name: /更新/i });
    fireEvent.click(updateButton);

    expect(mockProps.onTemplateUpdate).toHaveBeenCalledWith(mockTemplates[0].id, {
      name: '更新されたレイアウト',
      description: '一般的な授業向けの座席配置',
    });
  });

  it('should show delete confirmation dialog', () => {
    render(<LayoutTemplates {...mockProps} />);

    const deleteButton = screen.getAllByRole('button', { name: /削除/i })[0];
    fireEvent.click(deleteButton);

    expect(screen.getByText('テンプレートを削除しますか？')).toBeInTheDocument();
    expect(screen.getByText('この操作は取り消せません。')).toBeInTheDocument();
  });

  it('should delete template', () => {
    render(<LayoutTemplates {...mockProps} />);

    // 削除確認ダイアログを開く
    const deleteButton = screen.getAllByRole('button', { name: /削除/i })[0];
    fireEvent.click(deleteButton);

    // 削除実行
    const confirmButton = screen.getByRole('button', { name: /削除する/i });
    fireEvent.click(confirmButton);

    expect(mockProps.onTemplateDelete).toHaveBeenCalledWith(mockTemplates[0].id);
  });

  it('should filter templates by search query', () => {
    render(<LayoutTemplates {...mockProps} />);

    const searchInput = screen.getByLabelText('テンプレート検索');
    fireEvent.change(searchInput, { target: { value: 'グループ' } });

    expect(screen.getByText('グループワーク')).toBeInTheDocument();
    expect(screen.queryByText('標準レイアウト')).not.toBeInTheDocument();
  });

  it('should show empty state when no templates match search', () => {
    render(<LayoutTemplates {...mockProps} />);

    const searchInput = screen.getByLabelText('テンプレート検索');
    fireEvent.change(searchInput, { target: { value: '存在しないテンプレート' } });

    expect(screen.getByText('該当するテンプレートが見つかりません')).toBeInTheDocument();
  });

  it('should show empty state when no templates available', () => {
    render(<LayoutTemplates {...mockProps} templates={[]} />);

    expect(screen.getByText('テンプレートがありません')).toBeInTheDocument();
    expect(screen.getByText('新しいテンプレートを作成してください')).toBeInTheDocument();
  });

  it('should highlight selected template', () => {
    render(<LayoutTemplates {...mockProps} selectedTemplate={mockTemplates[0]} />);

    const selectedCard = screen.getByTestId(`template-card-${mockTemplates[0].id}`);
    expect(selectedCard).toHaveClass('selected');
  });

  it('should have proper ARIA attributes', () => {
    render(<LayoutTemplates {...mockProps} />);

    expect(screen.getByRole('region', { name: 'レイアウトテンプレート' })).toBeInTheDocument();
    expect(screen.getByLabelText('テンプレート検索')).toBeInTheDocument();

    const templateCards = screen.getAllByRole('article');
    expect(templateCards).toHaveLength(2);

    templateCards.forEach((card, index) => {
      expect(card).toHaveAttribute('aria-label', `テンプレート: ${mockTemplates[index].name}`);
    });
  });

  it('should support keyboard navigation', () => {
    render(<LayoutTemplates {...mockProps} />);

    const firstCard = screen.getByTestId(`template-card-${mockTemplates[0].id}`);
    firstCard.focus();

    // Enterキーで選択
    fireEvent.keyDown(firstCard, { key: 'Enter' });
    expect(mockProps.onTemplateSelect).toHaveBeenCalledWith(mockTemplates[0]);

    // Spaceキーでプレビュー
    fireEvent.keyDown(firstCard, { key: ' ' });
    expect(mockProps.onTemplatePreview).toHaveBeenCalledWith(mockTemplates[0]);
  });

  it('should handle template loading states', () => {
    render(<LayoutTemplates {...mockProps} isLoading={true} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('テンプレートを読み込み中...')).toBeInTheDocument();
  });

  it('should handle template operation errors', () => {
    const errorMessage = 'テンプレートの読み込みに失敗しました';
    render(<LayoutTemplates {...mockProps} error={errorMessage} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
});
