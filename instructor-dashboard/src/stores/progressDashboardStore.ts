import { create } from 'zustand';
import { dashboardAPI, StudentActivity, DashboardMetrics, ActivityTimePoint } from '../services/dashboardAPI';
import { getInstructorSettings } from '../utils/instructorStorage';

interface ProgressDashboardState {
  // Data
  students: StudentActivity[];
  metrics: DashboardMetrics;
  activityChart: ActivityTimePoint[];

  // UI State
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  autoRefresh: boolean;
  selectedStudent: StudentActivity | null;

  // Actions
  refreshData: () => Promise<void>;
  updateStudentsIncremental: (updates: StudentActivity[]) => void;
  setAutoRefresh: (enabled: boolean) => void;
  selectStudent: (student: StudentActivity | null) => void;
  updateStudentStatus: (emailAddress: string, updates: Partial<StudentActivity>) => void;
  clearError: () => void;
}

export const useProgressDashboardStore = create<ProgressDashboardState>((set, get) => ({
  // Initial state
  students: [],
  metrics: {
    totalStudents: 0,
    totalActive: 0,
    errorCount: 0,
    totalExecutions: 0,
    helpCount: 0
  },
  activityChart: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  autoRefresh: (() => {
    try {
      const settings = getInstructorSettings();
      return settings.autoRefresh;
    } catch {
      return true;
    }
  })(),
  selectedStudent: null,

  // Refresh dashboard data
  refreshData: async () => {
    const currentState = get();
    if (currentState.isLoading) return; // Prevent concurrent requests

    // 最後の更新から5秒以内なら重複リクエストを防止
    const now = new Date();
    if (currentState.lastUpdated) {
      const timeSinceLastUpdate = now.getTime() - currentState.lastUpdated.getTime();
      if (timeSinceLastUpdate < 5000) {
        console.log('Recent update detected, skipping refresh');
        return;
      }
    }

    try {
      set({ isLoading: true, error: null });

      const data = await dashboardAPI.getDashboardOverview();

      set({
        students: data.students,
        metrics: data.metrics,
        activityChart: data.activityChart,
        isLoading: false,
        lastUpdated: new Date(),
        error: null
      });

      console.log('Progress dashboard data refreshed:', data);
    } catch (error) {
      console.error('Failed to refresh progress dashboard data:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'データの取得に失敗しました'
      });
    }
  },

  // Incremental update for students (preserves UI state)
  updateStudentsIncremental: (updates: StudentActivity[]) => {
    const currentState = get();
    const updatedStudents = [...currentState.students];

    // Apply updates by merging with existing student data
    updates.forEach(update => {
      const index = updatedStudents.findIndex(s => s.emailAddress === update.emailAddress);
      if (index >= 0) {
        // Update existing student
        updatedStudents[index] = { ...updatedStudents[index], ...update };
      } else {
        // Add new student
        updatedStudents.push(update);
      }
    });

    // Recalculate metrics
    const newMetrics: DashboardMetrics = {
      totalStudents: updatedStudents.length,
      totalActive: updatedStudents.filter(s => s.status === 'active').length,
      errorCount: updatedStudents.filter(s => s.status === 'error').length,
      totalExecutions: updatedStudents.reduce((sum, s) => sum + (s.cellExecutions || 0), 0),
      helpCount: updatedStudents.filter(s => s.isRequestingHelp).length
    };

    set({
      students: updatedStudents,
      metrics: newMetrics,
      lastUpdated: new Date()
    });

    console.log(`差分更新完了: ${updates.length}名の学生データを更新`);
  },

  // Toggle auto refresh
  setAutoRefresh: (enabled: boolean) => {
    set({ autoRefresh: enabled });
  },

  // Select student for detailed view
  selectStudent: (student: StudentActivity | null) => {
    set({ selectedStudent: student });
  },

  // Update specific student status (for WebSocket updates)
  updateStudentStatus: (emailAddress: string, updates: Partial<StudentActivity>) => {
    const currentState = get();
    const updatedStudents = currentState.students.map(student =>
      student.emailAddress === emailAddress
        ? { ...student, ...updates }
        : student
    );

    // Recalculate metrics (keep original helpCount from server)
    const currentMetrics = get().metrics;
    const newMetrics: DashboardMetrics = {
      totalStudents: updatedStudents.length,
      totalActive: updatedStudents.filter(s => s.status === 'active').length,
      errorCount: updatedStudents.filter(s => s.status === 'error').length,
      totalExecutions: updatedStudents.reduce((sum, s) => sum + s.cellExecutions, 0),
      helpCount: currentMetrics.helpCount // Preserve help count from server
    };

    set({
      students: updatedStudents,
      metrics: newMetrics,
      lastUpdated: new Date()
    });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  }
}));
