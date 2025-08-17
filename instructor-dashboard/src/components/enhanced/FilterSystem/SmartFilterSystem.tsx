/**
 * Smart Filter System Component
 * Phase 2.1: 統合スマートフィルタリング
 * 
 * 機能:
 * - ワンクリックフィルターで瞬時に条件絞り込み
 * - よく使う組み合わせをプリセットとして保存
 * - リアルタイム件数表示で結果を予測しながら操作
 */

import React, { memo, useState, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Collapse,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Tooltip,
  Divider,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Save as SaveIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Help as HelpIcon,
  Error as ErrorIcon,
  TrendingUp as ActiveIcon,
  Group as TeamIcon,
  Schedule as TimeIcon,
  Star as FavoriteIcon
} from '@mui/icons-material';
import { StudentActivity } from '../../../services/dashboardAPI';

export interface FilterState {
  status: string[];
  teams: string[];
  activityRange: [number, number];
  timeRange: string;
  searchText: string;
  hasErrors: boolean;
  isActive: boolean;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
  isFavorite: boolean;
  createdAt: Date;
}

interface SmartFilterSystemProps {
  students: StudentActivity[];
  onFilterChange: (filteredStudents: StudentActivity[]) => void;
  onFilterStateChange?: (filters: FilterState) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const DEFAULT_FILTERS: FilterState = {
  status: [],
  teams: [],
  activityRange: [0, 100],
  timeRange: 'all',
  searchText: '',
  hasErrors: false,
  isActive: false
};

// クイックフィルタープリセット
const QUICK_FILTERS = [
  {
    id: 'help',
    label: '🆘 ヘルプ',
    icon: <HelpIcon />,
    color: '#ff5722',
    filters: { status: ['help'] }
  },
  {
    id: 'error',
    label: '❌ エラー',
    icon: <ErrorIcon />,
    color: '#ff9800',
    filters: { status: ['error'] }
  },
  {
    id: 'active',
    label: '⚡ アクティブ',
    icon: <ActiveIcon />,
    color: '#4caf50',
    filters: { status: ['active'] }
  },
  {
    id: 'inactive',
    label: '😴 非アクティブ',
    icon: <ActiveIcon />,
    color: '#9e9e9e',
    filters: { status: ['inactive'] }
  }
];

const TIME_PRESETS = [
  { value: 'all', label: '全期間' },
  { value: '1h', label: '1時間以内' },
  { value: '6h', label: '6時間以内' },
  { value: '24h', label: '24時間以内' },
  { value: '1w', label: '1週間以内' }
];

export const SmartFilterSystem: React.FC<SmartFilterSystemProps> = memo(({
  students,
  onFilterChange,
  onFilterStateChange,
  isOpen,
  onToggle
}) => {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState('');

  // 利用可能なチーム一覧を取得
  const availableTeams = useMemo(() => {
    return Array.from(new Set(students.map(s => s.teamName).filter(Boolean)));
  }, [students]);

  // フィルタリング処理
  const filteredStudents = useMemo(() => {
    // フィルターが何も適用されていない場合は元のデータを返す
    const hasActiveFilters = 
      filters.status.length > 0 ||
      filters.teams.length > 0 ||
      filters.activityRange[0] > 0 || filters.activityRange[1] < 100 ||
      filters.searchText.trim() !== '' ||
      filters.hasErrors ||
      filters.isActive;

    if (!hasActiveFilters) {
      return students;
    }

    let result = [...students];

    // ステータスフィルター
    if (filters.status.length > 0) {
      result = result.filter(s => filters.status.includes(s.status));
    }

    // チームフィルター
    if (filters.teams.length > 0) {
      result = result.filter(s => s.teamName && filters.teams.includes(s.teamName));
    }

    // 活動度フィルター
    if (filters.activityRange[0] > 0 || filters.activityRange[1] < 100) {
      result = result.filter(s => {
        const activity = s.cellExecutions || 0;
        const activityPercent = Math.min(activity * 10, 100); // セル実行数を%に変換
        return activityPercent >= filters.activityRange[0] && activityPercent <= filters.activityRange[1];
      });
    }

    // 検索テキストフィルター
    if (filters.searchText.trim()) {
      const searchLower = filters.searchText.toLowerCase();
      result = result.filter(s =>
        s.userName.toLowerCase().includes(searchLower) ||
        s.emailAddress.toLowerCase().includes(searchLower) ||
        (s.teamName && s.teamName.toLowerCase().includes(searchLower))
      );
    }

    // エラーフィルター
    if (filters.hasErrors) {
      result = result.filter(s => s.status === 'error');
    }

    // アクティブフィルター
    if (filters.isActive) {
      result = result.filter(s => s.status === 'active');
    }

    return result;
  }, [students, filters]);

  // フィルター変更の通知
  React.useEffect(() => {
    onFilterChange(filteredStudents);
    onFilterStateChange?.(filters);
  }, [filteredStudents, filters, onFilterChange, onFilterStateChange]);

  // クイックフィルターの適用
  const handleQuickFilter = useCallback((quickFilter: typeof QUICK_FILTERS[0]) => {
    const newFilters = {
      ...filters,
      ...quickFilter.filters
    };
    setFilters(newFilters);
  }, [filters]);

  // フィルターのクリア
  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  // プリセットの保存
  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) return;

    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      filters: { ...filters },
      isFavorite: false,
      createdAt: new Date()
    };

