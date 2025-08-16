import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { ProgressDashboard } from './pages/ProgressDashboard';
import { StudentsListPage } from './pages/StudentsListPage';
import { StudentDetailPage } from './pages/StudentDetailPage';
import { AdminPanel } from './pages/admin/AdminPanel';
import { ErrorBoundary } from './components/error/ErrorBoundary';
import { setupGlobalErrorHandlers, errorReportingService } from './utils/errorHandling';
import './App.css';

// Material-UI テーマ設定
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
      light: '#ff5983',
      dark: '#9a0036',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
  },
});


function App() {
  useEffect(() => {
    // グローバルエラーハンドラーを設定
    setupGlobalErrorHandlers();
    
    // エラーレポーティングサービスの初期設定
    errorReportingService.setTag('version', 'v2.0.0');
    errorReportingService.setTag('environment', process.env.NODE_ENV || 'development');
    errorReportingService.setContext('app', {
      name: 'instructor-dashboard',
      phase: 'phase-3-type-safety',
      buildTime: new Date().toISOString()
    });

    // 開発環境でのデバッグ情報
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 Phase 3: Type Safety & Validation Enabled');
      console.log('✅ Global Error Handlers: Active');
      console.log('✅ Runtime Validation: Active');
      console.log('✅ Error Boundaries: Active');
    }
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <ErrorBoundary>
              <Routes>
                {/* メインダッシュボード（旧最適化版） */}
                <Route 
                  path="/dashboard" 
                  element={
                    <ErrorBoundary>
                      <ProgressDashboard />
                    </ErrorBoundary>
                  } 
                />

                {/* 学生一覧ページ */}
                <Route 
                  path="/dashboard/students" 
                  element={
                    <ErrorBoundary>
                      <StudentsListPage />
                    </ErrorBoundary>
                  } 
                />

                {/* 個別学生詳細ページ */}
                <Route 
                  path="/dashboard/student/:emailAddress" 
                  element={
                    <ErrorBoundary>
                      <StudentDetailPage />
                    </ErrorBoundary>
                  } 
                />

                {/* 管理画面 */}
                <Route 
                  path="/admin/*" 
                  element={
                    <ErrorBoundary>
                      <AdminPanel />
                    </ErrorBoundary>
                  } 
                />

                {/* デフォルトルート */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />

                {/* 404ページ */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </ErrorBoundary>
          </Box>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
