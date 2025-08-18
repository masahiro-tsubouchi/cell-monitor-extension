/**
 * Optimized Student Card Component
 * React.memo + useMemo による最適化されたコンポーネント
 */

import React, { memo, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Box,
  Chip,
  LinearProgress,
  Badge,
  Tooltip
} from '@mui/material';
import {
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Code as CodeIcon,
  Error as ErrorIcon,
  Help as HelpIcon
} from '@mui/icons-material';
import { StudentActivity } from '../../services/dashboardAPI';
import { OptimizedStudentData } from '../../hooks/useOptimizedStudentList';

interface OptimizedStudentCardProps {
  studentData: OptimizedStudentData;
  onClick?: (student: StudentActivity) => void;
  compact?: boolean;
  showTeam?: boolean;
}

/**
 * 学生カードコンポーネント（最適化版）
 * - React.memo でprops変更時のみ再レンダリング
 * - useMemo で重い計算をメモ化
 * - 浅い比較最適化
 */
export const OptimizedStudentCard: React.FC<OptimizedStudentCardProps> = memo(({
  studentData,
  onClick,
  compact = false,
  showTeam = true
}) => {
  // スタイル計算をメモ化
  const cardStyles = useMemo(() => ({
    card: {
      position: 'relative' as const,
      transition: 'all 0.2s ease-in-out',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: 3
      },
      border: studentData.isHelpRequesting ? '2px solid #ff5722' : '1px solid #e0e0e0',
      backgroundColor: studentData.isHelpRequesting ? '#fff3e0' : '#ffffff'
    },
    priorityIndicator: {
      width: 4,
      height: '100%',
      position: 'absolute' as const,
      left: 0,
      top: 0,
      backgroundColor: getPriorityColor(studentData.priorityLevel)
    },
    activityProgress: {
      height: 6,
      borderRadius: 3,
      backgroundColor: getActivityProgressColor(studentData.activityScore)
    }
  }), [studentData.isHelpRequesting, studentData.priorityLevel, studentData.activityScore]);

  // 表示テキストをメモ化
  const displayData = useMemo(() => ({
    statusText: getStatusText(studentData.original.status, studentData.isHelpRequesting),
    activityText: getActivityText(studentData.original.lastActivity),
    executionText: `${studentData.executionCount}回実行`,
    errorRate: calculateErrorRate(studentData.original),
    teamDisplayName: studentData.teamName === '未割り当て' ? '👤 個人' : `👥 ${studentData.teamName}`
  }), [studentData.original, studentData.executionCount, studentData.teamName]);

  const handleClick = () => {
    onClick?.(studentData.original);
  };

  if (compact) {
    return (
      <Chip
        icon={<PersonIcon />}
        label={studentData.displayName}
        onClick={handleClick}
        color={studentData.priorityLevel === 'high' ? 'error' : 'default'}
        variant={studentData.isHelpRequesting ? 'filled' : 'outlined'}
        sx={{
          '& .MuiChip-label': {
            fontWeight: studentData.isHelpRequesting ? 'bold' : 'normal'
          }
        }}
      />
    );
  }

  return (
    <Card sx={cardStyles.card}>
      {/* 優先度インジケーター */}
      <Box sx={cardStyles.priorityIndicator} />
      
      <CardActionArea onClick={handleClick}>
        <CardContent sx={{ pl: 2 }}>
          {/* ヘルプ要請バッジ */}
          {studentData.isHelpRequesting && (
            <Badge
              badgeContent={<HelpIcon sx={{ fontSize: 16 }} />}
              color="error"
              sx={{ 
                position: 'absolute',
                top: 8,
                right: 8,
                '& .MuiBadge-badge': {
                  backgroundColor: '#ff5722'
                }
              }}
            />
          )}

          {/* 学生名とステータス */}
          <Box sx={{ mb: 1 }}>
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                fontWeight: 'bold',
                fontSize: compact ? '0.9rem' : '1.1rem',
                pr: studentData.isHelpRequesting ? 4 : 0
              }}
            >
              {studentData.statusIndicator} {studentData.displayName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {displayData.statusText}
            </Typography>
          </Box>

          {/* 活動スコアプログレス */}
          <Box sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                活動スコア
              </Typography>
              <Typography variant="caption" fontWeight="bold">
                {Math.round(studentData.activityScore)}/100
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={studentData.activityScore}
              sx={cardStyles.activityProgress}
            />
          </Box>

          {/* 詳細情報 */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            <Tooltip title="最終活動" arrow>
              <Chip
                icon={<ScheduleIcon />}
                label={displayData.activityText}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            </Tooltip>
            
            <Tooltip title="セル実行回数" arrow>
              <Chip
                icon={<CodeIcon />}
                label={displayData.executionText}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            </Tooltip>

            {displayData.errorRate > 0 && (
              <Tooltip title={`エラー率: ${Math.round(displayData.errorRate * 100)}%`} arrow>
                <Chip
                  icon={<ErrorIcon />}
                  label={`${Math.round(displayData.errorRate * 100)}%`}
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              </Tooltip>
            )}
          </Box>

          {/* チーム情報 */}
          {showTeam && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {displayData.teamDisplayName}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}, (prevProps, nextProps) => {
  // カスタム比較関数で最適化
  // 必要なプロパティのみをチェックして不要な再レンダリングを防ぐ
  const prev = prevProps.studentData;
  const next = nextProps.studentData;

  return (
    prev.id === next.id &&
    prev.displayName === next.displayName &&
    prev.activityScore === next.activityScore &&
    prev.priorityLevel === next.priorityLevel &&
    prev.isHelpRequesting === next.isHelpRequesting &&
    prev.executionCount === next.executionCount &&
    prev.teamName === next.teamName &&
    prev.original.status === next.original.status &&
    prev.original.lastActivity === next.original.lastActivity &&
    prev.original.errorCount === next.original.errorCount &&
    prevProps.compact === nextProps.compact &&
    prevProps.showTeam === nextProps.showTeam
  );
});

OptimizedStudentCard.displayName = 'OptimizedStudentCard';

// ヘルパー関数（コンポーネント外で定義してメモ化効果を向上）
function getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
  switch (priority) {
    case 'high': return '#ff5722';
    case 'medium': return '#ffc107';
    case 'low': return '#4caf50';
    default: return '#9e9e9e';
  }
}

function getActivityProgressColor(score: number): string {
  if (score > 70) return '#4caf50';
  if (score > 40) return '#ff9800';
  return '#f44336';
}

function getStatusText(status: string, isHelpRequesting: boolean): string {
  if (isHelpRequesting) return '🆘 ヘルプ要請中';
  
  switch (status) {
    case 'active': return '🟢 アクティブ';
    case 'inactive': return '🔴 非アクティブ';
    case 'idle': return '🟡 待機中';
    default: return '⚪ 状態不明';
  }
}

function getActivityText(lastActivity: string): string {
  if (lastActivity === '今' || lastActivity === 'now') return '今';
  if (lastActivity.includes('分前')) return lastActivity;
  if (lastActivity.includes('時間前')) return lastActivity;
  return '不明';
}

function calculateErrorRate(student: StudentActivity): number {
  const executions = student.cellExecutions || 0;
  const errors = student.errorCount || 0;
  
  if (executions === 0) return 0;
  return errors / executions;
}

export default OptimizedStudentCard;