/**
 * Student Grid Component
 * Phase 2.3: 強化学生カード - グリッド表示
 * 
 * 機能:
 * - レスポンシブグリッドレイアウト
 * - 仮想スクロール対応（大量データ対応）
 * - ソート・フィルター機能統合
 */

import React, { memo, useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Sort as SortIcon,
  ViewModule as GridIcon,
  ViewComfy as CompactIcon,
  List as ListIcon
} from '@mui/icons-material';
// import { FixedSizeGrid } from 'react-window'; // 一時的に無効化
import { StudentActivity } from '../../../services/dashboardAPI';
import { OptimizedStudentCard } from './OptimizedStudentCard';

interface StudentGridProps {
  students: StudentActivity[];
  onStudentClick?: (student: StudentActivity) => void;
  onStudentAction?: (action: string, student: StudentActivity) => void;
  height?: number;
  enableVirtualization?: boolean;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (sortBy: string, direction: 'asc' | 'desc') => void;
  viewMode?: 'grid' | 'compact' | 'list';
  onViewModeChange?: (mode: 'grid' | 'compact' | 'list') => void;
}

type SortOption = {
  value: string;
  label: string;
  sortFn: (a: StudentActivity, b: StudentActivity) => number;
};

const SORT_OPTIONS: SortOption[] = [
  {
    value: 'priority',
    label: '緊急度順',
    sortFn: (a, b) => {
      const priority = { help: 1, error: 2, active: 3, inactive: 4 };
      return (priority[a.status as keyof typeof priority] || 5) - 
             (priority[b.status as keyof typeof priority] || 5);
    }
  },
  {
    value: 'activity',
    label: '活動度順',
    sortFn: (a, b) => (b.cellExecutions || 0) - (a.cellExecutions || 0)
  },
  {
    value: 'name',
    label: '名前順',
    sortFn: (a, b) => a.userName.localeCompare(b.userName)
  },
  {
    value: 'team',
    label: 'チーム順',
    sortFn: (a, b) => (a.teamName || '').localeCompare(b.teamName || '')
  },
  {
    value: 'lastActivity',
    label: '最終活動順',
    sortFn: (a, b) => {
      const aTime = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const bTime = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      return bTime - aTime;
    }
  }
];

// グリッドアイテムコンポーネント
interface GridItemProps {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
  data: {
    students: StudentActivity[];
    columnsPerRow: number;
    onStudentClick?: (student: StudentActivity) => void;
    onStudentAction?: (action: string, student: StudentActivity) => void;
    viewMode: 'grid' | 'compact' | 'list';
  };
}

const GridItem: React.FC<GridItemProps> = memo(({ columnIndex, rowIndex, style, data }) => {
  const { students, columnsPerRow, onStudentClick, onStudentAction, viewMode } = data;
  const studentIndex = rowIndex * columnsPerRow + columnIndex;
  const student = students[studentIndex];

  if (!student) {
    return <div style={style} />;
  }

  return (
    <div style={{ ...style, padding: 8 }}>
      <OptimizedStudentCard
        student={student}
        onClick={onStudentClick}
        onAction={onStudentAction}
        compact={viewMode === 'compact'}
        showQuickActions={viewMode !== 'list'}
        animateStatus={true}
      />
    </div>
  );
});

GridItem.displayName = 'GridItem';

export const StudentGrid: React.FC<StudentGridProps> = memo(({
  students,
  onStudentClick,
  onStudentAction,
  height = 600,
  enableVirtualization = true,
  sortBy = 'priority',
  sortDirection = 'asc',
  onSortChange,
  viewMode = 'grid',
  onViewModeChange
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));

  // ソート処理
  const sortedStudents = useMemo(() => {
    const sortOption = SORT_OPTIONS.find(option => option.value === sortBy);
    if (!sortOption) return students;

    const sorted = [...students].sort(sortOption.sortFn);
    return sortDirection === 'desc' ? sorted.reverse() : sorted;
  }, [students, sortBy, sortDirection]);

  // グリッドのカラム数を計算
  const getColumnsPerRow = useCallback(() => {
    if (viewMode === 'list') return 1;
    if (viewMode === 'compact') {
      if (isMobile) return 1;
      if (isTablet) return 2;
      return 3;
    }
    // grid mode
    if (isMobile) return 1;
    if (isTablet) return 2;
    return 3;
  }, [viewMode, isMobile, isTablet]);

  const columnsPerRow = getColumnsPerRow();
  const rowCount = Math.ceil(sortedStudents.length / columnsPerRow);

  // カードのサイズを計算
  const getCardDimensions = () => {
    const baseWidth = viewMode === 'list' ? '100%' : 
                     viewMode === 'compact' ? 280 : 320;
    const baseHeight = viewMode === 'list' ? 120 :
                      viewMode === 'compact' ? 180 : 240;
    
    return {
      width: typeof baseWidth === 'number' ? 
        Math.min(baseWidth, window.innerWidth / columnsPerRow - 16) : 
        baseWidth,
      height: isMobile ? baseHeight * 0.8 : baseHeight
    };
  };

  const cardDimensions = getCardDimensions();

  // ソート変更ハンドラー
  const handleSortChange = (newSortBy: string) => {
    const newDirection = newSortBy === sortBy && sortDirection === 'asc' ? 'desc' : 'asc';
    onSortChange?.(newSortBy, newDirection);
  };

  // 仮想スクロールが無効の場合のレンダリング
  const renderStaticGrid = () => (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: viewMode === 'list' ? '1fr' :
          `repeat(${columnsPerRow}, 1fr)`,
        gap: 2,
        padding: 1
      }}
    >
      {sortedStudents.map((student) => (
        <OptimizedStudentCard
          key={student.emailAddress}
          student={student}
          onClick={onStudentClick}
          onAction={onStudentAction}
          compact={viewMode === 'compact'}
          showQuickActions={viewMode !== 'list'}
          animateStatus={true}
        />
      ))}
    </Box>
  );

  return (
    <Box>
      {/* コントロール */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 2,
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          👥 学生一覧 ({sortedStudents.length}名)
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* ソート選択 */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>ソート</InputLabel>
            <Select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              label="ソート"
              startAdornment={<SortIcon sx={{ mr: 1 }} />}
            >
              {SORT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                  {sortBy === option.value && (
                    <Typography variant="caption" sx={{ ml: 1 }}>
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </Typography>
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 表示モード切り替え */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, mode) => mode && onViewModeChange?.(mode)}
            size="small"
          >
            <ToggleButton value="grid">
              <GridIcon />
            </ToggleButton>
            <ToggleButton value="compact">
              <CompactIcon />
            </ToggleButton>
            <ToggleButton value="list">
              <ListIcon />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* グリッド表示 - 一時的に仮想スクロール無効 */}
      {renderStaticGrid()}

      {/* 統計情報 */}
      {sortedStudents.length > 0 && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            📊 {SORT_OPTIONS.find(opt => opt.value === sortBy)?.label} | 
            {viewMode === 'grid' ? 'グリッド' : viewMode === 'compact' ? 'コンパクト' : 'リスト'}表示 | 
            Phase 2強化表示モード
          </Typography>
        </Box>
      )}
    </Box>
  );
});

StudentGrid.displayName = 'StudentGrid';

export default StudentGrid;