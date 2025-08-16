/**
 * チーム最適化リストフック
 * チーム単位でのデータ処理と優先度ソートを実装
 */

import { useMemo } from 'react';
import { StudentActivity } from '../services/dashboardAPI';

export interface TeamData {
  teamName: string;
  students: StudentActivity[];
  totalStudents: number;
  activeStudents: number;
  helpRequestCount: number;
  averageProgress: number;
  priority: number; // 優先度スコア（高いほど重要）
  lastActivity: string;
  status: 'active' | 'idle' | 'help' | 'error';
}

export interface OptimizedTeamList {
  teams: TeamData[];
  prioritizedTeams: TeamData[]; // 優先度順
  displayTeams: TeamData[]; // 表示用（最大8チーム）
  totalTeams: number;
  stats: {
    totalStudents: number;
    activeTeams: number;
    teamsNeedingHelp: number;
  };
}

// チーム優先度の計算
const calculateTeamPriority = (team: Omit<TeamData, 'priority'>): number => {
  let priority = 0;
  
  // ヘルプ要請があるチームは最優先
  if (team.helpRequestCount > 0) {
    priority += 1000 + (team.helpRequestCount * 100);
  }
  
  // アクティブな学生数による加点
  priority += team.activeStudents * 10;
  
  // 進捗率による加点（低進捗ほど高優先度）
  priority += (100 - team.averageProgress) * 2;
  
  // チームサイズによる調整
  priority += team.totalStudents * 5;
  
  // 最近の活動による加点
  if (team.lastActivity === '今' || team.lastActivity.includes('秒前')) {
    priority += 50;
  } else if (team.lastActivity.includes('分前')) {
    priority += 20;
  }
  
  return priority;
};

// チームステータスの決定
const getTeamStatus = (team: Omit<TeamData, 'status' | 'priority'>): TeamData['status'] => {
  if (team.helpRequestCount > 0) return 'help';
  if (team.activeStudents === 0) return 'idle';
  if (team.students.some(s => s.errorCount > 0)) return 'error';
  return 'active';
};

// 学生データからチームデータへの変換
const createTeamData = (teamName: string, students: StudentActivity[]): TeamData => {
  const activeStudents = students.filter(s => s.status === 'active').length;
  const helpRequestCount = students.filter(s => s.isRequestingHelp).length;
  const averageProgress = students.reduce((sum, s) => sum + (s.cellExecutions || 0), 0) / students.length;
  
  // 最新の活動時刻を取得
  const lastActivity = students.reduce((latest, student) => {
    if (student.lastActivity === '今') return '今';
    if (latest === '今') return latest;
    
    // 簡単な時刻比較（実際にはより精密な比較が必要）
    if (student.lastActivity.includes('秒前') && !latest.includes('秒前')) {
      return student.lastActivity;
    }
    return latest;
  }, students[0]?.lastActivity || '不明');
  
  const baseTeam = {
    teamName,
    students,
    totalStudents: students.length,
    activeStudents,
    helpRequestCount,
    averageProgress,
    lastActivity,
    status: getTeamStatus({
      teamName,
      students,
      totalStudents: students.length,
      activeStudents,
      helpRequestCount,
      averageProgress,
      lastActivity
    })
  };
  
  const priority = calculateTeamPriority(baseTeam);
  
  return {
    ...baseTeam,
    priority
  };
};

export const useOptimizedTeamList = (students: StudentActivity[]): OptimizedTeamList => {
  return useMemo(() => {
    // チーム名でグループ化
    const teamGroups = students.reduce((groups, student) => {
      const teamName = student.teamName || '未割り当て';
      if (!groups[teamName]) {
        groups[teamName] = [];
      }
      groups[teamName].push(student);
      return groups;
    }, {} as Record<string, StudentActivity[]>);
    
    // チームデータを作成
    const teams = Object.entries(teamGroups).map(([teamName, teamStudents]) =>
      createTeamData(teamName, teamStudents)
    );
    
    // 優先度順にソート
    const prioritizedTeams = [...teams].sort((a, b) => b.priority - a.priority);
    
    // 表示用チーム（最大8チーム）
    const displayTeams = prioritizedTeams.slice(0, 8);
    
    // 統計情報
    const stats = {
      totalStudents: students.length,
      activeTeams: teams.filter(t => t.status === 'active').length,
      teamsNeedingHelp: teams.filter(t => t.helpRequestCount > 0).length
    };
    
    return {
      teams,
      prioritizedTeams,
      displayTeams,
      totalTeams: teams.length,
      stats
    };
  }, [students]);
};