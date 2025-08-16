/**
 * Optimized Progress Dashboard
 * Phase 2: パフォーマンス最適化基盤適用版
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
  ArrowBack as BackIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useProgressDashboardStore } from '../stores/progressDashboardStore';
import { useOptimizedStudentList } from '../hooks/useOptimizedStudentList';
import { useWorkerProcessing } from '../hooks/useWorkerProcessing';
import { OptimizedStudentCard } from '../components/optimized/OptimizedStudentCard';
import { VirtualizedStudentList } from '../components/virtualized/VirtualizedStudentList';
import {
  OptimizedActivityChart,
  OptimizedTeamMapView,
  OptimizedStudentDetailModal,
  VisibilityBasedLoader,
  SkeletonLoader
} from '../components/lazy/LazyComponentLoader';
import { MetricsPanel } from '../components/progress/MetricsPanel';
import { StudentActivity } from '../services/dashboardAPI';
import webSocketService from '../services/websocket';
import { useNavigate } from 'react-router-dom';
import {
  getInstructorSettings,
  updateViewMode,
  updateAutoRefresh,
  updateSelectedStudent
} from '../utils/instructorStorage';

// メモ化されたヘッダーコンポーネント
const DashboardHeader = memo<{
  autoRefresh: boolean;
  expandedTeamsCount: number;
  onAutoRefreshToggle: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBackToDashboard: () => void;
  onOpenAdmin: () => void;
}>(({ autoRefresh, expandedTeamsCount, onAutoRefreshToggle, onBackToDashboard, onOpenAdmin }) => (
  <Box sx={{ mb: 4 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          📚 学習進捗ダッシュボード（最適化版）
        </Typography>
        <Typography variant="body1" color="text.secondary">
          受講生のJupyterLab学習活動をリアルタイムで監視 - パフォーマンス強化済み
        </Typography>
        {autoRefresh && (
          <Typography variant="caption" color="primary" sx={{ mt: 0.5, display: 'block' }}>
            📡 スマート更新: {expandedTeamsCount > 0 ? '5秒間隔（詳細監視）' : '15秒間隔（概要監視）'}
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="text"
          startIcon={<BackIcon />}
          onClick={onBackToDashboard}
          sx={{ fontWeight: 'bold' }}
        >
          従来版に戻る
        </Button>
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
  viewMode: 'grid' | 'team' | 'virtualized';
  studentsCount: number;
  onViewModeChange: (mode: 'grid' | 'team' | 'virtualized') => void;
  onViewStudentsList: () => void;
}>(({ viewMode, studentsCount, onViewModeChange, onViewStudentsList }) => (
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
          グリッド表示
        </ToggleButton>
        <ToggleButton value="virtualized">
          <ListIcon sx={{ mr: 1 }} />
          仮想リスト
        </ToggleButton>
      </ToggleButtonGroup>

      <Button
        variant="outlined"
        startIcon={<ListIcon />}
        onClick={onViewStudentsList}
        sx={{ fontWeight: 'bold' }}
      >
        詳細一覧を見る
      </Button>
    </Box>
  </Box>
));

ViewModeControls.displayName = 'ViewModeControls';

function getViewModeLabel(mode: string): string {
  switch (mode) {
    case 'team': return 'チーム別表示';
    case 'grid': return 'グリッド表示（最大12名）';
    case 'virtualized': return '仮想スクロール（全員表示）';
    default: return '';
  }
}

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

export const OptimizedProgressDashboard: React.FC = () => {
  const navigate = useNavigate();

  // 講師別設定を初期化
  const [viewMode, setViewMode] = useState<'grid' | 'team' | 'virtualized'>(() => {
    const settings = getInstructorSettings();
    return settings.viewMode === 'grid' ? 'grid' : 'team';
  });

  const [expandedTeamsCount, setExpandedTeamsCount] = useState<number>(0);

  // Store から状態取得
  const {
    students,
    metrics,
    activityChart,
    isLoading,
    error,
    lastUpdated,
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

  // Worker 処理フック
  const workerProcessing = useWorkerProcessing();

  // 最適化された学生データ
  const optimizedStudentData = useOptimizedStudentList(students);

  // WebSocket関連の処理は既存と同じ
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // コンポーネントマウント時にデータ読み込み
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // ユーザーインタラクション検出
  useEffect(() => {
    const handleUserInteraction = () => {
      markUserActive();
    };

    const events = ['mousedown', 'mouseup', 'scroll', 'keydown', 'touchstart'];
    
    events.forEach(eventName => {
      window.addEventListener(eventName, handleUserInteraction, { passive: true });
    });

    return () => {
      events.forEach(eventName => {
        window.removeEventListener(eventName, handleUserInteraction);
      });
    };
  }, [markUserActive]);

  // WebSocketイベントハンドラー設定（既存と同じ）
  useEffect(() => {
    const eventHandlers = {
      onConnect: () => console.log('Progress dashboard WebSocket connected'),
      onDisconnect: () => console.log('Progress dashboard WebSocket disconnected'),
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
      onCellExecution: (data: any) => {
        updateStudentStatus(data.emailAddress, {
          cellExecutions: (data.cellExecutions || 1),
          lastActivity: '今',
          status: 'active' as const
        });
      },
      onHelpRequest: (data: any) => {
        updateStudentStatus(data.emailAddress, {
          isRequestingHelp: true,
          lastActivity: '今',
          status: 'help' as any
        });
        setTimeout(() => refreshData(), 100);
      },
      onHelpResolved: (data: any) => {
        updateStudentStatus(data.emailAddress, {
          isRequestingHelp: false,
          lastActivity: '今'
        });
        setTimeout(() => refreshData(), 100);
      },
      onError: (error: any) => console.error('Progress dashboard WebSocket error:', error)
    };

    webSocketService.setEventHandlers(eventHandlers);
    webSocketService.connectToDashboard();

    return () => {
      webSocketService.setEventHandlers({});
    };
  }, []);

  // 自動リフレッシュ設定
  useEffect(() => {
    if (autoRefresh) {
      const updateInterval = expandedTeamsCount > 0 ? 5000 : 15000;

      refreshIntervalRef.current = setInterval(() => {
        refreshData();
      }, updateInterval);
    } else if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, expandedTeamsCount, refreshData]);

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

  const handleViewStudentsList = useCallback(() => {
    navigate('/dashboard/students');
  }, [navigate]);

  const handleViewModeChange = useCallback((newViewMode: 'grid' | 'team' | 'virtualized') => {
    setViewMode(newViewMode);
    updateViewMode(newViewMode as any);
  }, []);

  const handleBackToDashboard = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  const handleOpenAdmin = useCallback(() => {
    navigate('/admin');
  }, [navigate]);

  // レンダリング統計（開発時のみ）
  const renderStats = useMemo(() => ({
    optimizedComponents: 5, // OptimizedStudentCard, VirtualizedStudentList, etc.
    lazyComponents: 4 // LazyActivityChart, LazyTeamMapView, etc.
  }), []);

  // 表示する学生データの決定（メモ化）
  const displayStudents = useMemo(() => {
    switch (viewMode) {
      case 'grid':
        return optimizedStudentData.students.slice(0, 12);
      case 'virtualized':
        return optimizedStudentData.students;
      default:
        return optimizedStudentData.students;
    }
  }, [viewMode, optimizedStudentData.students]);

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      {/* ヘッダー */}
      <DashboardHeader
        autoRefresh={autoRefresh}
        expandedTeamsCount={expandedTeamsCount}
        onAutoRefreshToggle={handleAutoRefreshToggle}
        onBackToDashboard={handleBackToDashboard}
        onOpenAdmin={handleOpenAdmin}
      />

      {/* パフォーマンス統計 */}
      <PerformanceStats
        workerStats={workerProcessing}
        renderStats={renderStats}
      />

      {/* エラー表示 */}
      {error && (
        <Alert severity="error" onClose={clearError} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* メトリクスパネル */}
      <Box sx={{ mb: 4 }}>
        <MetricsPanel metrics={metrics} lastUpdated={lastUpdated} />
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* 活動チャート（遅延読み込み） */}
      <VisibilityBasedLoader fallback={<SkeletonLoader type="chart" />}>
        <Box sx={{ mb: 4 }}>
          <OptimizedActivityChart data={activityChart} timeRange="1h" />
        </Box>
      </VisibilityBasedLoader>

      <Divider sx={{ my: 3 }} />


      {/* 受講生進捗表示 */}
      <Box sx={{ mb: 4 }}>
        <ViewModeControls
          viewMode={viewMode}
          studentsCount={students.length}
          onViewModeChange={handleViewModeChange}
          onViewStudentsList={handleViewStudentsList}
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
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: 2 
          }}>
            {displayStudents.map((studentData) => (
              <OptimizedStudentCard
                key={studentData.id}
                studentData={studentData}
                onClick={handleStudentClick}
                showTeam={true}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* 受講生詳細モーダル（遅延読み込み） */}
      <OptimizedStudentDetailModal
        student={selectedStudent}
        open={!!selectedStudent}
        onClose={() => selectStudent(null)}
      />

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

export default OptimizedProgressDashboard;