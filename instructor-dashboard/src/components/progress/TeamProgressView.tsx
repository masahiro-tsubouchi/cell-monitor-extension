import React, { useState, useMemo } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Typography,
  Chip,
  Avatar,
  Card,
  CardContent,
  Stack
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Group as GroupIcon,
  Error as ErrorIcon,
  Help as HelpIcon,
  PlayArrow as ActiveIcon,
  Pause as IdleIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { StudentActivity } from '../../services/dashboardAPI';
import { TeamStats } from '../../types/domain';
import { getInstructorSettings, updateExpandedTeams } from '../../utils/instructorStorage';
import {
  calculateTeamData,
  getTeamPriorityColor,
  getTeamPriorityIcon,
  generateTeamDataMemoKey
} from '../../utils/teamCalculations';
import { getTeamDisplayName, TEAM_DISPLAY_PRESETS } from '../../utils/teamNameUtils';

interface TeamProgressViewProps {
  students: StudentActivity[];
  onStudentClick: (student: StudentActivity) => void;
  onExpandedTeamsChange?: (count: number) => void;
}

interface TeamData extends TeamStats {
  students: StudentActivity[];
}

export const TeamProgressView: React.FC<TeamProgressViewProps> = ({
  students,
  onStudentClick,
  onExpandedTeamsChange
}) => {
  // 講師別の展開状態を永続化
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(() => {
    const settings = getInstructorSettings();
    return new Set(settings.expandedTeams);
  });

  // チーム別データの計算（外部関数使用）
  const teamsData = useMemo((): TeamData[] => {
    const teamStats = calculateTeamData(students, expandedTeams);
    
    // 学生配列を追加してTeamData形式に変換
    return teamStats.map(stats => {
      const teamStudents = students.filter(s => 
        (s.teamName || '未割り当て') === stats.teamName
      );
      
      return {
        ...stats,
        students: teamStudents,
      };
    });
  }, [students, expandedTeams]); // 依存配列を修正

  const handleAccordionChange = (teamName: string) => (
    event: React.SyntheticEvent,
    isExpanded: boolean
  ) => {
    const newExpandedTeams = new Set(expandedTeams);

    if (isExpanded) {
      newExpandedTeams.add(teamName);
    } else {
      newExpandedTeams.delete(teamName);
    }

    setExpandedTeams(newExpandedTeams);

    // ローカルストレージに永続化
    updateExpandedTeams(teamName, isExpanded);

    // 親コンポーネントに展開チーム数の変更を通知
    if (onExpandedTeamsChange) {
      onExpandedTeamsChange(newExpandedTeams.size);
    }

    // 新機能: ユーザーアクティビティを記録（差分更新システム用）
    // この操作により、しばらく自動更新が遅延される
    import('../../stores/progressDashboardStore').then(({ useProgressDashboardStore }) => {
      const store = useProgressDashboardStore.getState();
      store.markUserActive();
    });
  };

  // 外部関数を使用（インライン関数を削除）

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <ActiveIcon sx={{ color: '#4caf50', fontSize: 16 }} />;
      case 'error':
        return <ErrorIcon sx={{ color: '#f44336', fontSize: 16 }} />;
      case 'idle':
        return <IdleIcon sx={{ color: '#9e9e9e', fontSize: 16 }} />;
      default:
        return <CheckIcon sx={{ color: '#2196f3', fontSize: 16 }} />;
    }
  };

  return (
    <Box>
      <Typography variant="h6" component="h2" fontWeight="bold" sx={{ mb: 2 }}>
        👥 チーム別進捗 ({teamsData.length}チーム, {students.length}名)
      </Typography>

      {teamsData.map((team) => (
        <Accordion
          key={team.teamName}
          expanded={expandedTeams.has(team.teamName)}
          onChange={handleAccordionChange(team.teamName)}
          sx={{
            mb: 1,
            border: `2px solid ${getTeamPriorityColor(team.priority)}`,
            '&:before': { display: 'none' }
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              backgroundColor: `${getTeamPriorityColor(team.priority)}10`,
              '&:hover': {
                backgroundColor: `${getTeamPriorityColor(team.priority)}20`
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', pr: 2 }}>
              {/* 優先度アイコン */}
              <Typography sx={{ fontSize: '24px', mr: 2 }}>
                {getTeamPriorityIcon(team.priority)}
              </Typography>

              {/* チーム名 */}
              <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <GroupIcon sx={{ mr: 1, color: getTeamPriorityColor(team.priority) }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  {getTeamDisplayName(team.teamName, TEAM_DISPLAY_PRESETS.FULL_UI)}
                </Typography>
              </Box>

              {/* 状態サマリー */}
              <Stack direction="row" spacing={1} alignItems="center">
                {/* 活動中 */}
                <Chip
                  icon={<ActiveIcon />}
                  label={`${team.activeCount}名`}
                  size="small"
                  sx={{
                    backgroundColor: '#4caf50',
                    color: 'white',
                    fontSize: '12px'
                  }}
                />

                {/* エラー */}
                {team.errorCount > 0 && (
                  <Chip
                    icon={<ErrorIcon />}
                    label={`${team.errorCount}`}
                    size="small"
                    sx={{
                      backgroundColor: '#f44336',
                      color: 'white',
                      fontSize: '12px'
                    }}
                  />
                )}

                {/* ヘルプ要求 */}
                {team.helpCount > 0 && (
                  <Chip
                    icon={<HelpIcon />}
                    label={`${team.helpCount}`}
                    size="small"
                    sx={{
                      backgroundColor: '#ff9800',
                      color: 'white',
                      fontSize: '12px'
                    }}
                  />
                )}

                {/* 総人数 */}
                <Chip
                  label={`${team.totalStudents}名`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '12px' }}
                />
              </Stack>
            </Box>
          </AccordionSummary>

          <AccordionDetails>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(1, 1fr)',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(3, 1fr)',
                  lg: 'repeat(4, 1fr)'
                },
                gap: 2
              }}
            >
              {team.students.map((student) => (
                <Card
                  key={student.emailAddress}
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      border: student.isRequestingHelp ? '2px solid #ff9800' : '1px solid #e0e0e0',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 3
                      }
                    }}
                    onClick={() => onStudentClick(student)}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            mr: 1,
                            backgroundColor: getTeamPriorityColor(
                              student.status === 'error' ? 'high' :
                              student.status === 'active' ? 'low' : 'medium'
                            )
                          }}
                        >
                          {student.userName ? student.userName.charAt(0) : '?'}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            noWrap
                            title={student.userName}
                          >
                            {student.userName}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            title={student.emailAddress}
                          >
                            {student.emailAddress}
                          </Typography>
                        </Box>
                        {getStatusIcon(student.status)}
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          実行: {student.cellExecutions || 0}回
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {student.lastActivity || '不明'}
                        </Typography>
                      </Box>

                      {student.isRequestingHelp && (
                        <Box sx={{ mt: 1 }}>
                          <Chip
                            icon={<HelpIcon />}
                            label="ヘルプ要求中"
                            size="small"
                            sx={{
                              backgroundColor: '#ff9800',
                              color: 'white',
                              fontSize: '10px'
                            }}
                          />
                        </Box>
                      )}
                    </CardContent>
                  </Card>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}

      {teamsData.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            現在、アクティブなチームはありません
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default TeamProgressView;
