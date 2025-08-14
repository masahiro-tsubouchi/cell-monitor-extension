/**
 * ドメインオブジェクトの厳密な型定義
 * instructor-dashboard の型安全性を向上させる基盤
 */

// 学生の状態を厳密に定義
export type StudentStatus = 'active' | 'idle' | 'error';
export type StudentHelpStatus = 'none' | 'requesting' | 'receiving';

// チーム優先度
export type TeamPriority = 'high' | 'medium' | 'low';

// 表示モード
export type ViewMode = 'grid' | 'team';

// 時間範囲
export type TimeRange = '1h' | '24h' | '7d';

/**
 * 改善されたStudentActivity型
 * - statusとhelpStatusを明確に分離
 * - teamNameをデフォルト値付きで必須化
 * - 型の一貫性を確保
 */
export interface StudentActivity {
  // 識別情報
  emailAddress: string;
  userName: string;
  teamName: string; // デフォルト: '未割り当て'

  // 活動状態
  status: StudentStatus;
  helpStatus: StudentHelpStatus;
  
  // 学習進捗
  currentNotebook: string;
  lastActivity: string;
  cellExecutions: number;
  errorCount: number;

  // 後方互換性のためのヘルパープロパティ
  get isRequestingHelp(): boolean;
}

/**
 * チーム統計情報
 */
export interface TeamStats {
  teamName: string;
  totalStudents: number;
  activeCount: number;
  idleCount: number;
  errorCount: number;
  helpCount: number;
  priority: TeamPriority;
  lastActivity: string;
}

/**
 * ダッシュボード全体のメトリクス
 */
export interface DashboardMetrics {
  totalStudents: number;
  totalActive: number;
  errorCount: number;
  totalExecutions: number;
  helpCount: number;
  lastUpdated?: Date;
}

/**
 * 活動チャートのデータポイント
 */
export interface ActivityTimePoint {
  time: string;
  executionCount: number;
  errorCount: number;
  helpCount: number;
}

/**
 * 学生詳細情報（拡張版）
 */
export interface StudentDetailData extends StudentActivity {
  // 実行履歴
  recentExecutions: {
    cellId: string;
    timestamp: string;
    code: string;
    output?: string;
    error?: string;
  }[];
  
  // セッション情報
  sessionStartTime: string;
  totalSessionTime: number;
  
  // ノートブック履歴
  notebookHistory: {
    notebook: string;
    accessTime: string;
    duration: number;
  }[];
}

/**
 * 講師設定
 */
export interface InstructorSettings {
  instructorId: string;
  viewMode: ViewMode;
  autoRefresh: boolean;
  refreshInterval: number;
  expandedTeams: string[];
  selectedStudent: string | null;
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
    soundAlerts: boolean;
  };
}

/**
 * API レスポンス型
 */
export interface DashboardOverview {
  students: StudentActivity[];
  metrics: DashboardMetrics;
  activityChart: ActivityTimePoint[];
  timestamp: string;
}

/**
 * 型ガード関数
 */
export const isValidStudentStatus = (status: string): status is StudentStatus => {
  return ['active', 'idle', 'error'].includes(status);
};

export const isValidHelpStatus = (status: string): status is StudentHelpStatus => {
  return ['none', 'requesting', 'receiving'].includes(status);
};

export const isValidViewMode = (mode: string): mode is ViewMode => {
  return ['grid', 'team'].includes(mode);
};

/**
 * デフォルト値
 */
export const DEFAULT_TEAM_NAME = '未割り当て';
export const DEFAULT_REFRESH_INTERVAL = 15000; // 15秒
export const DEFAULT_INSTRUCTOR_SETTINGS: Omit<InstructorSettings, 'instructorId'> = {
  viewMode: 'team',
  autoRefresh: true,
  refreshInterval: DEFAULT_REFRESH_INTERVAL,
  expandedTeams: [],
  selectedStudent: null,
  preferences: {
    theme: 'light',
    notifications: true,
    soundAlerts: false,
  },
};

/**
 * StudentActivity の後方互換性ヘルパー
 */
export const createStudentActivity = (data: any): StudentActivity => {
  const baseActivity: StudentActivity = {
    emailAddress: data.emailAddress || '',
    userName: data.userName || '',
    teamName: data.teamName || DEFAULT_TEAM_NAME,
    status: isValidStudentStatus(data.status) ? data.status : 'idle',
    helpStatus: data.isRequestingHelp ? 'requesting' : 'none',
    currentNotebook: data.currentNotebook || '',
    lastActivity: data.lastActivity || '不明',
    cellExecutions: data.cellExecutions || 0,
    errorCount: data.errorCount || 0,
    get isRequestingHelp() {
      return this.helpStatus === 'requesting' || this.helpStatus === 'receiving';
    },
  };

  return baseActivity;
};

/**
 * チーム統計計算ヘルパー
 */
export const calculateTeamStats = (students: StudentActivity[]): TeamStats[] => {
  const teamMap = new Map<string, StudentActivity[]>();

  // チーム別にグループ化
  students.forEach(student => {
    const teamName = student.teamName || DEFAULT_TEAM_NAME;
    if (!teamMap.has(teamName)) {
      teamMap.set(teamName, []);
    }
    teamMap.get(teamName)!.push(student);
  });

  // チーム統計を計算
  return Array.from(teamMap.entries()).map(([teamName, teamStudents]) => {
    const activeCount = teamStudents.filter(s => s.status === 'active').length;
    const idleCount = teamStudents.filter(s => s.status === 'idle').length;
    const errorCount = teamStudents.filter(s => s.status === 'error').length;
    const helpCount = teamStudents.filter(s => s.helpStatus !== 'none').length;

    // 優先度計算
    let priority: TeamPriority = 'low';
    if (errorCount > 0 || helpCount > 0) {
      priority = 'high';
    } else if (idleCount > activeCount) {
      priority = 'medium';
    }

    // 最新活動時刻
    const lastActivity = teamStudents.reduce((latest, student) => {
      if (student.lastActivity && student.lastActivity !== '不明') {
        return student.lastActivity; // 簡略化
      }
      return latest;
    }, '不明');

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
  });
};