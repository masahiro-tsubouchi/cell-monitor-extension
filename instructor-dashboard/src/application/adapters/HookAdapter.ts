/**
 * Hook Adapter
 * 既存のReact Hooksと新しいClean Architectureの橋渡し
 * 段階的移行のための互換層
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardService } from '../services/DashboardService';
import { DashboardDataStore } from '../stores/DashboardDataStore';
import { DashboardUIStore } from '../stores/DashboardUIStore';
import { LegacyDomainBridge, DomainToLegacyAdapter } from './LegacyAdapter';
import { get } from '../di/DIContainer';
import { TOKENS } from '../di/tokens';

// 既存のhook型定義
import { 
  StudentActivity as LegacyStudentActivity,
  DashboardMetrics as LegacyDashboardMetrics,
  ActivityTimePoint as LegacyActivityTimePoint,
  DashboardOverview as LegacyDashboardOverview
} from '../../types/domain';

// 拡張型定義
interface ExtendedStudentActivity extends Omit<LegacyStudentActivity, 'status'> {
  status: 'active' | 'idle' | 'error' | 'help';
}

/**
 * 既存のuseProgressDashboardと互換性のあるhook
 * 内部的には新しいアーキテクチャを使用
 */
export interface UseProgressDashboardReturn {
  // データ
  students: ExtendedStudentActivity[];
  metrics: LegacyDashboardMetrics | null;
  activityChart: LegacyActivityTimePoint[];
  
  // 状態
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  
  // UI状態
  selectedStudent: ExtendedStudentActivity | null;
  viewMode: 'grid' | 'team';
  expandedTeams: string[];
  
  // アクション
  refreshData: (forceRefresh?: boolean) => Promise<void>;
  selectStudent: (emailAddress: string) => void;
  clearSelectedStudent: () => void;
  setViewMode: (mode: 'grid' | 'team') => void;
  toggleTeamExpanded: (teamName: string) => void;
  
  // フィルタリング
  filteredStudents: ExtendedStudentActivity[];
  setFilter: (filter: {
    status?: 'all' | 'active' | 'idle' | 'error' | 'help';
    team?: string | null;
    searchQuery?: string;
  }) => void;
}

/**
 * 後方互換性のあるProgressDashboard Hook
 */
