/**
 * 最適化チームグリッドコンポーネント
 * チーム単位での表示と優先度ベースソートを実装
 */

import React, { memo, useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  FormControlLabel,
  Switch,
  Paper,
  Alert,
  Collapse
} from '@mui/material';
import {
  PriorityHigh as PriorityIcon,
  Info as InfoIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon
} from '@mui/icons-material';
import { StudentActivity } from '../../services/dashboardAPI';
import { useOptimizedTeamList, TeamData } from '../../hooks/useOptimizedTeamList';
import { OptimizedTeamCard } from './OptimizedTeamCard';
import { useOptimizationSettings } from '../../config/optimizationConfig';

interface OptimizedTeamGridProps {
  students: StudentActivity[];
  onStudentClick?: (student: StudentActivity) => void;
  onExpandedTeamsChange?: (count: number) => void;
  maxTeamsToShow?: number;
}

// チーム統計表示コンポーネント
const TeamStatsPanel = memo<{
  stats: any;
  totalTeams: number;
  showingTeams: number;
}>(({ stats, totalTeams, showingTeams }) => (
  <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PriorityIcon color="primary" />
        チーム概要
      </Typography>
      
      <Chip
        label={`${showingTeams}/${totalTeams}チーム表示`}
        color="primary"
        variant="outlined"
      />
      
      <Chip
        label={`${stats.totalStudents}名`}
        color="default"
        variant="outlined"
      />
      
      <Chip
        label={`${stats.activeTeams}チーム活動中`}
        color="success"
        variant="outlined"
      />
      
      {stats.teamsNeedingHelp > 0 && (
        <Chip
          label={`${stats.teamsNeedingHelp}チームがヘルプ要請`}
          color="error"
          variant="outlined"
        />
      )}
    </Box>
  </Paper>
));

TeamStatsPanel.displayName = 'TeamStatsPanel';

// 優先度説明パネル
const PriorityExplanation = memo<{ isVisible: boolean }>(({ isVisible }) => (
  <Collapse in={isVisible}>
    <Alert severity="info" sx={{ mb: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        🎯 チーム優先度ソート基準
      </Typography>
      <Typography variant="body2">
        • ヘルプ要請中のチーム（最優先）<br/>
        • アクティブな学生数<br/>
        • 平均進捗率（低いほど高優先度）<br/>
        • 最近の活動状況<br/>
        • チームサイズ
      </Typography>
    </Alert>
  </Collapse>
));

PriorityExplanation.displayName = 'PriorityExplanation';

export const OptimizedTeamGrid = memo<OptimizedTeamGridProps>(({
  students,
  onStudentClick,
  onExpandedTeamsChange,
  maxTeamsToShow = 8
}) => {
  const { config } = useOptimizationSettings();
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [showPriorityInfo, setShowPriorityInfo] = useState(false);
  const [showAllTeams, setShowAllTeams] = useState(false);

  // 最適化されたチームリストを取得
  const optimizedTeamList = useOptimizedTeamList(students);

  // 表示するチームを決定
  const displayTeams = useMemo(() => {
    if (showAllTeams) {
      return optimizedTeamList.prioritizedTeams;
    }
    return optimizedTeamList.displayTeams;
  }, [optimizedTeamList, showAllTeams]);

  // 展開状態の変更を親に通知
  React.useEffect(() => {
    onExpandedTeamsChange?.(expandedTeams.size);
  }, [expandedTeams.size, onExpandedTeamsChange]);

  // チーム展開トグル
  const handleTeamToggle = useCallback((teamName: string) => {
    setExpandedTeams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamName)) {
        newSet.delete(teamName);
      } else {
        newSet.add(teamName);
      }
      return newSet;
    });
  }, []);

  // チームベースグリッドが無効な場合は従来表示
  if (!config.useTeamBasedGrid) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        チームベースグリッド機能は無効になっています。設定から有効にしてください。
      </Alert>
    );
  }

  // データが空の場合
  if (students.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="text.secondary">
          表示する学生データがありません
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* チーム統計パネル */}
      <TeamStatsPanel
        stats={optimizedTeamList.stats}
        totalTeams={optimizedTeamList.totalTeams}
        showingTeams={displayTeams.length}
      />

      {/* コントロールパネル */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <FormControlLabel
          control={
            <Switch
              checked={showPriorityInfo}
              onChange={(e) => setShowPriorityInfo(e.target.checked)}
              icon={<InfoIcon />}
              checkedIcon={<InfoIcon />}
            />
          }
          label="優先度説明を表示"
        />

        {optimizedTeamList.totalTeams > maxTeamsToShow && (
          <FormControlLabel
            control={
              <Switch
                checked={showAllTeams}
                onChange={(e) => setShowAllTeams(e.target.checked)}
                icon={<HideIcon />}
                checkedIcon={<ViewIcon />}
              />
            }
            label={`全${optimizedTeamList.totalTeams}チーム表示`}
          />
        )}
      </Box>

      {/* 優先度説明 */}
      <PriorityExplanation isVisible={showPriorityInfo} />

      {/* チームグリッド */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(1, 1fr)',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)'
          },
          gap: 3
        }}
      >
        {displayTeams.map((team) => (
          <OptimizedTeamCard
            key={team.teamName}
            teamData={team}
            isExpanded={expandedTeams.has(team.teamName)}
            onToggleExpand={() => handleTeamToggle(team.teamName)}
            onStudentClick={onStudentClick}
            showStudentDetails={true}
          />
        ))}
      </Box>

      {/* 追加チーム表示の案内 */}
      {!showAllTeams && optimizedTeamList.totalTeams > maxTeamsToShow && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            他 {optimizedTeamList.totalTeams - maxTeamsToShow} チームがあります。
            「全チーム表示」スイッチをオンにすると表示されます。
          </Typography>
        </Box>
      )}
    </Box>
  );
});

OptimizedTeamGrid.displayName = 'OptimizedTeamGrid';