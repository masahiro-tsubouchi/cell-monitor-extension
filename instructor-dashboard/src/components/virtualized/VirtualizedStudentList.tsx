/**
 * Virtualized Student List Component
 * react-window による仮想スクロール実装
 */

import React, { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { Box, Typography, TextField, InputAdornment, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { Search as SearchIcon, Sort as SortIcon } from '@mui/icons-material';
import { StudentActivity } from '../../services/dashboardAPI';
import { useOptimizedStudentList, StudentFilter } from '../../hooks/useOptimizedStudentList';
import { OptimizedStudentCard } from '../enhanced/StudentDisplay/OptimizedStudentCard';

interface VirtualizedStudentListProps {
  students: StudentActivity[];
  onStudentClick?: (student: StudentActivity) => void;
  height?: number;
  itemHeight?: number;
  showControls?: boolean;
}

// 仮想リスト行コンポーネント
const StudentRow: React.FC<ListChildComponentProps> = memo(({ index, style, data }) => {
  const { students, onStudentClick } = data;
  const studentData = students[index];

  if (!studentData) {
    return (
      <div style={style}>
        <Box sx={{ p: 1, opacity: 0.5 }}>
          <Typography variant="body2">データを読み込み中...</Typography>
        </Box>
      </div>
    );
  }

  return (
    <div style={style}>
      <Box sx={{ p: 1 }}>
        <OptimizedStudentCard
          student={studentData.original}
          onClick={onStudentClick}
          compact={false}
        />
      </Box>
    </div>
  );
});

StudentRow.displayName = 'StudentRow';

/**
 * 仮想化学生リストコンポーネント
 * - 大量データ対応（1000+ 学生でもスムーズ）
 * - 動的フィルタリング・ソート
 * - メモ化による最適化
 */
export const VirtualizedStudentList: React.FC<VirtualizedStudentListProps> = memo(({
  students,
  onStudentClick,
  height = 600,
  itemHeight = 180,
  showControls = true
}) => {
  const [filters, setFilters] = useState<StudentFilter>({
    searchQuery: '',
    statusFilter: 'all',
    sortBy: 'activity',
    sortOrder: 'desc'
  });

  // 検索入力のデバウンス
  const [searchInput, setSearchInput] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, searchQuery: searchInput }));
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchInput]);

  // 最適化されたデータ
  const { students: optimizedStudents, statistics } = useOptimizedStudentList(students, filters);

  // リストアイテムデータ（メモ化）
  const listItemData = useMemo(() => ({
    students: optimizedStudents,
    onStudentClick
  }), [optimizedStudents, onStudentClick]);

  // 可視アイテム数計算
  const visibleCount = Math.min(Math.ceil(height / itemHeight), optimizedStudents.length);

  const handleStatusFilterChange = useCallback((
    event: React.MouseEvent<HTMLElement>,
    newStatus: string | null
  ) => {
    if (newStatus !== null) {
      setFilters(prev => ({ ...prev, statusFilter: newStatus as any }));
    }
  }, []);

  const handleSortChange = useCallback((
    event: React.MouseEvent<HTMLElement>,
    newSort: string | null
  ) => {
    if (newSort !== null) {
      const [sortBy, sortOrder] = newSort.split('-');
      setFilters(prev => ({ 
        ...prev, 
        sortBy: sortBy as any,
        sortOrder: sortOrder as 'asc' | 'desc'
      }));
    }
  }, []);

  return (
    <Box>
      {/* コントロールパネル */}
      {showControls && (
        <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 検索ボックス */}
          <TextField
            placeholder="学生名、メール、チーム名で検索..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
            size="small"
            fullWidth
          />

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* ステータスフィルター */}
            <ToggleButtonGroup
              value={filters.statusFilter}
              exclusive
              onChange={handleStatusFilterChange}
              size="small"
            >
              <ToggleButton value="all">全て</ToggleButton>
              <ToggleButton value="active">アクティブ</ToggleButton>
              <ToggleButton value="help">ヘルプ要請</ToggleButton>
              <ToggleButton value="inactive">非アクティブ</ToggleButton>
            </ToggleButtonGroup>

            {/* ソート */}
            <ToggleButtonGroup
              value={`${filters.sortBy}-${filters.sortOrder}`}
              exclusive
              onChange={handleSortChange}
              size="small"
            >
              <ToggleButton value="activity-desc">
                <SortIcon sx={{ mr: 0.5 }} />
                活動度 ↓
              </ToggleButton>
              <ToggleButton value="name-asc">
                名前 ↑
              </ToggleButton>
              <ToggleButton value="executions-desc">
                実行回数 ↓
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* 統計情報 */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary">
              {statistics.displayed}/{statistics.total} 名表示
            </Typography>
            <Typography variant="caption" color="error">
              🆘 ヘルプ要請: {statistics.helpRequesting} 名
            </Typography>
            <Typography variant="caption" color="warning.main">
              ⚠️ 高優先度: {statistics.highPriority} 名
            </Typography>
            <Typography variant="caption" color="info.main">
              📊 平均活動度: {Math.round(statistics.averageActivityScore)}/100
            </Typography>
          </Box>
        </Box>
      )}

      {/* 仮想リスト */}
      <Box sx={{ 
        border: '1px solid #e0e0e0', 
        borderRadius: 1, 
        overflow: 'hidden',
        backgroundColor: '#fafafa'
      }}>
        {optimizedStudents.length > 0 ? (
          <List
            height={height}
            itemCount={optimizedStudents.length}
            itemSize={itemHeight}
            itemData={listItemData}
            overscanCount={2} // パフォーマンス最適化: 見える範囲外の要素を事前レンダリング
          >
            {StudentRow}
          </List>
        ) : (
          <Box sx={{ 
            height, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 1
          }}>
            <Typography variant="h6" color="text.secondary">
              📭 表示する学生がいません
            </Typography>
            <Typography variant="body2" color="text.secondary">
              フィルターを調整するか、学生データを確認してください
            </Typography>
          </Box>
        )}
      </Box>

      {/* デバッグ情報（開発時のみ） */}
      {process.env.NODE_ENV === 'development' && (
        <Box sx={{ mt: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
            🔧 Debug: {optimizedStudents.length} items rendered, {visibleCount} visible, itemHeight={itemHeight}px
          </Typography>
        </Box>
      )}
    </Box>
  );
});

VirtualizedStudentList.displayName = 'VirtualizedStudentList';

export default VirtualizedStudentList;