/**
 * Progress Dashboard
 * 高性能ダッシュボード（旧最適化版を標準化）
 */

import React, { useEffect, useRef, useMemo, useCallback, useState, memo } from 'react';
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  Alert,
  Fab,
  Switch,
  FormControlLabel,
  Divider,
  Button,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  AutoMode as AutoIcon,
  List as ListIcon,
  ViewModule as GridIcon,
  Group as TeamIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useProgressDashboardStore } from '../stores/progressDashboardStore';
import { OptimizedTeamGrid } from '../components/optimized/OptimizedTeamGrid';
import { VirtualizedStudentList } from '../components/virtualized/VirtualizedStudentList';
import {
  OptimizedActivityChart,
  OptimizedTeamMapView,
  OptimizedStudentDetailModal,
  VisibilityBasedLoader,
  SkeletonLoader
} from '../components/lazy/LazyComponentLoader';
import { CriticalAlertBar } from '../components/enhanced/AlertSystem';
import { KeyboardShortcutsHelp } from '../components/enhanced/KeyboardHelp';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { StudentActivity, dashboardAPI } from '../services/dashboardAPI';
import { useNavigate } from 'react-router-dom';
import {
  getInstructorSettings,
  updateViewMode,
  updateAutoRefresh,
  updateSelectedStudent
} from '../utils/instructorStorage';
import { DashboardViewMode, getViewModeLabel } from '../types/dashboard';
import { useDashboardLogic } from '../hooks/useDashboardLogic';
import { useWebSocketManager } from '../hooks/useWebSocketManager';

