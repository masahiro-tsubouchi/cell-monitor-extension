/**
 * 活動スコア状態判定ユーティリティ
 * 数値スコア(0-100点)を4段階の直感的な状態表示に変換
 */

import { StudentActivity } from '../services/dashboardAPI';

export interface ActivityStatus {
  status: 'good' | 'warning' | 'stopped' | 'error';
  label: string;
  priority: 1 | 2 | 3 | 4; // 1=最低, 4=最高
  color: 'success' | 'warning' | 'error';
  bgColor: string;
}

/**
 * 活動スコアと学生データから最終状態を判定
 */
export const getActivityStatus = (
  score: number, 
  student: StudentActivity
): ActivityStatus => {
  // 🚨 ヘルプ要請中は最優先で赤色表示
  if (student.isRequestingHelp) {
    return {
      status: 'error',
      label: 'エラーがたくさん出てる',
      priority: 4,
      color: 'error',
      bgColor: '#ffebee'
    };
  }
  
  // 🔥 高エラー率かつ低スコアは緊急
  const errorRate = student.errorCount / Math.max(student.cellExecutions, 1);
  if (errorRate > 0.3 && score < 30) {
    return {
      status: 'error',
      label: 'エラーがたくさん出てる',
      priority: 4,
      color: 'error',
      bgColor: '#ffebee'
    };
  }
  
  // 📊 スコア範囲による4段階判定
  if (score >= 70) {
    return {
      status: 'good',
      label: '問題なし',
      priority: 1,
      color: 'success',
      bgColor: '#e8f5e8'
    };
  } else if (score >= 40) {
    return {
      status: 'warning',
      label: '手が止まってしまい',
      priority: 2,
      color: 'warning',
      bgColor: '#fffbf0'
    };
  } else if (score >= 20) {
    return {
      status: 'stopped',
      label: '完全に停止してしまってる',
      priority: 3,
      color: 'warning',
      bgColor: '#fff3e0'
    };
  } else {
    return {
      status: 'error',
      label: 'エラーがたくさん出てる',
      priority: 4,
      color: 'error',
      bgColor: '#ffebee'
    };
  }
};

/**
 * チップ表示用の色を取得
 */
export const getChipColor = (status: ActivityStatus['status']) => {
  const colorMap = {
    good: 'success',
    warning: 'warning',
    stopped: 'warning',
    error: 'error'
  } as const;
  
  return colorMap[status];
};

/**
 * 活動スコア計算（既存ロジック）
 * useOptimizedStudentList.tsから移植予定
 */
export const calculateActivityScore = (student: StudentActivity): number => {
  let score = 0;
  
  // 1️⃣ セル実行回数スコア (0-40点)
  score += Math.min(student.cellExecutions || 0, 40);
  
  // 2️⃣ 最新活動スコア (0-30点) - 時間経過による減点
  const activityBonus = getActivityBonus(student.lastActivity);
  score += activityBonus;
  
  // 3️⃣ エラー率ペナルティ (-20-0点)
  const errorRate = student.errorCount / Math.max(student.cellExecutions || 1, 1);
  score -= Math.min(errorRate * 20, 20);
  
  // 4️⃣ ヘルプ要請ボーナス (+10点)
  if (student.isRequestingHelp) {
    score += 10;
  }
  
  return Math.max(0, Math.min(100, score));
};

/**
 * 最終活動時刻からボーナス点数を計算
 */
const getActivityBonus = (lastActivity: string): number => {
  if (lastActivity === '今') return 30;                    // 現在活動中
  if (lastActivity.includes('分前')) {
    const minutes = parseInt(lastActivity) || 0;
    return Math.max(0, 30 - minutes);                      // 1分前=29点, 30分前=0点
  }
  if (lastActivity.includes('時間前')) return 5;           // 時間単位は低スコア
  return 0;                                                // それ以外は0点
};

/**
 * 優先度順ソート（支援が必要な学生を上位表示）
 */
export const sortByPriority = (students: StudentActivity[]) => {
  return students.sort((a, b) => {
    const statusA = getActivityStatus(calculateActivityScore(a), a);
    const statusB = getActivityStatus(calculateActivityScore(b), b);
    return statusB.priority - statusA.priority;
  });
};

/**
 * 活動状態によるフィルター
 */
export const filterByActivityStatus = (
  students: StudentActivity[], 
  selectedStatuses: string[]
) => {
  return students.filter(student => {
    const status = getActivityStatus(calculateActivityScore(student), student);
    return selectedStatuses.includes(status.status);
  });
};