export function useProgressDashboard(): UseProgressDashboardReturn {
  // 新しいアーキテクチャのサービスとストアを取得
  const dashboardService = get(TOKENS.DASHBOARD_SERVICE);
  const dataStore = get(TOKENS.DASHBOARD_DATA_STORE);
  const uiStore = get(TOKENS.DASHBOARD_UI_STORE);

  // レガシー形式の状態
  const [legacyState, setLegacyState] = useState<{
    students: ExtendedStudentActivity[];
    metrics: LegacyDashboardMetrics | null;
    activityChart: LegacyActivityTimePoint[];
    selectedStudent: ExtendedStudentActivity | null;
    loading: boolean;
    error: string | null;
    lastUpdated: Date | null;
  }>({
    students: [],
    metrics: null,
    activityChart: [],
    selectedStudent: null,
    loading: false,
    error: null,
    lastUpdated: null
  });

  // UI状態の購読
  const [uiState, setUIState] = useState(() => uiStore.getState());

  // フィルタリング用の状態
  const [filter, setFilterState] = useState({
    status: 'all' as 'all' | 'active' | 'idle' | 'error' | 'help',
    team: null as string | null,
    searchQuery: ''
  });

  // データストアの変更を購読
  useEffect(() => {
    const unsubscribeData = dataStore.subscribe((dataState) => {
      // Domain entitiesをlegacy形式に変換
      const students = DomainToLegacyAdapter.studentsToStudentActivities(dataState.students);
      const metrics = dataState.metrics ? DomainToLegacyAdapter.metricsToLegacyMetrics(dataState.metrics) : null;
      const activityChart = DomainToLegacyAdapter.activityPointsToLegacyPoints(dataState.activityHistory);
      
      // 選択された学生の取得
      const selectedStudent = dataState.selectedStudentId 
        ? students.find(s => s.emailAddress === dataState.selectedStudentId) || null
        : null;

      setLegacyState({
        students,
        metrics,
        activityChart,
        selectedStudent,
        loading: dataState.loading,
        error: dataState.error,
        lastUpdated: dataState.lastUpdated
      });
    });

    const unsubscribeUI = uiStore.subscribe(setUIState);

    return () => {
      unsubscribeData();
      unsubscribeUI();
    };
  }, [dataStore, uiStore]);

  // 初期化
  useEffect(() => {
    dashboardService.initialize().catch(error => {
      console.error('Failed to initialize dashboard:', error);
    });
  }, [dashboardService]);

  // フィルタリング済み学生リスト
  const filteredStudents = useMemo(() => {
    let filtered = legacyState.students;

    // ステータスフィルタ
    if (filter.status !== 'all') {
      filtered = filtered.filter(student => student.status === filter.status);
    }

    // チームフィルタ
    if (filter.team) {
      filtered = filtered.filter(student => student.teamName === filter.team);
    }

    // 検索クエリフィルタ
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      filtered = filtered.filter(student => 
        student.userName.toLowerCase().includes(query) ||
        student.emailAddress.toLowerCase().includes(query) ||
        (student.teamName && student.teamName.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [legacyState.students, filter]);

  // アクション関数
  const refreshData = useCallback(async (forceRefresh: boolean = false) => {
    try {
      await dashboardService.refreshData(forceRefresh);
    } catch (error) {
      console.error('Failed to refresh dashboard data:', error);
    }
  }, [dashboardService]);

  const selectStudent = useCallback((emailAddress: string) => {
    const studentId = emailAddress; // emailAddressをIDとして使用
    dashboardService.selectStudent(studentId as any);
    uiStore.setSelectedStudentId(studentId as any);
  }, [dashboardService, uiStore]);

  const clearSelectedStudent = useCallback(() => {
    dashboardService.clearSelectedStudent();
    uiStore.setSelectedStudentId(null);
  }, [dashboardService, uiStore]);

  const setViewMode = useCallback((mode: 'grid' | 'team') => {
    uiStore.setViewMode(mode);
  }, [uiStore]);

  const toggleTeamExpanded = useCallback((teamName: string) => {
    uiStore.toggleTeamExpanded(teamName);
  }, [uiStore]);

  const setFilter = useCallback((newFilter: {
    status?: 'all' | 'active' | 'idle' | 'error' | 'help';
    team?: string | null;
    searchQuery?: string;
  }) => {
    setFilterState(prev => ({ ...prev, ...newFilter }));
  }, []);

  return {
    // データ
    students: legacyState.students,
    metrics: legacyState.metrics,
    activityChart: legacyState.activityChart,
    
    // 状態
    loading: legacyState.loading,
    error: legacyState.error,
    lastUpdated: legacyState.lastUpdated,
    
    // UI状態
    selectedStudent: legacyState.selectedStudent,
    viewMode: uiState.viewMode,
    expandedTeams: Array.from(uiState.expandedTeams),
    
    // アクション
    refreshData,
    selectStudent,
    clearSelectedStudent,
    setViewMode,
    toggleTeamExpanded,
    
    // フィルタリング
    filteredStudents,
    setFilter
  };
}

/**
 * 特定の学生データを取得するhook（既存互換）
 */
export function useStudentData(emailAddress: string | null) {
  const { students } = useProgressDashboard();
  
  return useMemo(() => {
    if (!emailAddress) return null;
    return students.find(student => student.emailAddress === emailAddress) || null;
  }, [students, emailAddress]);
}

/**
 * チーム統計を取得するhook（既存互換）
 */
export function useTeamStats() {
  const { students } = useProgressDashboard();
  
  return useMemo(() => {
    const teamMap = new Map<string, ExtendedStudentActivity[]>();
    
    students.forEach(student => {
      const teamName = student.teamName || '未割り当て';
      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, []);
      }
      teamMap.get(teamName)!.push(student);
    });

    return Array.from(teamMap.entries()).map(([teamName, teamStudents]) => ({
      teamName,
      totalStudents: teamStudents.length,
      activeCount: teamStudents.filter(s => s.status === 'active').length,
      idleCount: teamStudents.filter(s => s.status === 'idle').length,
      errorCount: teamStudents.filter(s => s.status === 'error').length,
      helpCount: teamStudents.filter(s => s.isRequestingHelp).length,
      priority: 'medium' as const, // 簡略化
      lastActivity: '不明'
    }));
  }, [students]);
}

/**
 * パフォーマンス監視hook（新機能）
 */
export function useDashboardPerformance() {
  const dashboardService = get(TOKENS.DASHBOARD_SERVICE);
  
  const [performanceMetrics, setPerformanceMetrics] = useState({
    loadTime: 0,
    refreshCount: 0,
    errorCount: 0,
    lastRefresh: null as Date | null
  });

  useEffect(() => {
    const startTime = Date.now();
    
    return () => {
      const loadTime = Date.now() - startTime;
      setPerformanceMetrics(prev => ({
        ...prev,
        loadTime
      }));
    };
  }, []);

  const trackRefresh = useCallback(() => {
    setPerformanceMetrics(prev => ({
      ...prev,
      refreshCount: prev.refreshCount + 1,
      lastRefresh: new Date()
    }));
  }, []);

  const trackError = useCallback(() => {
    setPerformanceMetrics(prev => ({
      ...prev,
      errorCount: prev.errorCount + 1
    }));
  }, []);

  return {
    performanceMetrics,
    trackRefresh,
    trackError
  };
}

/**
 * リアルタイム更新の管理hook（新機能）
 */
export function useRealtimeUpdates() {
  const uiStore = get(TOKENS.DASHBOARD_UI_STORE);
  const { refreshData } = useProgressDashboard();
  
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!uiStore.isAutoRefresh()) return;

    const interval = setInterval(() => {
      refreshData(false);
    }, uiStore.getRefreshInterval());

    setIsConnected(true);

    return () => {
      clearInterval(interval);
      setIsConnected(false);
    };
  }, [uiStore, refreshData]);

  return {
    isConnected,
    refreshInterval: uiStore.getRefreshInterval(),
    autoRefresh: uiStore.isAutoRefresh()
  };
}