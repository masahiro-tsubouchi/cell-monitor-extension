/**
 * 最適化チームカードコンポーネント
 * React.memoによる最適化とチーム情報の効率的表示
 */

import React, { memo, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
  Badge,
  IconButton,
  Collapse,
  Avatar,
  AvatarGroup
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Help as HelpIcon,
  Group as GroupIcon,
  TrendingUp as ProgressIcon,
  AccessTime as TimeIcon
} from '@mui/icons-material';
import { TeamData } from '../../hooks/useOptimizedTeamList';
import { StudentActivity } from '../../services/dashboardAPI';

interface OptimizedTeamCardProps {
  teamData: TeamData;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onStudentClick?: (student: StudentActivity) => void;
  showStudentDetails?: boolean;
}

// チームステータスの色とアイコンを取得
const getTeamStatusColor = (status: TeamData['status']) => {
  switch (status) {
    case 'help': return { color: 'error', bgcolor: '#ffebee' };
    case 'active': return { color: 'success', bgcolor: '#e8f5e8' };
    case 'error': return { color: 'warning', bgcolor: '#fff3e0' };
    case 'idle': return { color: 'default', bgcolor: '#f5f5f5' };
    default: return { color: 'default', bgcolor: '#f5f5f5' };
  }
};

// 学生カード（チーム内表示用）
const StudentMiniCard = memo<{
  student: StudentActivity;
  onClick?: (student: StudentActivity) => void;
}>(({ student, onClick }) => {
  const handleClick = useCallback(() => {
    onClick?.(student);
  }, [student, onClick]);

  const statusColor = student.isRequestingHelp ? 'error' : 
                     student.status === 'active' ? 'success' : 'default';

  return (
    <Box
      sx={{
        p: 1,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { bgcolor: 'action.hover' } : {},
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}
      onClick={handleClick}
    >
      <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
        {student.userName.charAt(0)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" noWrap>
          {student.userName}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {student.lastActivity}
        </Typography>
      </Box>
      {student.isRequestingHelp && (
        <HelpIcon color="error" sx={{ fontSize: 16 }} />
      )}
      <Chip
        size="small"
        label={student.cellExecutions || 0}
        color={statusColor}
        sx={{ minWidth: 'auto', height: 20, fontSize: '0.7rem' }}
      />
    </Box>
  );
});

StudentMiniCard.displayName = 'StudentMiniCard';

export const OptimizedTeamCard = memo<OptimizedTeamCardProps>(({
  teamData,
  isExpanded = false,
  onToggleExpand,
  onStudentClick,
  showStudentDetails = true
}) => {
  const statusStyle = getTeamStatusColor(teamData.status);
  const progressPercentage = Math.min(teamData.averageProgress, 100);

  const handleExpandClick = useCallback(() => {
    onToggleExpand?.();
  }, [onToggleExpand]);

  return (
    <Card
      sx={{
        height: 'fit-content',
        bgcolor: statusStyle.bgcolor,
        border: teamData.helpRequestCount > 0 ? 2 : 1,
        borderColor: teamData.helpRequestCount > 0 ? 'error.main' : 'divider',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 3
        }
      }}
    >
      <CardContent sx={{ pb: showStudentDetails ? 1 : 2 }}>
        {/* チームヘッダー */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <GroupIcon color={statusStyle.color as any} />
          <Typography variant="h6" component="h3" sx={{ flex: 1, fontWeight: 'bold' }}>
            {teamData.teamName}
          </Typography>
          
          {teamData.helpRequestCount > 0 && (
            <Badge badgeContent={teamData.helpRequestCount} color="error">
              <HelpIcon color="error" />
            </Badge>
          )}
          
          {showStudentDetails && onToggleExpand && (
            <IconButton
              size="small"
              onClick={handleExpandClick}
              sx={{
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}
            >
              <ExpandMoreIcon />
            </IconButton>
          )}
        </Box>

        {/* チーム統計 */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              進捗状況
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {progressPercentage.toFixed(1)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progressPercentage}
            color={statusStyle.color as any}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>

        {/* チーム情報 */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Chip
            size="small"
            icon={<GroupIcon />}
            label={`${teamData.totalStudents}名`}
            variant="outlined"
          />
          <Chip
            size="small"
            icon={<ProgressIcon />}
            label={`${teamData.activeStudents}名活動中`}
            color={teamData.activeStudents > 0 ? 'success' : 'default'}
            variant="outlined"
          />
          <Chip
            size="small"
            icon={<TimeIcon />}
            label={teamData.lastActivity}
            variant="outlined"
          />
        </Box>

        {/* 学生アバターグループ */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.8rem' } }}>
            {teamData.students.slice(0, 4).map((student, index) => (
              <Avatar
                key={student.emailAddress}
                sx={{
                  bgcolor: student.isRequestingHelp ? 'error.main' : 
                           student.status === 'active' ? 'success.main' : 'grey.500'
                }}
              >
                {student.userName.charAt(0)}
              </Avatar>
            ))}
          </AvatarGroup>
          {teamData.totalStudents > 4 && (
            <Typography variant="caption" color="text.secondary">
              他{teamData.totalStudents - 4}名
            </Typography>
          )}
        </Box>

        {/* 展開可能な学生詳細 */}
        {showStudentDetails && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" gutterBottom>
                チームメンバー詳細
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {teamData.students.map((student) => (
                  <StudentMiniCard
                    key={student.emailAddress}
                    student={student}
                    onClick={onStudentClick}
                  />
                ))}
              </Box>
            </Box>
          </Collapse>
        )}
      </CardContent>
    </Card>
  );
});

OptimizedTeamCard.displayName = 'OptimizedTeamCard';