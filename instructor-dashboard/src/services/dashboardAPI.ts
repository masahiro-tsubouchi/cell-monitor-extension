import axios from 'axios';
import { ENV } from '../config/environment';

export const API_BASE_URL = ENV.apiBaseUrl;

export interface StudentActivity {
  emailAddress: string;  // メールアドレス（ユーザー識別子）
  userName: string;
  teamName?: string;  // チーム名
  currentNotebook: string;
  lastActivity: string;
  status: 'active' | 'idle' | 'error' | 'help' | 'significant_error';  // 連続エラー対応
  isRequestingHelp?: boolean;
  cellExecutions: number;
  errorCount: number;
  // 連続エラー検出機能追加
  consecutiveErrorCount?: number;
  hasSignificantError?: boolean;
  significantErrorCells?: Array<{
    cell_id: number;
    consecutive_count: number;
    last_error_time: string;
  }>;
}

export interface DashboardMetrics {
  totalActive: number;
  totalStudents: number;
  errorCount: number;
  significantErrorCount?: number;  // 連続エラー検出対応
  totalExecutions: number;
  helpCount: number;
}

export interface ActivityTimePoint {
  time: string;
  executionCount: number;
  errorCount: number;
  helpCount: number;
}

export interface DashboardOverview {
  students: StudentActivity[];
  metrics: DashboardMetrics;
  activityChart: ActivityTimePoint[];
}

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const dashboardAPI = {
  /**
   * Get dashboard overview data
   */
  async getDashboardOverview(): Promise<DashboardOverview> {
    try {
      console.log('Fetching real dashboard data from:', `${API_BASE_URL}/dashboard/overview`);
      const response = await api.get('/dashboard/overview');
      console.log('Real dashboard data received:', response.data);

      // Validate response structure
      if (!response.data || !response.data.students) {
        console.warn('Invalid response structure, using mock data as fallback');
        return this.getMockDashboardData();
      }

      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch dashboard overview:', error);
      console.error('Error details:', {
        message: error?.message,
        status: error?.response?.status,
        url: error?.config?.url
      });

      // Only use mock data for severe network issues
      if (error?.code === 'ECONNREFUSED' || error?.code === 'NETWORK_ERROR') {
        console.warn('Server completely unavailable, using mock data as emergency fallback');
        return this.getMockDashboardData();
      }

      // For server errors, try to rethrow to show user the issue
      if (error?.response?.status >= 500) {
        console.error('Server error occurred:', error.response.status);
        throw new Error(`サーバーエラーが発生しました (${error.response.status})`);
      }

      // For other errors, rethrow to alert user
      console.error('API error occurred:', error?.message || 'Unknown error');
      throw new Error('データの取得に失敗しました。ネットワーク接続を確認してください。');
    }
  },

  /**
   * Get student activity details
   */
  async getStudentActivity(emailAddress: string) {
    try {
      const response = await api.get(`/dashboard/students/${encodeURIComponent(emailAddress)}/activity`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch student activity:', error);
      throw new Error('学生の活動データの取得に失敗しました');
    }
  },

  /**
   * Get class metrics for specific time range
   */
  async getClassMetrics(timeRange: '1h' | '24h' | '7d' = '1h') {
    try {
      const response = await api.get(`/dashboard/metrics?range=${timeRange}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch class metrics:', error);
      throw new Error('クラスメトリクスの取得に失敗しました');
    }
  },

  /**
   * Dismiss help request for a specific student
   */
  async dismissHelpRequest(emailAddress: string) {
    try {
      console.log('Dismissing help request for student:', emailAddress);
      const response = await api.post(`/dashboard/students/${encodeURIComponent(emailAddress)}/dismiss-help`);
      console.log('Help request dismissed successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to dismiss help request:', error);
      throw new Error('対応完了の記録に失敗しました');
    }
  },

  /**
   * Resolve consecutive error status for a specific student
   */
  async resolveStudentError(emailAddress: string) {
    try {
      console.log('Resolving error status for student:', emailAddress);
      const response = await api.post(`/dashboard/students/${encodeURIComponent(emailAddress)}/resolve-error`);
      console.log('Error status resolved successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to resolve error status:', error);
      throw new Error('エラー状態の解除に失敗しました');
    }
  },

  /**
   * Mock data for development/fallback
   */
  getMockDashboardData(): DashboardOverview {
    const now = new Date();

    const mockStudents: StudentActivity[] = [
      {
        emailAddress: 'tanaka@example.com',
        userName: '田中太郎',
        teamName: 'チームA',
        currentNotebook: '/assignments/python_basic.ipynb',
        lastActivity: '2秒前',
        status: 'active',
        cellExecutions: 15,
        errorCount: 1
      },
      {
        emailAddress: 'sato@example.com',
        userName: '佐藤花子',
        teamName: 'チームA',
        currentNotebook: '/assignments/data_analysis.ipynb',
        lastActivity: '5分前',
        status: 'idle',
        cellExecutions: 8,
        errorCount: 0
      },
      {
        emailAddress: 'yamada@example.com',
        userName: '山田次郎',
        teamName: 'チームB',
        currentNotebook: '/assignments/loops_practice.ipynb',
        lastActivity: '1分前',
        status: 'help',
        isRequestingHelp: true,
        cellExecutions: 3,
        errorCount: 1
      },
      {
        emailAddress: 'suzuki@example.com',
        userName: '鈴木一郎',
        teamName: 'チームB',
        currentNotebook: '/assignments/python_basic.ipynb',
        lastActivity: '1分前',
        status: 'active',
        cellExecutions: 12,
        errorCount: 0
      },
      {
        emailAddress: 'takahashi@example.com',
        userName: '高橋美咲',
        teamName: 'チームC',
        currentNotebook: '/assignments/data_analysis.ipynb',
        lastActivity: '30秒前',
        status: 'active',
        cellExecutions: 20,
        errorCount: 2
      }
    ];

    const mockMetrics: DashboardMetrics = {
      totalStudents: mockStudents.length,
      totalActive: mockStudents.filter(s => s.status === 'active').length,
      errorCount: mockStudents.filter(s => s.status === 'error').length,
      totalExecutions: mockStudents.reduce((sum, s) => sum + s.cellExecutions, 0),
      helpCount: Math.floor(Math.random() * 5) + 1
    };

    // Generate mock activity chart data for last hour
    const mockActivityChart: ActivityTimePoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 5 * 60 * 1000);
      mockActivityChart.push({
        time: time.toISOString(),
        executionCount: Math.floor(Math.random() * 10) + 5,
        errorCount: Math.floor(Math.random() * 3),
        helpCount: Math.floor(Math.random() * 2)
      });
    }

    return {
      students: mockStudents,
      metrics: mockMetrics,
      activityChart: mockActivityChart
    };
  }
};

export default dashboardAPI;
