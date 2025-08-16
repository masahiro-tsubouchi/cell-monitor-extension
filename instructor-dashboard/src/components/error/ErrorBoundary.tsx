/**
 * Type-Safe Error Boundary Component
 * Phase 3: React Error境界実装
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Paper,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  ErrorOutline as ErrorIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  BugReport as BugIcon
} from '@mui/icons-material';
import { 
  DomainError, 
  createErrorInfo, 
  errorReportingService 
} from '../../utils/errorHandling';

// ✅ Error Boundary Props
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  isolate?: boolean; // エラーを境界内に隔離するか
}

// ✅ Error Boundary State
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

// ✅ Error Fallback Props
export interface ErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo;
  resetError: () => void;
  errorId: string;
}

// ✅ Main Error Boundary Component
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // エラーが発生したことを示すstate更新
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // エラー情報を記録
    this.setState({ errorInfo });

    // カスタムエラーハンドラーの実行
    this.props.onError?.(error, errorInfo);

    // エラーレポーティング
    const errorDetails = createErrorInfo(error, errorInfo);
    errorReportingService.captureException(errorDetails.error, {
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });

    // コンソールログ（開発環境）
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 React Error Boundary');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, errorId } = this.state;
      
      if (error && errorInfo && errorId) {
        const FallbackComponent = this.props.fallback || DefaultErrorFallback;
        
        return (
          <FallbackComponent
            error={error}
            errorInfo={errorInfo}
            resetError={this.resetError}
            errorId={errorId}
          />
        );
      }
    }

    return this.props.children;
  }
}

// ✅ Default Error Fallback Component
const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  resetError,
  errorId
}) => {
  const isDomainError = error instanceof DomainError;
  const [showDetails, setShowDetails] = React.useState(false);

  const handleReload = () => {
    window.location.reload();
  };

  const handleReportError = () => {
    const errorData = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };

    // エラーレポート用のデータをクリップボードにコピー
    navigator.clipboard.writeText(JSON.stringify(errorData, null, 2))
      .then(() => {
        alert('エラー情報がクリップボードにコピーされました。');
      })
      .catch(() => {
        console.error('Failed to copy error data to clipboard');
      });
  };

  return (
    <Box
      sx={{
        p: 3,
        minHeight: '200px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 600,
          width: '100%',
          textAlign: 'center'
        }}
      >
        <ErrorIcon
          sx={{
            fontSize: 64,
            color: 'error.main',
            mb: 2
          }}
        />

        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          エラーが発生しました
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {isDomainError 
            ? (error as DomainError).userMessage
            : 'アプリケーションで予期しないエラーが発生しました。'
          }
        </Typography>

        {isDomainError && (
          <Alert 
            severity={getSeverityColor((error as DomainError).severity)} 
            sx={{ mb: 3, textAlign: 'left' }}
          >
            <Typography variant="body2">
              <strong>エラーコード:</strong> {(error as DomainError).code}
            </Typography>
            <Typography variant="body2">
              <strong>カテゴリ:</strong> {(error as DomainError).category}
            </Typography>
            {(error as DomainError).retryable && (
              <Typography variant="body2" color="info.main">
                このエラーは一時的なものかもしれません。再試行してください。
              </Typography>
            )}
          </Alert>
        )}

        <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={resetError}
            color="primary"
          >
            再試行
          </Button>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleReload}
          >
            ページ再読み込み
          </Button>

          <Button
            variant="outlined"
            startIcon={<BugIcon />}
            onClick={handleReportError}
            color="secondary"
          >
            エラー報告
          </Button>
        </Stack>

        <Accordion 
          expanded={showDetails} 
          onChange={(_, isExpanded) => setShowDetails(isExpanded)}
          elevation={0}
          sx={{ mt: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2" color="text.secondary">
              技術的な詳細を表示
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ textAlign: 'left' }}>
              <Typography variant="caption" component="div" sx={{ mb: 1 }}>
                <strong>エラーID:</strong> {errorId}
              </Typography>
              
              <Typography variant="caption" component="div" sx={{ mb: 1 }}>
                <strong>エラーメッセージ:</strong>
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 1,
                  mb: 2,
                  backgroundColor: 'grey.50',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  overflow: 'auto',
                  maxHeight: 100
                }}
              >
                {error.message}
              </Paper>

              {process.env.NODE_ENV === 'development' && (
                <>
                  <Typography variant="caption" component="div" sx={{ mb: 1 }}>
                    <strong>スタックトレース:</strong>
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1,
                      mb: 2,
                      backgroundColor: 'grey.50',
                      fontFamily: 'monospace',
                      fontSize: '0.7rem',
                      overflow: 'auto',
                      maxHeight: 150
                    }}
                  >
                    <pre>{error.stack}</pre>
                  </Paper>

                  <Typography variant="caption" component="div" sx={{ mb: 1 }}>
                    <strong>コンポーネントスタック:</strong>
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1,
                      backgroundColor: 'grey.50',
                      fontFamily: 'monospace',
                      fontSize: '0.7rem',
                      overflow: 'auto',
                      maxHeight: 150
                    }}
                  >
                    <pre>{errorInfo.componentStack}</pre>
                  </Paper>
                </>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      </Paper>
    </Box>
  );
};

// ✅ Severity Color Mapping
const getSeverityColor = (severity: string): 'error' | 'warning' | 'info' | 'success' => {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'info';
    default:
      return 'error';
  }
};

// ✅ Lightweight Error Boundary for specific components
export const ComponentErrorBoundary: React.FC<{
  children: ReactNode;
  componentName: string;
}> = ({ children, componentName }) => {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error(`Error in ${componentName}:`, error, errorInfo);
      }}
      fallback={({ error, resetError }) => (
        <Alert 
          severity="error" 
          action={
            <Button size="small" onClick={resetError}>
              再試行
            </Button>
          }
        >
          <Typography variant="body2">
            {componentName}でエラーが発生しました: {error.message}
          </Typography>
        </Alert>
      )}
    >
      {children}
    </ErrorBoundary>
  );
};

// ✅ HOC for automatic error boundary wrapping
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) => {
  const WrappedComponent: React.FC<P> = (props) => (
    <ComponentErrorBoundary componentName={componentName || Component.displayName || Component.name}>
      <Component {...props} />
    </ComponentErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${componentName || Component.displayName || Component.name})`;

  return WrappedComponent;
};

export default ErrorBoundary;