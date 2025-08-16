/**
 * Optimized Student List Hook
 * メモ化戦略による学生データの最適化
 */

import { useMemo, useCallback } from 'react';
import { StudentActivity } from '../services/dashboardAPI';

export interface StudentFilter {
  searchQuery?: string;
  statusFilter?: 'all' | 'active' | 'inactive' | 'help';
  teamFilter?: string;
  sortBy?: 'name' | 'activity' | 'executions' | 'team';
  sortOrder?: 'asc' | 'desc';
}

export interface OptimizedStudentData {
  id: string;
  displayName: string;
  statusIndicator: string;
  activityScore: number;
  priorityLevel: 'high' | 'medium' | 'low';
  isHelpRequesting: boolean;
  lastActivityTime: Date | null;
  executionCount: number;
  teamName: string;
  original: StudentActivity;
}

const createStudentFilter = (filters: StudentFilter) => {
  return (student: StudentActivity): boolean => {
    // 検索クエリフィルター
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matches = 
        student.userName.toLowerCase().includes(query) ||
        student.emailAddress.toLowerCase().includes(query) ||
        student.teamName?.toLowerCase().includes(query);
      if (!matches) return false;
    }

    // ステータスフィルター
    if (filters.statusFilter && filters.statusFilter !== 'all') {
      if (filters.statusFilter === 'help' && !student.isRequestingHelp) return false;
      if (filters.statusFilter === 'active' && student.status !== 'active') return false;
      if (filters.statusFilter === 'inactive' && student.status === 'active') return false;
    }

    // チームフィルター
    if (filters.teamFilter && student.teamName !== filters.teamFilter) {
      return false;
    }

    return true;
  };
};

const transformForDisplay = (student: StudentActivity): OptimizedStudentData => {
  // 活動スコア計算（重い計算をメモ化対象に）
  const activityScore = calculateActivityScore(student);
  
  // 優先度レベル計算
  const priorityLevel = calculatePriorityLevel(student, activityScore);
  
  // 最終活動時間解析
  const lastActivityTime = parseLastActivity(student.lastActivity);

  return {
    id: student.emailAddress,
    displayName: student.userName,
    statusIndicator: student.isRequestingHelp ? '🆘' : getStatusEmoji(student.status),
    activityScore,
    priorityLevel,
    isHelpRequesting: student.isRequestingHelp || false,
    lastActivityTime,
    executionCount: student.cellExecutions || 0,
    teamName: student.teamName || '未割り当て',
    original: student
  };
};

const calculateActivityScore = (student: StudentActivity): number => {
  // 複雑な活動スコア計算（CPU集約的）
  let score = 0;
  
  // 実行回数スコア (0-40点)
  score += Math.min(student.cellExecutions || 0, 40);
  
  // 最新活動スコア (0-30点)
  const activityBonus = getActivityBonus(student.lastActivity);
  score += activityBonus;
  
  // エラー率ペナルティ (-0-20点)
  const errorRate = student.errorCount / Math.max(student.cellExecutions || 1, 1);
  score -= Math.min(errorRate * 20, 20);
  
  // ヘルプ要請状態ボーナス (0-10点)
  if (student.isRequestingHelp) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
};

const getActivityBonus = (lastActivity: string): number => {
  if (lastActivity === '今' || lastActivity === 'now') return 30;
  if (lastActivity.includes('分前') || lastActivity.includes('minutes ago')) {
    const minutes = parseInt(lastActivity) || 0;
    return Math.max(0, 30 - minutes);
  }
  if (lastActivity.includes('時間前') || lastActivity.includes('hours ago')) {
    return 5;
  }
  return 0;
};

const calculatePriorityLevel = (student: StudentActivity, activityScore: number): 'high' | 'medium' | 'low' => {
  if (student.isRequestingHelp) return 'high';
  if (activityScore > 70) return 'high';
  if (activityScore > 40) return 'medium';
  return 'low';
};

const parseLastActivity = (lastActivity: string): Date | null => {
  if (lastActivity === '今' || lastActivity === 'now') {
    return new Date();
  }
  
  const minutesMatch = lastActivity.match(/(\d+)分前/);
  if (minutesMatch) {
    const minutes = parseInt(minutesMatch[1]);
    return new Date(Date.now() - minutes * 60 * 1000);
  }
  
  const hoursMatch = lastActivity.match(/(\d+)時間前/);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1]);
    return new Date(Date.now() - hours * 60 * 60 * 1000);
  }
  
  return null;
};

const getStatusEmoji = (status: string): string => {
  switch (status) {
    case 'active': return '🟢';
    case 'inactive': return '🔴';
    case 'idle': return '🟡';
    default: return '⚪';
  }
};