// メモ化されたヘッダーコンポーネント
const DashboardHeader = memo<{
  autoRefresh: boolean;
  expandedTeamsCount: number;
  onAutoRefreshToggle: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenAdmin: () => void;
}>(({ autoRefresh, expandedTeamsCount, onAutoRefreshToggle, onOpenAdmin }) => (
  <Box sx={{ mb: 4 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          📚 学習進捗ダッシュボード
        </Typography>
        <Typography variant="body1" color="text.secondary">
          受講生のJupyterLab学習活動をリアルタイムで監視
        </Typography>
        {autoRefresh && (
          <Typography variant="caption" color="primary" sx={{ mt: 0.5, display: 'block' }}>
            📡 スマート更新: {expandedTeamsCount > 0 ? '5秒間隔（詳細監視）' : '15秒間隔（概要監視）'}
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={autoRefresh}
              onChange={onAutoRefreshToggle}
              icon={<AutoIcon />}
              checkedIcon={<AutoIcon />}
            />
          }
          label="自動更新"
        />
        <Button
          variant="outlined"
          onClick={onOpenAdmin}
          sx={{ 
            minWidth: 'auto',
            padding: '8px 12px'
          }}
          size="small"
        >
          <SettingsIcon sx={{ fontSize: '1.5rem' }} />
        </Button>
      </Box>
    </Box>
  </Box>
));

DashboardHeader.displayName = 'DashboardHeader';

// メモ化されたビューモードコントロール
const ViewModeControls = memo<{
  viewMode: DashboardViewMode;
  studentsCount: number;
  onViewModeChange: (mode: DashboardViewMode) => void;
}>(({ viewMode, studentsCount, onViewModeChange }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
    <Typography variant="h6" component="h2" fontWeight="bold">
      👥 受講生一覧 ({studentsCount}名) - {getViewModeLabel(viewMode)}
    </Typography>

    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <ToggleButtonGroup
        value={viewMode}
        exclusive
        onChange={(_, mode) => mode && onViewModeChange(mode)}
        size="small"
      >
        <ToggleButton value="team">
          <TeamIcon sx={{ mr: 1 }} />
          チーム表示
        </ToggleButton>
        <ToggleButton value="grid">
          <GridIcon sx={{ mr: 1 }} />
          チームグリッド
        </ToggleButton>
        <ToggleButton value="virtualized">
          <ListIcon sx={{ mr: 1 }} />
          仮想リスト
        </ToggleButton>
      </ToggleButtonGroup>

    </Box>
  </Box>
));

ViewModeControls.displayName = 'ViewModeControls';

// getViewModeLabel関数は../types/dashboardからインポート済み

// メモ化されたパフォーマンス統計表示
const PerformanceStats = memo<{
  workerStats: any;
  renderStats: any;
}>(({ workerStats, renderStats }) => {
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <Box sx={{ mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
      <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block' }}>
        🔧 パフォーマンス統計:
      </Typography>
      <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block' }}>
        Worker: {workerStats.completedTasks}タスク完了, 平均{workerStats.averageProcessingTime.toFixed(1)}ms
      </Typography>
      <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block' }}>
        レンダリング: 最適化済みコンポーネント数 {renderStats.optimizedComponents}
      </Typography>
    </Box>
  );
});

PerformanceStats.displayName = 'PerformanceStats';

export const ProgressDashboard: React.FC = () => {
  const navigate = useNavigate();

  // 講師別設定を初期化
  const [viewMode, setViewMode] = useState<DashboardViewMode>(() => {
    const settings = getInstructorSettings();
    return settings.viewMode === 'grid' ? 'grid' : 'team';
  });

  const [expandedTeamsCount, setExpandedTeamsCount] = useState<number>(0);

  // Store から状態取得
  const {
    students,
    activityChart,
    isLoading,
    error,
    autoRefresh,
    selectedStudent,
    refreshData,
    setAutoRefresh,
    selectStudent,
    updateStudentStatus,
    clearError,
    markUserActive,
    flushQueuedUpdates
  } = useProgressDashboardStore();



  // 共通ダッシュボードロジック
  const dashboardLogic = useDashboardLogic();
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // コンポーネントマウント時にデータ読み込み
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // ユーザーインタラクション検出（共通ロジック使用）
  useEffect(() => {
    return dashboardLogic.setupUserInteractionDetection(markUserActive);
  }, [dashboardLogic, markUserActive]);

  // 統一WebSocketマネージャー設定（WebSocket接続一元化）
  const _webSocketManager = useWebSocketManager({
    // 学生進捗更新ハンドラー
    onStudentProgressUpdate: (data: StudentActivity) => {
      updateStudentStatus(data.emailAddress, {
        userName: data.userName,
        currentNotebook: data.currentNotebook,
        lastActivity: data.lastActivity,
        status: data.status,
        cellExecutions: (data.cellExecutions || 1),
        errorCount: data.errorCount
      });
    },
    
    // セル実行イベントハンドラー
    onCellExecution: (data: any) => {
      updateStudentStatus(data.emailAddress, {
        cellExecutions: (data.cellExecutions || 1),
        lastActivity: '今',
        status: 'active' as const
      });
    },
    
    // ヘルプ要請ハンドラー
    onHelpRequest: (data: any) => {
      updateStudentStatus(data.emailAddress, {
        isRequestingHelp: true,
        lastActivity: '今',
        status: 'help' as any
      });
      // 即座にフル更新で精度を確保
      setTimeout(() => refreshData(), 100);
    },
    
    // ヘルプ解決ハンドラー
    onHelpResolved: (data: any) => {
      updateStudentStatus(data.emailAddress, {
        isRequestingHelp: false,
        lastActivity: '今'
      });
      // 即座にフル更新
      setTimeout(() => refreshData(), 100);
    },
    
    // 接続状態変化ハンドラー
    onConnectionChange: (state: string) => {
    },
    
    // エラーハンドラー
    onError: (error: any) => {
    }
  });

  // 自動リフレッシュ設定（共通ロジック使用）
  useEffect(() => {
    return dashboardLogic.setupAutoRefresh(
      autoRefresh,
      expandedTeamsCount,
      refreshData,
      refreshIntervalRef
    );
  }, [dashboardLogic, autoRefresh, expandedTeamsCount, refreshData]);

  // イベントハンドラー（メモ化）
  const handleStudentClick = useCallback((student: StudentActivity) => {
    selectStudent(student);
    updateSelectedStudent(student.emailAddress);
  }, [selectStudent]);

  const handleRefresh = useCallback(() => {
    flushQueuedUpdates();
    refreshData();
  }, [flushQueuedUpdates, refreshData]);

  const handleAutoRefreshToggle = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newAutoRefresh = event.target.checked;
    setAutoRefresh(newAutoRefresh);
    updateAutoRefresh(newAutoRefresh);
  }, [setAutoRefresh]);


  const handleViewModeChange = useCallback((newViewMode: DashboardViewMode) => {
    setViewMode(newViewMode);
    updateViewMode(newViewMode as any);
  }, []);


  const handleOpenAdmin = useCallback(() => {
    navigate('/admin');
  }, [navigate]);

  const handleHelpFocus = useCallback((student: StudentActivity) => {
    handleStudentClick(student);
    // スムーズスクロールで学生カードに移動
    setTimeout(() => {
      const element = document.querySelector(`[data-student-id="${student.emailAddress}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }, [handleStudentClick]);

  // エラー学生クリックハンドラー
  const handleErrorStudentClick = useCallback((student: StudentActivity) => {
    selectStudent(student);
    updateSelectedStudent(student.emailAddress);
  }, [selectStudent]);

  // エラー解除ハンドラー
  const handleResolveError = useCallback(async (emailAddress: string) => {
    try {
      await dashboardAPI.resolveStudentError(emailAddress);
      selectStudent(null);
      // データ再取得
      refreshData();
    } catch (error) {
    }
  }, [selectStudent, refreshData]);

  // ヘルプ解除ハンドラー
  const handleDismissHelp = useCallback(async (emailAddress: string) => {
    try {
      await dashboardAPI.dismissHelpRequest(emailAddress);
      selectStudent(null);
      // データ再取得
      refreshData();
    } catch (error) {
    }
  }, [selectStudent, refreshData]);


  const handleSortByPriority = useCallback(() => {
    // 緊急度順でソート（ヘルプ > エラー > アクティブ > その他）
    // Note: 実際のソート機能は各表示コンポーネントで実装
  }, []);

  const handleEscape = useCallback(() => {
    selectStudent(null);
  }, [selectStudent]);

  // Phase 1.3: キーボードショートカット設定 (unused)
  useKeyboardShortcuts({
    students,
    onHelpFocus: handleHelpFocus,
    onRefresh: handleRefresh,
    onSortByPriority: handleSortByPriority,
    onEscape: handleEscape
  });

  // レンダリング統計（開発時のみ）
  const renderStats = useMemo(() => ({
    optimizedComponents: 5, // OptimizedStudentCard, VirtualizedStudentList, etc.
    lazyComponents: 4 // LazyActivityChart, LazyTeamMapView, etc.
  }), []);

  // ヘルプ要請数を計算
  const helpRequestCount = useMemo(() => {
    return students.filter(s => s.status === 'help').length;
  }, [students]);


  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      {/* ヘッダー */}
      <DashboardHeader
        autoRefresh={autoRefresh}
        expandedTeamsCount={expandedTeamsCount}
        onAutoRefreshToggle={handleAutoRefreshToggle}
        onOpenAdmin={handleOpenAdmin}
      />


      {/* Phase 1.1: 緊急アラートシステム */}
      <CriticalAlertBar 
        students={students}
        onHelpStudentClick={handleStudentClick}
        onErrorStudentClick={handleErrorStudentClick}
        soundAlertEnabled={true}
      />

      {/* エラー表示 */}
      {error && (
        <Alert severity="error" onClose={clearError} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 受講生進捗表示 - 最優先表示 */}
      <Box sx={{ mb: 4 }}>
        <ViewModeControls
          viewMode={viewMode}
          studentsCount={students.length}
          onViewModeChange={handleViewModeChange}
        />

        {isLoading ? (
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 200
          }}>
            <CircularProgress size={40} />
            <Typography sx={{ ml: 2 }}>
              データを読み込み中...
            </Typography>
          </Box>
        ) : viewMode === 'virtualized' ? (
          <VirtualizedStudentList
            students={students}
            onStudentClick={handleStudentClick}
            height={600}
            showControls={true}
          />
        ) : viewMode === 'team' ? (
          <VisibilityBasedLoader fallback={<SkeletonLoader type="grid" count={4} />}>
            <OptimizedTeamMapView
              students={students}
              teams={Array.from(new Set(students.map(s => s.teamName).filter((name): name is string => Boolean(name))))}
            />
          </VisibilityBasedLoader>
        ) : (
          <OptimizedTeamGrid
            students={students}
            onStudentClick={handleStudentClick}
            onExpandedTeamsChange={setExpandedTeamsCount}
            maxTeamsToShow={8}
          />
        )}
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* 学習活動推移（遅延読み込み） */}
      <VisibilityBasedLoader fallback={<SkeletonLoader type="chart" />}>
        <Box sx={{ mb: 4 }}>
          <OptimizedActivityChart data={activityChart} timeRange="1h" />
        </Box>
      </VisibilityBasedLoader>


      {/* 受講生詳細モーダル（遅延読み込み） */}
      <OptimizedStudentDetailModal
        student={selectedStudent}
        open={!!selectedStudent}
        onClose={() => selectStudent(null)}
        onDismissHelp={handleDismissHelp}
        onResolveError={handleResolveError}
      />

      {/* Phase 1.3: キーボードショートカットヘルプ */}
      <KeyboardShortcutsHelp helpStudentsCount={helpRequestCount} />

      {/* リフレッシュボタン */}
      <Fab
        color="primary"
        aria-label="refresh"
        onClick={handleRefresh}
        disabled={isLoading}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
        }}
      >
        <RefreshIcon />
      </Fab>
    </Container>
  );
};

export default ProgressDashboard;