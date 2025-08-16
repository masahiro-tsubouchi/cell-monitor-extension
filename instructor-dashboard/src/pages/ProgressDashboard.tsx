import React, { useEffect, useRef } from 'react';
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
  Speed as OptimizeIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useProgressDashboardStore } from '../stores/progressDashboardStore';
import { StudentProgressGrid } from '../components/progress/StudentProgressGrid';
import { TeamProgressView } from '../components/progress/TeamProgressView';
import { TeamMapView } from '../components/progress/TeamMapView';
import { MetricsPanel } from '../components/progress/MetricsPanel';
import { ActivityChart } from '../components/progress/ActivityChart';
import { StudentDetailModal } from '../components/progress/StudentDetailModal';
import { StudentActivity } from '../services/dashboardAPI';
import webSocketService from '../services/websocket';
import { useNavigate } from 'react-router-dom';
import {
  getInstructorSettings,
  updateViewMode,
  updateAutoRefresh,
  updateSelectedStudent
} from '../utils/instructorStorage';
import { DashboardViewMode, convertLegacyViewMode } from '../types/dashboard';

export const ProgressDashboard: React.FC = () => {
  const navigate = useNavigate();

  // 講師別設定を初期化（レガシー互換）
  const [viewMode, setViewMode] = React.useState<'grid' | 'team'>(() => {
    const settings = getInstructorSettings();
    return settings.viewMode;
  });

  // 展開状態の変更を監視するためのstate
  const [expandedTeamsCount, setExpandedTeamsCount] = React.useState<number>(() => {
    const settings = getInstructorSettings();
    return settings.expandedTeams.length;
  });

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
    // updateStudentsIncremental, // 将来のWebSocket差分更新用
    setAutoRefresh,
    selectStudent,
    updateStudentStatus,
    clearError,
    // 新機能: 状態保持関連
    markUserActive,
    flushQueuedUpdates,
    setDeferredUpdates
  } = useProgressDashboardStore();

  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // コンポーネントマウント時にデータ読み込み
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // 新機能: ユーザーインタラクション検出
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

  // WebSocketイベントハンドラー設定
  useEffect(() => {
    const eventHandlers = {
      onConnect: () => {
        console.log('Progress dashboard WebSocket connected');
      },
      onDisconnect: () => {
        console.log('Progress dashboard WebSocket disconnected');
      },
      onStudentProgressUpdate: (data: StudentActivity) => {
        console.log('Student progress update:', data);
        // Update specific student in store
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
        console.log('Cell execution event:', data);
        // Update execution count
        updateStudentStatus(data.emailAddress, {
          cellExecutions: (data.cellExecutions || 1),
          lastActivity: '今',
          status: 'active' as const
        });
      },
      onHelpRequest: (data: any) => {
        console.log('Help request event:', data);
        // Help request - immediate full refresh for accuracy
        updateStudentStatus(data.emailAddress, {
          isRequestingHelp: true,
          lastActivity: '今',
          status: 'help' as any
        });
        // Trigger immediate full refresh to ensure help status is accurate
        setTimeout(() => refreshData(), 100);
      },
      onHelpResolved: (data: any) => {
        console.log('Help resolved event:', data);
        // Help resolved - immediate full refresh
        updateStudentStatus(data.emailAddress, {
          isRequestingHelp: false,
          lastActivity: '今'
        });
        // Trigger immediate full refresh
        setTimeout(() => refreshData(), 100);
      },
      onError: (error: any) => {
        console.error('Progress dashboard WebSocket error:', error);
      }
    };

    webSocketService.setEventHandlers(eventHandlers);

    // ダッシュボード専用WebSocket接続を開始
    webSocketService.connectToDashboard();

    return () => {
      // Cleanup event handlers when component unmounts
      webSocketService.setEventHandlers({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 依存配列を空にして初回のみ実行 - refreshData, updateStudentStatusは意図的に除外

  // スマート自動リフレッシュ設定 (方法B: 展開状態に応じた更新頻度)
  useEffect(() => {
    if (autoRefresh) {
      // 展開チームがある場合は高頻度 (5秒)、ない場合は低頻度 (15秒)
      const updateInterval = expandedTeamsCount > 0 ? 5000 : 15000;

      console.log(`Smart refresh: ${expandedTeamsCount}チーム展開中 → ${updateInterval/1000}秒間隔で更新`);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, expandedTeamsCount]); // 展開チーム数の変更を監視 - refreshDataは意図的に除外

  const handleStudentClick = (student: StudentActivity) => {
    selectStudent(student);
    updateSelectedStudent(student.emailAddress); // ローカルストレージに保存
    console.log('Selected student:', student);
  };

  const handleRefresh = () => {
    // 新機能: 手動更新時は保留中の更新も即座に適用
    flushQueuedUpdates();
    refreshData();
  };

  const handleAutoRefreshToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newAutoRefresh = event.target.checked;
    setAutoRefresh(newAutoRefresh);
    updateAutoRefresh(newAutoRefresh); // ローカルストレージに保存
  };

  const handleViewStudentsList = () => {
    navigate('/dashboard/students');
  };

  const handleViewModeChange = (
    event: React.MouseEvent<HTMLElement>,
    newViewMode: 'grid' | 'team' | null,
  ) => {
    if (newViewMode !== null) {
      setViewMode(newViewMode);
      updateViewMode(newViewMode); // ローカルストレージに保存
    }
  };

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      {/* ヘッダー */}
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
            <Button
              variant="outlined"
              startIcon={<OptimizeIcon />}
              onClick={() => navigate('/dashboard/optimized')}
              sx={{ fontWeight: 'bold' }}
              color="success"
            >
              最適化版を試す
            </Button>
            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={handleAutoRefreshToggle}
                  icon={<AutoIcon />}
                  checkedIcon={<AutoIcon />}
                />
              }
              label="自動更新"
            />
            <Button
              variant="outlined"
              onClick={() => navigate('/admin')}
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

      {/* エラー表示 */}
      {error && (
        <Alert
          severity="error"
          onClose={clearError}
          sx={{ mb: 3 }}
        >
          {error}
        </Alert>
      )}

      {/* メトリクスパネル */}
      <Box sx={{ mb: 4 }}>
        <MetricsPanel metrics={metrics} lastUpdated={lastUpdated} />
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* 活動チャート */}
      <Box sx={{ mb: 4 }}>
        <ActivityChart data={activityChart} timeRange="1h" />
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* チームMAPセクション */}
      <TeamMapView
        students={students}
        teams={Array.from(new Set(students.map(s => s.teamName).filter((name): name is string => Boolean(name))))}
      />


      {/* 受講生進捗表示 */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2" fontWeight="bold">
            👥 受講生一覧 ({viewMode === 'grid' ? Math.min(students.length, 12) : students.length}/{students.length}名表示)
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* 表示モード切り替え */}
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={handleViewModeChange}
              aria-label="view mode"
              size="small"
            >
              <ToggleButton value="team" aria-label="team view">
                <TeamIcon sx={{ mr: 1 }} />
                チーム表示
              </ToggleButton>
              <ToggleButton value="grid" aria-label="grid view">
                <GridIcon sx={{ mr: 1 }} />
                グリッド表示
              </ToggleButton>
            </ToggleButtonGroup>

            <Button
              variant="outlined"
              startIcon={<ListIcon />}
              onClick={handleViewStudentsList}
              sx={{ fontWeight: 'bold' }}
            >
              詳細一覧を見る
            </Button>
          </Box>
        </Box>

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
        ) : viewMode === 'team' ? (
          <TeamProgressView
            students={students}
            onStudentClick={handleStudentClick}
            onExpandedTeamsChange={setExpandedTeamsCount}
          />
        ) : (
          <StudentProgressGrid
            students={students.slice(0, 12)}
            onStudentClick={handleStudentClick}
            onRefresh={refreshData}
          />
        )}
      </Box>

      {/* 受講生詳細モーダル */}
      <StudentDetailModal
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

export default ProgressDashboard;