    setSavedPresets(prev => [...prev, newPreset]);
    setPresetName('');
  }, [presetName, filters]);

  // プリセットの適用
  const handleApplyPreset = useCallback((preset: FilterPreset) => {
    setFilters(preset.filters);
  }, []);

  // プリセットの削除
  const handleDeletePreset = useCallback((presetId: string) => {
    setSavedPresets(prev => prev.filter(p => p.id !== presetId));
  }, []);

  return (
    <Paper 
      elevation={isOpen ? 3 : 1} 
      sx={{ 
        mb: 3,
        transition: 'all 0.3s ease-in-out',
        border: isOpen ? '2px solid #2196f3' : '1px solid transparent'
      }}
    >
      {/* フィルターヘッダー */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        p: 2,
        backgroundColor: isOpen ? '#f5f5f5' : 'transparent',
        cursor: 'pointer'
      }} onClick={onToggle}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FilterIcon color={isOpen ? 'primary' : 'action'} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            🔍 スマートフィルター
          </Typography>
          <Chip 
            label={`${filteredStudents.length}/${students.length}名`}
            size="small"
            color={filteredStudents.length < students.length ? 'primary' : 'default'}
            sx={{ fontWeight: 'bold' }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {Object.values(filters).some(f => Array.isArray(f) ? f.length > 0 : f !== DEFAULT_FILTERS[f as keyof FilterState]) && (
            <Tooltip title="フィルタークリア">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleClearFilters(); }}>
                <ClearIcon />
              </IconButton>
            </Tooltip>
          )}
          <IconButton size="small">
            {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* フィルター内容 */}
      <Collapse in={isOpen}>
        <Box sx={{ p: 3, pt: 1 }}>
          {/* クイックフィルター */}
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', color: 'text.secondary' }}>
            ⚡ クイックフィルター
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
            {QUICK_FILTERS.map((quickFilter) => {
              const count = students.filter(s => {
                if (quickFilter.filters.status) {
                  return quickFilter.filters.status.includes(s.status);
                }
                return false;
              }).length;

              return (
                <Chip
                  key={quickFilter.id}
                  icon={quickFilter.icon}
                  label={`${quickFilter.label} (${count})`}
                  onClick={() => handleQuickFilter(quickFilter)}
                  sx={{
                    backgroundColor: filters.status.some(s => quickFilter.filters.status?.includes(s))
                      ? quickFilter.color
                      : 'transparent',
                    color: filters.status.some(s => quickFilter.filters.status?.includes(s))
                      ? 'white'
                      : quickFilter.color,
                    border: `1px solid ${quickFilter.color}`,
                    fontWeight: 'bold',
                    '&:hover': {
                      backgroundColor: quickFilter.color,
                      color: 'white'
                    }
                  }}
                />
              );
            })}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* 詳細フィルター */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
              🔧 詳細フィルター
            </Typography>
            <Button
              size="small"
              onClick={() => setShowAdvanced(!showAdvanced)}
              startIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            >
              {showAdvanced ? '簡易表示' : '詳細表示'}
            </Button>
          </Box>

          <Collapse in={showAdvanced}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
              {/* チーム選択 */}
              <FormControl fullWidth size="small">
                <InputLabel>チーム</InputLabel>
                <Select
                  multiple
                  value={filters.teams}
                  onChange={(e) => setFilters(prev => ({ ...prev, teams: e.target.value as string[] }))}
                  label="チーム"
                >
                  {availableTeams.map(team => (
                    <MenuItem key={team} value={team}>
                      <TeamIcon sx={{ mr: 1, fontSize: 16 }} />
                      {team}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* 時間範囲 */}
              <FormControl fullWidth size="small">
                <InputLabel>時間範囲</InputLabel>
                <Select
                  value={filters.timeRange}
                  onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value }))}
                  label="時間範囲"
                >
                  {TIME_PRESETS.map(preset => (
                    <MenuItem key={preset.value} value={preset.value}>
                      <TimeIcon sx={{ mr: 1, fontSize: 16 }} />
                      {preset.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* 検索テキスト */}
              <TextField
                fullWidth
                size="small"
                label="学生名・メール・チーム検索"
                value={filters.searchText}
                onChange={(e) => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
                placeholder="検索キーワード..."
              />

              {/* 活動度スライダー */}
              <Box>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  活動度: {filters.activityRange[0]}% - {filters.activityRange[1]}%
                </Typography>
                <Slider
                  value={filters.activityRange}
                  onChange={(_, value) => setFilters(prev => ({ ...prev, activityRange: value as [number, number] }))}
                  valueLabelDisplay="auto"
                  min={0}
                  max={100}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 50, label: '50%' },
                    { value: 100, label: '100%' }
                  ]}
                />
              </Box>
            </Box>

            {/* スイッチフィルター */}
            <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={filters.hasErrors}
                    onChange={(e) => setFilters(prev => ({ ...prev, hasErrors: e.target.checked }))}
                  />
                }
                label="エラー発生中のみ"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={filters.isActive}
                    onChange={(e) => setFilters(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                }
                label="アクティブのみ"
              />
            </Box>
          </Collapse>

          <Divider sx={{ my: 2 }} />

          {/* プリセット管理 */}
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', color: 'text.secondary' }}>
            💾 プリセット管理
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              size="small"
              label="プリセット名"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="よく使う組み合わせを保存..."
              sx={{ flexGrow: 1 }}
            />
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
            >
              保存
            </Button>
          </Box>

          {/* 保存済みプリセット */}
          {savedPresets.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {savedPresets.map(preset => (
                <Chip
                  key={preset.id}
                  icon={<FavoriteIcon />}
                  label={preset.name}
                  onClick={() => handleApplyPreset(preset)}
                  onDelete={() => handleDeletePreset(preset.id)}
                  sx={{ fontWeight: 'bold' }}
                />
              ))}
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
});

SmartFilterSystem.displayName = 'SmartFilterSystem';

export default SmartFilterSystem;