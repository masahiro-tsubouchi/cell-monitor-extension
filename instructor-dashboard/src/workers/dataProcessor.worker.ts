/**
 * Data Processing Web Worker
 * 重い計算処理をメインスレッドから分離
 */

/* eslint-disable no-restricted-globals */

import { StudentActivity } from '../services/dashboardAPI';

// ワーカーで使用する型定義
interface ProcessingTask {
  type: 'FILTER_STUDENTS' | 'CALCULATE_STATISTICS' | 'GENERATE_ANALYTICS' | 'SORT_STUDENTS';
  data: any;
  taskId: string;
}

interface ProcessingResult {
  type: string;
  taskId: string;
  result: any;
  error?: string;
  duration: number;
}

// 学生フィルタリング処理
function filterStudents(students: StudentActivity[], filters: any): StudentActivity[] {
  const startTime = performance.now();
  
  let filtered = students.filter(student => {
    // 検索クエリフィルター
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesSearch = 
        student.userName.toLowerCase().includes(query) ||
        student.emailAddress.toLowerCase().includes(query) ||
        (student.teamName && student.teamName.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // ステータスフィルター
    if (filters.statusFilter && filters.statusFilter !== 'all') {
      if (filters.statusFilter === 'help' && !student.isRequestingHelp) return false;
      if (filters.statusFilter === 'active' && student.status !== 'active') return false;
      if (filters.statusFilter === 'idle' && student.status === 'active') return false;
    }

    // チームフィルター
    if (filters.teamFilter && student.teamName !== filters.teamFilter) {
      return false;
    }

    // エラー率フィルター
    if (filters.maxErrorRate !== undefined) {
      const errorRate = (student.errorCount || 0) / Math.max(student.cellExecutions || 1, 1);
      if (errorRate > filters.maxErrorRate) return false;
    }

    // 最小実行回数フィルター
    if (filters.minExecutions !== undefined) {
      if ((student.cellExecutions || 0) < filters.minExecutions) return false;
    }

    return true;
  });

  const duration = performance.now() - startTime;
  console.log(`🔧 Worker: Filtered ${students.length} → ${filtered.length} students in ${duration.toFixed(2)}ms`);
  
  return filtered;
}

// 統計計算処理
function calculateStatistics(students: StudentActivity[]) {
  const startTime = performance.now();
  
  const stats = {
    total: students.length,
    active: 0,
    idle: 0,
    helpRequesting: 0,
    totalExecutions: 0,
    totalErrors: 0,
    averageExecutions: 0,
    averageErrorRate: 0,
    teamDistribution: {} as Record<string, number>,
    activityDistribution: {
      veryActive: 0, // 50+ executions
      active: 0,     // 10-49 executions
      lowActivity: 0, // 1-9 executions
      noActivity: 0   // 0 executions
    },
    errorRateDistribution: {
      noErrors: 0,    // 0% error rate
      lowErrors: 0,   // 0-10% error rate
      mediumErrors: 0, // 10-25% error rate
      highErrors: 0   // 25%+ error rate
    }
  };

  students.forEach(student => {
    // 基本統計
    if (student.status === 'active') stats.active++;
    else stats.idle++;
    
    if (student.isRequestingHelp) stats.helpRequesting++;
    
    const executions = student.cellExecutions || 0;
    const errors = student.errorCount || 0;
    
    stats.totalExecutions += executions;
    stats.totalErrors += errors;

    // チーム分布
    const teamName = student.teamName || '未割り当て';
    stats.teamDistribution[teamName] = (stats.teamDistribution[teamName] || 0) + 1;

    // 活動度分布
    if (executions >= 50) stats.activityDistribution.veryActive++;
    else if (executions >= 10) stats.activityDistribution.active++;
    else if (executions >= 1) stats.activityDistribution.lowActivity++;
    else stats.activityDistribution.noActivity++;

    // エラー率分布
    const errorRate = executions > 0 ? errors / executions : 0;
    if (errorRate === 0) stats.errorRateDistribution.noErrors++;
    else if (errorRate <= 0.1) stats.errorRateDistribution.lowErrors++;
    else if (errorRate <= 0.25) stats.errorRateDistribution.mediumErrors++;
    else stats.errorRateDistribution.highErrors++;
  });

  // 平均値計算
  if (students.length > 0) {
    stats.averageExecutions = stats.totalExecutions / students.length;
    stats.averageErrorRate = stats.totalErrors / Math.max(stats.totalExecutions, 1);
  }

  const duration = performance.now() - startTime;
  console.log(`🔧 Worker: Calculated statistics for ${students.length} students in ${duration.toFixed(2)}ms`);
  
  return stats;
}

// 高度な分析処理
function generateAnalytics(students: StudentActivity[]) {
  const startTime = performance.now();
  
  // 時間帯別活動分析
  const timeAnalysis = analyzeActivityPatterns(students);
  
  // チーム比較分析
  const teamAnalysis = analyzeTeamPerformance(students);
  
  // 学習進捗予測
  const progressPrediction = predictLearningProgress(students);
  
  // 注意が必要な学生の特定
  const riskStudents = identifyRiskStudents(students);

  const duration = performance.now() - startTime;
  console.log(`🔧 Worker: Generated analytics for ${students.length} students in ${duration.toFixed(2)}ms`);
  
  return {
    timeAnalysis,
    teamAnalysis,
    progressPrediction,
    riskStudents,
    generatedAt: new Date().toISOString()
  };
}

function analyzeActivityPatterns(students: StudentActivity[]) {
  // 時間帯別の活動パターンを分析
  // 実際の実装では、lastActivity や timestamp を使用してより詳細な分析を行う
  return {
    peakHours: ['10:00-12:00', '14:00-16:00'],
    lowActivityHours: ['12:00-13:00', '18:00-20:00'],
    weekdayVsWeekend: {
      weekday: 0.8,
      weekend: 0.2
    }
  };
}

function analyzeTeamPerformance(students: StudentActivity[]) {
  const teams = new Map<string, StudentActivity[]>();
  
  students.forEach(student => {
    const teamName = student.teamName || '個人';
    if (!teams.has(teamName)) {
      teams.set(teamName, []);
    }
    teams.get(teamName)!.push(student);
  });

  const teamStats = Array.from(teams.entries()).map(([teamName, members]) => {
    const totalExecutions = members.reduce((sum, s) => sum + (s.cellExecutions || 0), 0);
    const totalErrors = members.reduce((sum, s) => sum + (s.errorCount || 0), 0);
    const activeMembers = members.filter(s => s.status === 'active').length;
    
    return {
      teamName,
      memberCount: members.length,
      averageExecutions: totalExecutions / members.length,
      errorRate: totalErrors / Math.max(totalExecutions, 1),
      activityRate: activeMembers / members.length,
      needsAttention: activeMembers / members.length < 0.5
    };
  });

  return teamStats.sort((a, b) => b.averageExecutions - a.averageExecutions);
}

function predictLearningProgress(students: StudentActivity[]) {
  // 機械学習的な進捗予測（簡略化版）
  const predictions = students.map(student => {
    const executions = student.cellExecutions || 0;
    const errors = student.errorCount || 0;
    const errorRate = errors / Math.max(executions, 1);
    
    // 簡単な進捗スコア計算
    let progressScore = Math.min(executions / 50, 1) * 0.6; // 実行回数の影響 (60%)
    progressScore += (1 - Math.min(errorRate, 0.5) / 0.5) * 0.3; // エラー率の影響 (30%)
    progressScore += (student.status === 'active' ? 1 : 0) * 0.1; // 活動状態の影響 (10%)
    
    return {
      studentId: student.emailAddress,
      currentScore: progressScore,
      predictedCompletion: progressScore > 0.7 ? '順調' : progressScore > 0.4 ? '要注意' : '支援必要',
      recommendedActions: getRecommendedActions(progressScore, errorRate, executions)
    };
  });

  return predictions;
}

function getRecommendedActions(score: number, errorRate: number, executions: number): string[] {
  const actions: string[] = [];
  
  if (score < 0.3) actions.push('個別指導の検討');
  if (errorRate > 0.3) actions.push('エラー対処法の指導');
  if (executions < 5) actions.push('基礎課題の追加');
  if (executions > 100) actions.push('発展課題の提供');
  
  return actions;
}

function identifyRiskStudents(students: StudentActivity[]) {
  return students.filter(student => {
    const executions = student.cellExecutions || 0;
    const errors = student.errorCount || 0;
    const errorRate = errors / Math.max(executions, 1);
    
    // リスク判定条件
    const lowActivity = executions < 3;
    const highErrorRate = errorRate > 0.5 && executions > 5;
    const helpRequesting = student.isRequestingHelp;
    const longInactive = student.status === 'idle';
    
    return lowActivity || highErrorRate || helpRequesting || longInactive;
  }).map(student => ({
    ...student,
    riskFactors: getRiskFactors(student)
  }));
}

function getRiskFactors(student: StudentActivity): string[] {
  const factors: string[] = [];
  const executions = student.cellExecutions || 0;
  const errors = student.errorCount || 0;
  const errorRate = errors / Math.max(executions, 1);
  
  if (executions < 3) factors.push('低活動');
  if (errorRate > 0.5 && executions > 5) factors.push('高エラー率');
  if (student.isRequestingHelp) factors.push('ヘルプ要請中');
  if (student.status === 'idle') factors.push('非アクティブ');
  
  return factors;
}

// ソート処理
function sortStudents(students: StudentActivity[], sortBy: string, sortOrder: 'asc' | 'desc') {
  const startTime = performance.now();
  
  const sorted = [...students].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.userName.localeCompare(b.userName);
        break;
      case 'executions':
        comparison = (a.cellExecutions || 0) - (b.cellExecutions || 0);
        break;
      case 'errors':
        comparison = (a.errorCount || 0) - (b.errorCount || 0);
        break;
      case 'errorRate':
        const aRate = (a.errorCount || 0) / Math.max(a.cellExecutions || 1, 1);
        const bRate = (b.errorCount || 0) / Math.max(b.cellExecutions || 1, 1);
        comparison = aRate - bRate;
        break;
      case 'team':
        comparison = (a.teamName || '').localeCompare(b.teamName || '');
        break;
      default:
        comparison = 0;
    }
    
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  const duration = performance.now() - startTime;
  console.log(`🔧 Worker: Sorted ${students.length} students by ${sortBy} in ${duration.toFixed(2)}ms`);
  
  return sorted;
}

// メッセージハンドラー
self.onmessage = function(e: MessageEvent<ProcessingTask>) {
  const { type, data, taskId } = e.data;
  const startTime = performance.now();
  
  try {
    let result: any;
    
    switch (type) {
      case 'FILTER_STUDENTS':
        result = filterStudents(data.students, data.filters);
        break;
      case 'CALCULATE_STATISTICS':
        result = calculateStatistics(data.students);
        break;
      case 'GENERATE_ANALYTICS':
        result = generateAnalytics(data.students);
        break;
      case 'SORT_STUDENTS':
        result = sortStudents(data.students, data.sortBy, data.sortOrder);
        break;
      default:
        throw new Error(`Unknown task type: ${type}`);
    }
    
    const duration = performance.now() - startTime;
    
    const response: ProcessingResult = {
      type,
      taskId,
      result,
      duration
    };
    
    self.postMessage(response);
    
  } catch (error) {
    const duration = performance.now() - startTime;
    
    const response: ProcessingResult = {
      type,
      taskId,
      result: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration
    };
    
    self.postMessage(response);
  }
};

export {};