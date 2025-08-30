import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Avatar
} from '@mui/material';
import {
  Person as PersonIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Code as CodeIcon,
  Help as HelpIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { StudentActivity, dashboardAPI } from '../../services/dashboardAPI';
import { getTeamDisplayName, TEAM_DISPLAY_PRESETS } from '../../utils/teamNameUtils';

interface StudentProgressGridProps {
  students: StudentActivity[];
  onStudentClick: (student: StudentActivity) => void;
  onRefresh?: () => void; // Add refresh callback
}

interface StudentCardProps {
  student: StudentActivity;
  onClick: (student: StudentActivity) => void;
  onDismissHelp?: (emailAddress: string) => void; // メールアドレスベースに変更
}

const getStatusColor = (status: StudentActivity['status']) => {
  switch (status) {
    case 'active':
      return '#4caf50'; // 緑
    case 'idle':
      return '#ff9800'; // オレンジ
    case 'error':
      return '#f44336'; // 赤
    case 'help':
      return '#ff5722'; // 深いオレンジ（ヘルプ要求）
    default:
      return '#9e9e9e'; // グレー
  }
};

const getStatusText = (status: StudentActivity['status']) => {
  switch (status) {
    case 'active':
      return 'アクティブ';
    case 'idle':
      return '待機中';
    case 'error':
      return 'エラー';
    case 'help':
      return 'ヘルプ要求';
    default:
      return '不明';
  }
};

const StudentCard: React.FC<StudentCardProps> = ({ student, onClick, onDismissHelp }) => {
  const handleClick = () => {
    onClick(student);
  };

  const handleDismissHelp = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    if (onDismissHelp) {
      onDismissHelp(student.emailAddress);
    }
  };

  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 3
        },
        border: `2px solid ${getStatusColor(student.status)}`,
        borderRadius: 2,
        minHeight: 160,
        // Special styling for help requests
        ...(student.status === 'help' && {
          boxShadow: '0 0 20px rgba(255, 87, 34, 0.3)',
          animation: 'pulse 2s infinite',
          '@keyframes pulse': {
            '0%': { boxShadow: '0 0 20px rgba(255, 87, 34, 0.3)' },
            '50%': { boxShadow: '0 0 30px rgba(255, 87, 34, 0.6)' },
            '100%': { boxShadow: '0 0 20px rgba(255, 87, 34, 0.3)' }
          }
        })
      }}
      onClick={handleClick}
    >
      <CardContent sx={{ p: 2 }}>
        {/* ヘッダー: アバター + 名前 */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
          <Avatar
            sx={{
              bgcolor: getStatusColor(student.status),
              width: 32,
              height: 32,
              mr: 1
            }}
          >
            <PersonIcon fontSize="small" />
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              {student.userName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {student.emailAddress}
            </Typography>
            {student.teamName && (
              <Typography variant="caption" color="primary.main" sx={{ display: 'block' }}>
                📋 {getTeamDisplayName(student.teamName, TEAM_DISPLAY_PRESETS.FULL_UI)}
              </Typography>
            )}
          </Box>
        </Box>

        {/* ステータスチップと解除ボタン */}
        <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={student.status === 'help' ? <HelpIcon sx={{ fontSize: '16px !important', color: 'white !important' }} /> : undefined}
            label={getStatusText(student.status)}
            size="small"
            sx={{
              bgcolor: getStatusColor(student.status),
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.75rem',
              // Special styling for help status chip
              ...(student.status === 'help' && {
                '& .MuiChip-icon': {
                  color: 'white !important'
                }
              })
            }}
          />
          {/* Help対応完了ボタン - help中の受講生のみ表示 */}
          {student.status === 'help' && onDismissHelp && (
            <Chip
              icon={<CheckIcon sx={{ fontSize: '16px !important', color: 'white !important' }} />}
              label="対応完了"
              size="medium"
              onClick={handleDismissHelp}
              sx={{
                bgcolor: '#4caf50',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                ml: 1,
                '&:hover': {
                  bgcolor: '#45a049',
                  transform: 'scale(1.1)',
                  boxShadow: '0 4px 8px rgba(76, 175, 80, 0.3)'
                },
                '& .MuiChip-icon': {
                  color: 'white !important'
                }
              }}
            />
          )}
        </Box>

        {/* ノートブック情報 */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          📓 {student.currentNotebook.split('/').pop()?.replace('.ipynb', '')}
        </Typography>

        {/* メトリクス */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem' }}>
            <CodeIcon sx={{ fontSize: 14, mr: 0.5, color: 'primary.main' }} />
            <Typography variant="caption">
              {student.cellExecutions}回
            </Typography>
          </Box>

          {student.errorCount > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem' }}>
              <ErrorIcon sx={{ fontSize: 14, mr: 0.5, color: 'error.main' }} />
              <Typography variant="caption" color="error">
                {student.errorCount}エラー
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem' }}>
            <ScheduleIcon sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {student.lastActivity}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export const StudentProgressGrid: React.FC<StudentProgressGridProps> = ({
  students,
  onStudentClick,
  onRefresh
}) => {
  const handleDismissHelp = async (userId: string) => {
    try {
      await dashboardAPI.dismissHelpRequest(userId);

      // Refresh the dashboard data to reflect the change
      if (onRefresh) {
        setTimeout(() => {
          onRefresh();
        }, 1000); // Give some time for the help session to stop
      }
    } catch (error: any) {
      // You could add a toast notification here
      alert('対応完了の記録に失敗しました: ' + error.message);
    }
  };

  if (students.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 200,
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px dashed',
          borderColor: 'divider'
        }}
      >
        <Typography variant="body1" color="text.secondary">
          受講生データがありません
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: {
        xs: '1fr',
        sm: '1fr 1fr',
        md: 'repeat(3, 1fr)',
        lg: 'repeat(4, 1fr)',
        xl: 'repeat(6, 1fr)'
      },
      gap: 2
    }}>
      {students.map((student) => (
        <StudentCard
          key={student.emailAddress}
          student={student}
          onClick={onStudentClick}
          onDismissHelp={handleDismissHelp}
        />
      ))}
    </Box>
  );
};

export default StudentProgressGrid;
