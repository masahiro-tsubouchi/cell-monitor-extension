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
import { getInstructorSettings, updateExpandedTeams } from '../../utils/instructorStorage';

interface TeamProgressViewProps {
  students: StudentActivity[];
  onStudentClick: (student: StudentActivity) => void;
  onExpandedTeamsChange?: (count: number) => void;
}

interface TeamData {
  teamName: string;
  students: StudentActivity[];
  totalStudents: number;
  activeCount: number;
  idleCount: number;
  errorCount: number;
  helpCount: number;
  priority: 'high' | 'medium' | 'low';
  lastActivity: string;
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

  // チーム別にデータをグループ化
  const teamsData = useMemo((): TeamData[] => {
    const teamMap = new Map<string, StudentActivity[]>();

    // チーム別にグループ化
    students.forEach(student => {
      const teamName = student.teamName || '未割り当て';
      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, []);
      }
      teamMap.get(teamName)!.push(student);
    });

    // チームデータを作成し、優先度でソート
    const teams: TeamData[] = Array.from(teamMap.entries()).map(([teamName, teamStudents]) => {
      const activeCount = teamStudents.filter(s => s.status === 'active').length;
      const idleCount = teamStudents.filter(s => s.status === 'idle').length;
      const errorCount = teamStudents.filter(s => s.status === 'error').length;
      const helpCount = teamStudents.filter(s => s.isRequestingHelp).length;

      // 優先度計算
      let priority: 'high' | 'medium' | 'low' = 'low';
      if (errorCount > 0 || helpCount > 0) {
        priority = 'high';
      } else if (idleCount > activeCount) {
        priority = 'medium';
      }

      // 最新活動時刻を計算
      const latestActivity = teamStudents.reduce((latest, student) => {
        if (student.lastActivity && student.lastActivity !== '不明') {
          return latest; // 簡略化：現在は最初の値を使用
        }
        return latest;
      }, '不明');

      return {
        teamName,
        students: teamStudents,
        totalStudents: teamStudents.length,
        activeCount,
        idleCount,
        errorCount,
        helpCount,
        priority,
        lastActivity: latestActivity
      };
    });

    // ソート順: 1.展開状態 2.優先度 3.チーム名
    return teams.sort((a, b) => {
      const aExpanded = expandedTeams.has(a.teamName);
      const bExpanded = expandedTeams.has(b.teamName);

      // 展開状態での優先順位（展開中が上位）
      if (aExpanded !== bExpanded) {
        return bExpanded ? 1 : -1;
      }

      // 同じ展開状態なら優先度順
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // 優先度も同じならチーム名順
      return a.teamName.localeCompare(b.teamName);
    });
  }, [students, expandedTeams]);

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
  };

  const getPriorityColor = (priority: TeamData['priority']) => {
    switch (priority) {
      case 'high':
        return '#f44336'; // 赤
      case 'medium':
        return '#ff9800'; // オレンジ
      case 'low':
        return '#4caf50'; // 緑
      default:
        return '#9e9e9e'; // グレー
    }
  };

  const getPriorityIcon = (priority: TeamData['priority']) => {
    switch (priority) {
      case 'high':
        return '🚨';
      case 'medium':
        return '⚠️';
      case 'low':
        return '✅';
      default:
        return '⚪';
    }
  };

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
            border: `2px solid ${getPriorityColor(team.priority)}`,
            '&:before': { display: 'none' }
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              backgroundColor: `${getPriorityColor(team.priority)}10`,
              '&:hover': {
                backgroundColor: `${getPriorityColor(team.priority)}20`
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', pr: 2 }}>
              {/* 優先度アイコン */}
              <Typography sx={{ fontSize: '24px', mr: 2 }}>
                {getPriorityIcon(team.priority)}
              </Typography>

              {/* チーム名 */}
              <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <GroupIcon sx={{ mr: 1, color: getPriorityColor(team.priority) }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  {team.teamName}
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
                            backgroundColor: getPriorityColor(
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
