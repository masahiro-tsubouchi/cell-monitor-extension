/**
 * Web Worker 互換性テストコンポーネント
 * 管理画面でWorkerの動作確認を行う
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress
} from '@mui/material';
import {
  PlayArrow as TestIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Speed as PerformanceIcon,
  Memory as WorkerIcon
} from '@mui/icons-material';
import { 
  testWorkerCompatibility, 
  testWorkerPerformance,
  formatWorkerTestResults
} from '../../../utils/workerCompatibilityTest';

interface TestState {
  running: boolean;
  basicResult: any;
  performanceResult: any;
  error: string | null;
}

export const WorkerCompatibilityTest: React.FC = () => {
  const [testState, setTestState] = useState<TestState>({
    running: false,
    basicResult: null,
    performanceResult: null,
    error: null
  });

  const runBasicTest = useCallback(async () => {
    setTestState(prev => ({ 
      ...prev, 
      running: true, 
      error: null,
      basicResult: null 
    }));

    try {
      const result = await testWorkerCompatibility();
      setTestState(prev => ({
        ...prev,
        running: false,
        basicResult: result
      }));
    } catch (error) {
      setTestState(prev => ({
        ...prev,
        running: false,
        error: error instanceof Error ? error.message : 'テスト実行エラー'
      }));
    }
  }, []);

  const runPerformanceTest = useCallback(async () => {
    setTestState(prev => ({ 
      ...prev, 
      running: true, 
      error: null,
      performanceResult: null 
    }));

    try {
      const result = await testWorkerPerformance();
      setTestState(prev => ({
        ...prev,
        running: false,
        performanceResult: result
      }));
    } catch (error) {
      setTestState(prev => ({
        ...prev,
        running: false,
        error: error instanceof Error ? error.message : 'パフォーマンステスト実行エラー'
      }));
    }
  }, []);

  const clearResults = useCallback(() => {
    setTestState({
      running: false,
      basicResult: null,
      performanceResult: null,
      error: null
    });
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      {/* 制御パネル */}
      <Card sx={{ mb: 3, border: '2px solid #e3f2fd' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WorkerIcon sx={{ color: '#1976d2', fontSize: 28 }} />
              <Typography variant="h6" fontWeight="bold">
                Web Worker 互換性テスト
              </Typography>
            </Box>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            ブラウザ環境でのWeb Worker動作確認とパフォーマンス測定を実行します
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={testState.running ? <CircularProgress size={16} /> : <TestIcon />}
              onClick={runBasicTest}
              disabled={testState.running}
            >
              基本テスト実行
            </Button>
            <Button
              variant="outlined"
              startIcon={testState.running ? <CircularProgress size={16} /> : <PerformanceIcon />}
              onClick={runPerformanceTest}
              disabled={testState.running}
            >
              パフォーマンステスト実行
            </Button>
            <Button
              variant="text"
              onClick={clearResults}
              disabled={testState.running}
            >
              結果クリア
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* エラー表示 */}
      {testState.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography fontWeight="bold">テスト実行エラー</Typography>
          {testState.error}
        </Alert>
      )}

      {/* 基本テスト結果 */}
      {testState.basicResult && (
        <Card sx={{ mb: 3, backgroundColor: testState.basicResult.supported ? '#e8f5e8' : '#ffebee' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              {testState.basicResult.supported ? (
                <SuccessIcon sx={{ color: '#4caf50' }} />
              ) : (
                <ErrorIcon sx={{ color: '#f44336' }} />
              )}
              <Typography variant="h6" fontWeight="bold">
                基本テスト結果
              </Typography>
              <Chip
                label={testState.basicResult.supported ? '対応' : '非対応'}
                color={testState.basicResult.supported ? 'success' : 'error'}
                size="small"
              />
            </Box>

            <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-line' }}>
              {formatWorkerTestResults(testState.basicResult)}
            </Typography>

            {testState.basicResult.details && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  詳細情報
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Worker作成</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {testState.basicResult.details.workerCreated ? '✅ 成功' : '❌ 失敗'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">メッセージ通信</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {testState.basicResult.details.messageReceived ? '✅ 成功' : '❌ 失敗'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">処理時間</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {testState.basicResult.details.processingTime.toFixed(2)}ms
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* パフォーマンステスト結果 */}
      {testState.performanceResult && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              📊 パフォーマンステスト結果
            </Typography>

            {testState.performanceResult.basicTest.supported ? (
              <>
                {testState.performanceResult.performanceTest && (
                  <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>テスト項目</strong></TableCell>
                          <TableCell align="right"><strong>処理時間</strong></TableCell>
                          <TableCell align="right"><strong>評価</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell>小データセット（100件）</TableCell>
                          <TableCell align="right">
                            {testState.performanceResult.performanceTest.smallDataset.toFixed(2)}ms
                          </TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={testState.performanceResult.performanceTest.smallDataset < 100 ? '高速' : '標準'}
                              color={testState.performanceResult.performanceTest.smallDataset < 100 ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>大データセット（1000件）</TableCell>
                          <TableCell align="right">
                            {testState.performanceResult.performanceTest.largeDataset.toFixed(2)}ms
                          </TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={testState.performanceResult.performanceTest.largeDataset < 500 ? '高速' : '標準'}
                              color={testState.performanceResult.performanceTest.largeDataset < 500 ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>並列処理（600件×3）</TableCell>
                          <TableCell align="right">
                            {testState.performanceResult.performanceTest.multipleOperations.toFixed(2)}ms
                          </TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={testState.performanceResult.performanceTest.multipleOperations < 1000 ? '高速' : '標準'}
                              color={testState.performanceResult.performanceTest.multipleOperations < 1000 ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                <Alert severity="success" sx={{ mt: 2 }}>
                  <Typography fontWeight="bold">✅ Web Worker は正常に動作します</Typography>
                  フロントエンドの重い処理を Worker で並列化することで、UI応答性を向上できます。
                </Alert>
              </>
            ) : (
              <Alert severity="error">
                <Typography fontWeight="bold">❌ Web Worker は利用できません</Typography>
                {testState.performanceResult.basicTest.error}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* 実行中インジケーター */}
      {testState.running && (
        <Card sx={{ border: '2px solid #2196f3' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={24} />
              <Typography variant="body1" fontWeight="bold">
                Web Worker テスト実行中...
              </Typography>
            </Box>
            <LinearProgress sx={{ mt: 2 }} />
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default WorkerCompatibilityTest;