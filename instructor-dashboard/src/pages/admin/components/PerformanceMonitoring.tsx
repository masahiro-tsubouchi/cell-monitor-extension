/**
 * パフォーマンス監視ダッシュボードコンポーネント
 * 時系列グラフと詳細メトリクス表示
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  ButtonGroup
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  NetworkCheck as NetworkIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Clear as ClearIcon,
  FileDownload as DownloadIcon
} from '@mui/icons-material';
import { useProgressDashboardStore } from '../../../stores/progressDashboardStore';
import { performanceMonitor } from '../../../utils/performanceMonitor';

interface MetricsSummary {
  totalUpdates: number;
  deltaRatio: number;
  avgDataReduction: number;
  avgProcessingTime: number;
  totalBandwidthSaved: number;
  sessionDuration: number;
}

export const PerformanceMonitoring: React.FC = () => {
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);
  const [realTimeStats, setRealTimeStats] = useState<any>(null);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [viewMode, setViewMode] = useState<'realtime' | 'history' | 'comparison'>('realtime');
  
  const {
    performanceMonitoring,
    startPerformanceMonitoring,
    stopPerformanceMonitoring,
    getLoadComparison,
    generatePerformanceReport
  } = useProgressDashboardStore();

  // リアルタイムデータ更新
  useEffect(() => {
    const updateData = () => {
      try {
        // メトリクス履歴取得
        const history = performanceMonitor.getMetricsHistory();
        setMetricsHistory(history);

        // リアルタイム統計
        const rtStats = performanceMonitor.getRealTimeStats();
        setRealTimeStats(rtStats);

        // サマリー計算
        if (history.length > 0) {
          const deltaMetrics = history.filter(m => m.mode === 'delta');
          const fullMetrics = history.filter(m => m.mode === 'full');
          
          const summaryData: MetricsSummary = {
            totalUpdates: history.length,
            deltaRatio: deltaMetrics.length / history.length * 100,
            avgDataReduction: deltaMetrics.length > 0 ? 
              (1 - (deltaMetrics.reduce((sum, m) => sum + m.dataSize, 0) / deltaMetrics.length) / 
              (fullMetrics.length > 0 ? fullMetrics.reduce((sum, m) => sum + m.dataSize, 0) / fullMetrics.length : 1)) * 100 : 0,
            avgProcessingTime: history.reduce((sum, m) => sum + m.processingTime, 0) / history.length,
            totalBandwidthSaved: rtStats?.estimatedBandwidthSaved || 0,
            sessionDuration: rtStats?.sessionDuration || 0
          };
          setSummary(summaryData);
        }
      } catch (error) {
        console.error('パフォーマンスデータ取得エラー:', error);
      }
    };

    updateData();
    const interval = setInterval(updateData, 2000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}時間${minutes % 60}分`;
    if (minutes > 0) return `${minutes}分${seconds % 60}秒`;
    return `${seconds}秒`;
  };

  const handleToggleMonitoring = () => {
    if (performanceMonitoring) {
      stopPerformanceMonitoring();
    } else {
      startPerformanceMonitoring();
    }
  };

  const handleClearData = () => {
    performanceMonitor.clearMetrics();
    setMetricsHistory([]);
    setSummary(null);
    setRealTimeStats(null);
  };

  const handleExportData = () => {
    const report = generatePerformanceReport();
    const csvData = performanceMonitor.exportToCSV();
    
    const fullExport = `${report}\n\n=== RAW CSV DATA ===\n${csvData}`;
    
    const blob = new Blob([fullExport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-monitoring-${new Date().toISOString().slice(0, 19)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* 制御パネル */}
      <Card sx={{ mb: 3, border: performanceMonitoring ? '2px solid #4caf50' : '2px solid #f0f0f0' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TimelineIcon sx={{ fontSize: 28, color: '#1976d2' }} />
              <Typography variant="h6" fontWeight="bold">
                パフォーマンス監視コントロール
              </Typography>
              <Chip 
                label={performanceMonitoring ? '測定中' : '停止中'}
                color={performanceMonitoring ? 'success' : 'default'}
                icon={performanceMonitoring ? <PlayIcon /> : <StopIcon />}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <ButtonGroup variant="outlined" size="small">
                <Button
                  onClick={() => setViewMode('realtime')}
                  variant={viewMode === 'realtime' ? 'contained' : 'outlined'}
                >
                  リアルタイム
                </Button>
                <Button
                  onClick={() => setViewMode('history')}
                  variant={viewMode === 'history' ? 'contained' : 'outlined'}
                >
                  履歴
                </Button>
                <Button
                  onClick={() => setViewMode('comparison')}
                  variant={viewMode === 'comparison' ? 'contained' : 'outlined'}
                >
                  比較
                </Button>
              </ButtonGroup>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant={performanceMonitoring ? "outlined" : "contained"}
              startIcon={performanceMonitoring ? <StopIcon /> : <PlayIcon />}
              onClick={handleToggleMonitoring}
              color={performanceMonitoring ? "error" : "success"}
            >
              {performanceMonitoring ? '監視停止' : '監視開始'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExportData}
              disabled={!metricsHistory.length}
            >
              データ出力
            </Button>
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={handleClearData}
              color="warning"
              disabled={!metricsHistory.length}
            >
              データクリア
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* リアルタイムビュー */}
      {viewMode === 'realtime' && (
        <>
          {!performanceMonitoring && (
            <Alert severity="info" sx={{ mb: 3 }}>
              パフォーマンス監視を開始してリアルタイムデータを表示します
            </Alert>
          )}

          {/* サマリーカード */}
          {summary && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 3, mb: 3 }}>
              <Card sx={{ textAlign: 'center', height: '100%' }}>
                <CardContent>
                  <SpeedIcon sx={{ fontSize: 32, color: '#2196f3', mb: 1 }} />
                  <Typography variant="h4" fontWeight="bold" color="primary">
                    {summary.totalUpdates}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    総更新数
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ textAlign: 'center', height: '100%' }}>
                <CardContent>
                  <TrendingUpIcon sx={{ fontSize: 32, color: '#4caf50', mb: 1 }} />
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {(summary.deltaRatio || 0).toFixed(1)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    差分更新率
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ textAlign: 'center', height: '100%' }}>
                <CardContent>
                  <TrendingDownIcon sx={{ fontSize: 32, color: '#ff9800', mb: 1 }} />
                  <Typography variant="h4" fontWeight="bold" color="warning.main">
                    {(summary.avgDataReduction || 0).toFixed(1)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    データ削減率
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ textAlign: 'center', height: '100%' }}>
                <CardContent>
                  <MemoryIcon sx={{ fontSize: 32, color: '#9c27b0', mb: 1 }} />
                  <Typography variant="h4" fontWeight="bold" color="secondary.main">
                    {(summary.avgProcessingTime || 0).toFixed(1)}ms
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    平均処理時間
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ textAlign: 'center', height: '100%' }}>
                <CardContent>
                  <NetworkIcon sx={{ fontSize: 32, color: '#f44336', mb: 1 }} />
                  <Typography variant="h4" fontWeight="bold" color="error.main">
                    {formatBytes(summary.totalBandwidthSaved)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    帯域幅削減量
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ textAlign: 'center', height: '100%' }}>
                <CardContent>
                  <TimelineIcon sx={{ fontSize: 32, color: '#795548', mb: 1 }} />
                  <Typography variant="h4" fontWeight="bold" color="text.primary">
                    {formatDuration(summary.sessionDuration)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    監視時間
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* リアルタイム統計 */}
          {realTimeStats && (
            <Card sx={{ mb: 3, backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" color="primary" gutterBottom>
                  📊 リアルタイム統計 (過去1分間)
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 2 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" fontWeight="bold">{realTimeStats.totalUpdates}</Typography>
                    <Typography variant="body2" color="text.secondary">更新回数</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" fontWeight="bold" color="success.main">
                      {(realTimeStats.deltaUpdateRatio || 0).toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">差分率</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" fontWeight="bold">
                      {formatBytes(realTimeStats.totalDataTransferred)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">転送量</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" fontWeight="bold" color="warning.main">
                      {(realTimeStats.averageProcessingTime || 0).toFixed(1)}ms
                    </Typography>
                    <Typography variant="body2" color="text.secondary">処理時間</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* 履歴ビュー */}
      {viewMode === 'history' && (
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              📈 メトリクス履歴
            </Typography>
            {metricsHistory.length === 0 ? (
              <Alert severity="info">履歴データがありません。監視を開始してデータを収集してください。</Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>時刻</TableCell>
                      <TableCell>モード</TableCell>
                      <TableCell align="right">データサイズ</TableCell>
                      <TableCell align="right">処理時間</TableCell>
                      <TableCell align="right">メモリ使用量</TableCell>
                      <TableCell align="right">圧縮率</TableCell>
                      <TableCell align="right">変更数</TableCell>
                      <TableCell align="right">学生数</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {metricsHistory.reverse().map((metric, index) => (
                      <TableRow key={index} sx={{
                        backgroundColor: metric.mode === 'delta' ? 'rgba(76, 175, 80, 0.05)' : 'rgba(244, 67, 54, 0.05)'
                      }}>
                        <TableCell>
                          {new Date(metric.timestamp).toLocaleString('ja-JP')}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={metric.mode}
                            color={metric.mode === 'delta' ? 'success' : 'error'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">{formatBytes(metric.dataSize)}</TableCell>
                        <TableCell align="right">{(metric.processingTime || 0).toFixed(1)}ms</TableCell>
                        <TableCell align="right">{formatBytes(metric.memoryUsage)}</TableCell>
                        <TableCell align="right">
                          {metric.mode === 'delta' ? `${((metric.compressionRatio || 0) * 100).toFixed(1)}%` : '-'}
                        </TableCell>
                        <TableCell align="right">{metric.changeCount}</TableCell>
                        <TableCell align="right">{metric.totalStudentCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* 比較ビュー */}
      {viewMode === 'comparison' && (
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              ⚖️ Before/After 詳細比較
            </Typography>
            {(() => {
              const comparison = getLoadComparison();
              return comparison ? (
                <Box sx={{ display: 'grid', gap: 3 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                    <Paper sx={{ p: 2, backgroundColor: '#ffebee' }}>
                      <Typography variant="subtitle1" fontWeight="bold" color="error.main" gutterBottom>
                        Before: フル更新モード
                      </Typography>
                      <Box sx={{ pl: 2 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>平均データサイズ:</strong> {formatBytes(comparison.fullUpdateMetrics?.dataSize || 0)}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>平均処理時間:</strong> {(comparison.fullUpdateMetrics?.processingTime || 0).toFixed(2)}ms
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>平均メモリ使用量:</strong> {formatBytes(comparison.fullUpdateMetrics?.memoryUsage || 0)}
                        </Typography>
                        <Typography variant="body2">
                          <strong>メッセージ数:</strong> {comparison.fullUpdateMetrics?.messageCount || 0}
                        </Typography>
                      </Box>
                    </Paper>
                    <Paper sx={{ p: 2, backgroundColor: '#e8f5e8' }}>
                      <Typography variant="subtitle1" fontWeight="bold" color="success.main" gutterBottom>
                        After: 差分更新モード
                      </Typography>
                      <Box sx={{ pl: 2 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>平均データサイズ:</strong> {formatBytes(comparison.deltaUpdateMetrics?.dataSize || 0)}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>平均処理時間:</strong> {(comparison.deltaUpdateMetrics?.processingTime || 0).toFixed(2)}ms
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>平均メモリ使用量:</strong> {formatBytes(comparison.deltaUpdateMetrics?.memoryUsage || 0)}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>平均圧縮率:</strong> {((comparison.deltaUpdateMetrics?.compressionRatio || 0) * 100).toFixed(1)}%
                        </Typography>
                        <Typography variant="body2">
                          <strong>メッセージ数:</strong> {comparison.deltaUpdateMetrics?.messageCount || 0}
                        </Typography>
                      </Box>
                    </Paper>
                  </Box>
                  <Paper sx={{ p: 2, backgroundColor: '#fff9c4' }}>
                    <Typography variant="subtitle1" fontWeight="bold" color="#a16207" gutterBottom>
                      🎯 改善効果
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" fontWeight="bold" color="success.main">
                          {(comparison.improvements?.dataSizeReduction || 0).toFixed(1)}%
                        </Typography>
                        <Typography variant="body2">データサイズ削減</Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(comparison.improvements?.dataSizeReduction || 0, 100)}
                          color="success"
                          sx={{ mt: 1, height: 6, borderRadius: 3 }}
                        />
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" fontWeight="bold" color="primary">
                          {(comparison.improvements?.processingSpeedup || 0).toFixed(1)}%
                        </Typography>
                        <Typography variant="body2">処理速度向上</Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(comparison.improvements?.processingSpeedup || 0, 100)}
                          sx={{ mt: 1, height: 6, borderRadius: 3 }}
                        />
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" fontWeight="bold" color="secondary.main">
                          {(comparison.improvements?.memoryReduction || 0).toFixed(1)}%
                        </Typography>
                        <Typography variant="body2">メモリ削減</Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(comparison.improvements?.memoryReduction || 0, 100)}
                          color="secondary"
                          sx={{ mt: 1, height: 6, borderRadius: 3 }}
                        />
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" fontWeight="bold" color="warning.main">
                          {formatBytes(comparison.improvements?.bandwidthSavings || 0)}
                        </Typography>
                        <Typography variant="body2">帯域幅削減/分</Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Box>
              ) : (
                <Alert severity="info">
                  比較データがありません。監視を開始して、フル更新と差分更新の両方を実行してください。
                </Alert>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default PerformanceMonitoring;