const createStudentSorter = (sortBy: string, sortOrder: 'asc' | 'desc') => {
  return (a: OptimizedStudentData, b: OptimizedStudentData): number => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.displayName.localeCompare(b.displayName);
        break;
      case 'activity':
        comparison = a.activityScore - b.activityScore;
        break;
      case 'executions':
        comparison = a.executionCount - b.executionCount;
        break;
      case 'team':
        comparison = a.teamName.localeCompare(b.teamName);
        break;
      default:
        comparison = 0;
    }
    
    return sortOrder === 'desc' ? -comparison : comparison;
  };
};

/**
 * 最適化された学生リストフック
 */
export const useOptimizedStudentList = (
  students: StudentActivity[],
  filters: StudentFilter = {},
  limit?: number
) => {
  // フィルタリング済み学生（メモ化）
  const filteredStudents = useMemo(() => {
    console.log('🔄 Recomputing filtered students...', { studentsCount: students.length, filters });
    return students.filter(createStudentFilter(filters));
  }, [students, filters.searchQuery, filters.statusFilter, filters.teamFilter]);

  // 表示用データ変換（メモ化）
  const optimizedStudents = useMemo(() => {
    console.log('🔄 Recomputing optimized student data...', { count: filteredStudents.length });
    return filteredStudents.map(transformForDisplay);
  }, [filteredStudents]);

  // ソート済みデータ（メモ化）
  const sortedStudents = useMemo(() => {
    if (!filters.sortBy) return optimizedStudents;
    
    console.log('🔄 Recomputing sorted students...', { sortBy: filters.sortBy, sortOrder: filters.sortOrder });
    return [...optimizedStudents].sort(
      createStudentSorter(filters.sortBy, filters.sortOrder || 'asc')
    );
  }, [optimizedStudents, filters.sortBy, filters.sortOrder]);

  // 制限付き結果（メモ化）
  const limitedStudents = useMemo(() => {
    if (!limit) return sortedStudents;
    return sortedStudents.slice(0, limit);
  }, [sortedStudents, limit]);

  // 統計情報（メモ化）
  const statistics = useMemo(() => {
    const stats = {
      total: students.length,
      filtered: filteredStudents.length,
      displayed: limitedStudents.length,
      helpRequesting: limitedStudents.filter(s => s.isHelpRequesting).length,
      highPriority: limitedStudents.filter(s => s.priorityLevel === 'high').length,
      averageActivityScore: limitedStudents.reduce((sum, s) => sum + s.activityScore, 0) / limitedStudents.length || 0
    };
    
    console.log('📊 Student statistics:', stats);
    return stats;
  }, [students.length, filteredStudents.length, limitedStudents]);

  // フィルター更新コールバック（メモ化）
  const updateFilters = useCallback((newFilters: Partial<StudentFilter>) => {
    return { ...filters, ...newFilters };
  }, [filters]);

  return {
    students: limitedStudents,
    statistics,
    updateFilters,
    // デバッグ情報
    debug: {
      originalCount: students.length,
      filteredCount: filteredStudents.length,
      finalCount: limitedStudents.length
    }
  };
};

/**
 * チーム別最適化フック
 */
export const useOptimizedTeamData = (students: StudentActivity[]) => {
  const teamData = useMemo(() => {
    console.log('🔄 Recomputing team data...', { studentsCount: students.length });
    
    const teams = new Map<string, {
      name: string;
      students: OptimizedStudentData[];
      statistics: {
        totalStudents: number;
        activeStudents: number;
        helpRequesting: number;
        averageActivity: number;
        totalExecutions: number;
      };
    }>();

    students.forEach(student => {
      const teamName = student.teamName || '未割り当て';
      
      if (!teams.has(teamName)) {
        teams.set(teamName, {
          name: teamName,
          students: [],
          statistics: {
            totalStudents: 0,
            activeStudents: 0,
            helpRequesting: 0,
            averageActivity: 0,
            totalExecutions: 0
          }
        });
      }

      const team = teams.get(teamName)!;
      const optimizedStudent = transformForDisplay(student);
      team.students.push(optimizedStudent);
    });

    // チーム統計計算
    teams.forEach(team => {
      team.statistics.totalStudents = team.students.length;
      team.statistics.activeStudents = team.students.filter(s => s.original.status === 'active').length;
      team.statistics.helpRequesting = team.students.filter(s => s.isHelpRequesting).length;
      team.statistics.averageActivity = team.students.reduce((sum, s) => sum + s.activityScore, 0) / team.students.length || 0;
      team.statistics.totalExecutions = team.students.reduce((sum, s) => sum + s.executionCount, 0);
    });

    return Array.from(teams.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [students]);

  return teamData;
};