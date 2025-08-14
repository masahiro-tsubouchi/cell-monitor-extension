/**
 * チーム関連の計算ロジック
 * TeamProgressView.tsx の68行useMemoを外部化
 */

import { StudentActivity } from '../services/dashboardAPI';
import { TeamStats, TeamPriority, DEFAULT_TEAM_NAME } from '../types/domain';

/**
 * チーム別データのグループ化と統計計算
 */
export const calculateTeamData = (
  students: StudentActivity[],
  expandedTeams: Set<string>
): TeamStats[] => {
  const teamMap = new Map<string, StudentActivity[]>();

  // チーム別にグループ化
  students.forEach(student => {
    const teamName = student.teamName || DEFAULT_TEAM_NAME;
    if (!teamMap.has(teamName)) {
      teamMap.set(teamName, []);
    }
    teamMap.get(teamName)!.push(student);
  });

  // チーム統計を作成
  const teams: TeamStats[] = Array.from(teamMap.entries()).map(([teamName, teamStudents]) => {
    const stats = calculateSingleTeamStats(teamName, teamStudents);
    return stats;
  });

  // ソート処理
  return sortTeamsByPriority(teams, expandedTeams);
};

/**
 * 単一チームの統計計算
 */
export const calculateSingleTeamStats = (
  teamName: string,
  teamStudents: StudentActivity[]
): TeamStats => {
  const activeCount = teamStudents.filter(s => s.status === 'active').length;
  const idleCount = teamStudents.filter(s => s.status === 'idle').length;
  const errorCount = teamStudents.filter(s => s.status === 'error').length;
  const helpCount = teamStudents.filter(s => s.isRequestingHelp).length;

  const priority = calculateTeamPriority(errorCount, helpCount, activeCount, idleCount);
  const lastActivity = calculateLatestActivity(teamStudents);

  return {
    teamName,
    totalStudents: teamStudents.length,
    activeCount,
    idleCount,
    errorCount,
    helpCount,
    priority,
    lastActivity,
  };
};

/**
 * チーム優先度の計算
 */
export const calculateTeamPriority = (
  errorCount: number,
  helpCount: number,
  activeCount: number,
  idleCount: number
): TeamPriority => {
  if (errorCount > 0 || helpCount > 0) {
    return 'high';
  }
  if (idleCount > activeCount) {
    return 'medium';
  }
  return 'low';
};

/**
 * 最新活動時刻の計算
 */
export const calculateLatestActivity = (students: StudentActivity[]): string => {
  if (students.length === 0) return '不明';

  // より詳細な最新活動時刻計算のロジック
  const validActivities = students
    .map(s => s.lastActivity)
    .filter(activity => activity && activity !== '不明')
    .sort((a, b) => {
      // 簡単な時間比較（実際のプロジェクトではより堅牢な実装が必要）
      if (a === '今' || a.includes('秒前')) return -1;
      if (b === '今' || b.includes('秒前')) return 1;
      if (a.includes('分前') && b.includes('分前')) {
        const aMinutes = parseInt(a.replace('分前', '')) || 0;
        const bMinutes = parseInt(b.replace('分前', '')) || 0;
        return aMinutes - bMinutes;
      }
      return a.localeCompare(b);
    });

  return validActivities[0] || '不明';
};

/**
 * チームの優先度別ソート
 */
export const sortTeamsByPriority = (
  teams: TeamStats[],
  expandedTeams: Set<string>
): TeamStats[] => {
  return teams.sort((a, b) => {
    // 1. 展開状態での優先順位（展開中が上位）
    const aExpanded = expandedTeams.has(a.teamName);
    const bExpanded = expandedTeams.has(b.teamName);

    if (aExpanded !== bExpanded) {
      return bExpanded ? 1 : -1;
    }

    // 2. 同じ展開状態なら優先度順
    const priorityOrder: Record<TeamPriority, number> = { 
      high: 3, 
      medium: 2, 
      low: 1 
    };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    // 3. 優先度も同じならチーム名順
    return a.teamName.localeCompare(b.teamName);
  });
};

/**
 * チーム色の取得
 */
export const getTeamPriorityColor = (priority: TeamPriority): string => {
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

/**
 * チーム優先度アイコンの取得
 */
export const getTeamPriorityIcon = (priority: TeamPriority): string => {
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

/**
 * 学生状態アイコンの取得
 */
export const getStudentStatusIcon = (status: string): React.ReactNode => {
  // この関数はコンポーネント内で使用するため、
  // アイコンコンポーネントは呼び出し元で処理
  return status;
};

/**
 * チーム統計のサマリー計算
 */
export const calculateTeamSummary = (teams: TeamStats[]) => {
  return {
    totalTeams: teams.length,
    totalStudents: teams.reduce((sum, team) => sum + team.totalStudents, 0),
    highPriorityTeams: teams.filter(team => team.priority === 'high').length,
    mediumPriorityTeams: teams.filter(team => team.priority === 'medium').length,
    lowPriorityTeams: teams.filter(team => team.priority === 'low').length,
    totalHelpRequests: teams.reduce((sum, team) => sum + team.helpCount, 0),
    totalErrors: teams.reduce((sum, team) => sum + team.errorCount, 0),
    totalActiveStudents: teams.reduce((sum, team) => sum + team.activeCount, 0),
  };
};

/**
 * チーム間の比較分析
 */
export const compareTeams = (teamA: TeamStats, teamB: TeamStats) => {
  return {
    performanceDiff: {
      activeStudents: teamA.activeCount - teamB.activeCount,
      errors: teamA.errorCount - teamB.errorCount,
      helpRequests: teamA.helpCount - teamB.helpCount,
    },
    isTeamABetter: (
      teamA.activeCount > teamB.activeCount &&
      teamA.errorCount <= teamB.errorCount &&
      teamA.helpCount <= teamB.helpCount
    ),
    recommendations: generateTeamRecommendations(teamA, teamB),
  };
};

/**
 * チームへの推奨アクション生成
 */
export const generateTeamRecommendations = (
  teamA: TeamStats,
  teamB: TeamStats
): string[] => {
  const recommendations: string[] = [];

  if (teamA.helpCount > teamB.helpCount) {
    recommendations.push('チームAはより多くのサポートが必要です');
  }

  if (teamA.errorCount > teamB.errorCount * 1.5) {
    recommendations.push('チームAは技術的な問題を抱えている可能性があります');
  }

  if (teamA.activeCount < teamA.totalStudents * 0.5) {
    recommendations.push('チームAの参加率を向上させる必要があります');
  }

  return recommendations;
};

/**
 * パフォーマンス最適化用のメモ化キー生成
 */
export const generateTeamDataMemoKey = (
  students: StudentActivity[],
  expandedTeams: Set<string>
): string => {
  const studentsKey = students
    .map(s => `${s.emailAddress}:${s.status}:${s.isRequestingHelp}:${s.teamName}`)
    .sort()
    .join('|');
  
  const expandedKey = Array.from(expandedTeams).sort().join(',');
  
  return `${studentsKey}#${expandedKey}`;
};