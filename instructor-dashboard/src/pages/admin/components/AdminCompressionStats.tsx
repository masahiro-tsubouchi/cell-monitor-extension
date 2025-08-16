/**
 * 管理画面用差分更新統計コンポーネント
 * ProgressDashboardから移行された高度な統計機能
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  DataUsage as DataIcon,
  Speed as SpeedIcon,
  CompressOutlined as CompressIcon,
  InfoOutlined as InfoIcon,
  TrendingUp as TrendingUpIcon,
  Memory as MemoryIcon,
  FileDownload as DownloadIcon,
  Refresh as RefreshIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { useProgressDashboardStore } from '../../../stores/progressDashboardStore';
import { performanceMonitor } from '../../../utils/performanceMonitor';

export const AdminCompressionStats: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [realTimeStats, setRealTimeStats] = useState<any>(null);
  const [loadComparison, setLoadComparison] = useState<any>(null);
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);
  
  const { 
    deltaMode,
    enableDeltaMode,
    getCompressionStats,
    performanceMonitoring,
    startPerformanceMonitoring,
    stopPerformanceMonitoring,
    getLoadComparison,
    generatePerformanceReport
  } = useProgressDashboardStore();

  // 統計の定期更新
  useEffect(() => {
    const updateStats = () => {
      try {
        const currentStats = getCompressionStats();
        setStats(currentStats);
        
        const rtStats = performanceMonitor.getRealTimeStats();
        setRealTimeStats(rtStats);
        
        const comparison = getLoadComparison();
        setLoadComparison(comparison);

        // メトリクス履歴取得
        const history = performanceMonitor.getMetricsHistory();
        setMetricsHistory(history.slice(-20)); // 最新20件
      } catch (error) {
        console.error('管理画面統計取得エラー:', error);
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 1000); // 1秒毎に更新

    return () => clearInterval(interval);
  }, [getCompressionStats, getLoadComparison]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handlePerformanceToggle = () => {
    if (performanceMonitoring) {
      stopPerformanceMonitoring();
    } else {
      startPerformanceMonitoring();
    }
  };

  const handleExportDetailedReport = () => {
    const report = generatePerformanceReport();
    const csvData = performanceMonitor.exportToCSV();
    
    const combinedReport = `${report}\n\n=== 詳細CSV データ ===\n${csvData}`;
    
    const blob = new Blob([combinedReport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-performance-detailed-${new Date().toISOString().slice(0, 19)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearMetrics = () => {
    performanceMonitor.clearMetrics();
    setMetricsHistory([]);
  };

  if (!stats) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body1" color="text.secondary">
          統計データを読み込み中...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* 制御パネル */}
      <Card sx={{ mb: 3, border: '2px solid #e3f2fd' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CompressIcon sx={{ color: '#1976d2', fontSize: 28 }} />
              <Typography variant="h6" fontWeight="bold">
                差分更新システム制御
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={deltaMode}
                    onChange={(e) => enableDeltaMode(e.target.checked)}
                    color="success"
                  />
                }
                label={<Typography fontWeight="bold">{deltaMode ? "差分モード" : "フルモード"}</Typography>}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={performanceMonitoring}
                    onChange={handlePerformanceToggle}
                    color="primary"
                  />
                }
                label={<Typography fontWeight="bold">{performanceMonitoring ? "測定中" : "測定開始"}</Typography>}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExportDetailedReport}
              size="small"
            >
              詳細レポート出力
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleClearMetrics}
              size="small"
              color="warning"
            >
              メトリクスクリア
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* メイン統計カード */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3, mb: 3 }}>
        <Card sx={{ textAlign: 'center', height: '100%' }}>
          <CardContent>
            <DataIcon sx={{ fontSize: 40, color: '#2196f3', mb: 1 }} />
            <Typography variant="h3" fontWeight="bold" color="primary">
              {Math.round((stats.averageCompression || 0) * 100)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              平均データ圧縮率
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={Math.min((stats.averageCompression || 0) * 100, 100)}
              sx={{ mt: 1, height: 6, borderRadius: 3 }}
            />
          </CardContent>
        </Card>

        <Card sx={{ textAlign: 'center', height: '100%' }}>
          <CardContent>
            <TrendingUpIcon sx={{ fontSize: 40, color: '#4caf50', mb: 1 }} />
            <Typography variant="h3" fontWeight="bold" color="success.main">
              {stats.updateCount || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              累計差分更新回数
            </Typography>
            <Chip
              label={`${stats.mode || 'unknown'}モード`}
              color={(stats.mode || 'unknown') === 'delta' ? 'success' : 'default'}
              size="small"
              sx={{ mt: 1 }}
            />
          </CardContent>
        </Card>

        <Card sx={{ textAlign: 'center', height: '100%' }}>
          <CardContent>
            <MemoryIcon sx={{ fontSize: 40, color: '#ff9800', mb: 1 }} />
            <Typography variant="h3" fontWeight="bold" color="warning.main">
              {stats.trackedStudents || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              追跡中学生数
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              メモリ使用量: {formatBytes(stats.memoryUsage || 0)}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ textAlign: 'center', height: '100%' }}>
          <CardContent>
            <SpeedIcon sx={{ fontSize: 40, color: '#9c27b0', mb: 1 }} />
            <Typography variant="h3" fontWeight="bold" color="secondary.main">
              {formatBytes(stats.totalSaved || 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              累計転送量削減
            </Typography>
            <Typography variant="caption" color="success.main" display="block">
              推定帯域幅削減: 90%
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* リアルタイム統計 */}
      {realTimeStats && (
        <Card sx={{ mb: 3, backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TimelineIcon sx={{ color: '#0ea5e9', fontSize: 24 }} />
              <Typography variant="h6" fontWeight="bold" color="primary">
                リアルタイム統計 (過去1分間)
              </Typography>
            </Box>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">セッション時間</Typography>
                <Typography variant="h6" fontWeight="bold">
                  {Math.round((realTimeStats.sessionDuration || 0) / 1000)}秒
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">総更新回数</Typography>
                <Typography variant="h6" fontWeight="bold">
                  {realTimeStats.totalUpdates || 0}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">差分更新率</Typography>
                <Typography variant="h6" fontWeight="bold" color="success.main">
                  {(realTimeStats.deltaUpdateRatio || 0).toFixed(1)}%
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">転送データ量</Typography>
                <Typography variant="h6" fontWeight="bold">
                  {formatBytes(realTimeStats.totalDataTransferred || 0)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">平均処理時間</Typography>
                <Typography variant="h6" fontWeight="bold">
                  {(realTimeStats.averageProcessingTime || 0).toFixed(1)}ms
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">帯域幅削減</Typography>
                <Typography variant="h6" fontWeight="bold" color="success.main">
                  {formatBytes(realTimeStats.estimatedBandwidthSaved || 0)}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Before/After比較 */}
      {loadComparison && (
        <Card sx={{ mb: 3, backgroundColor: '#fff9c4', border: '1px solid #facc15' }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" color="#a16207" gutterBottom>
              🎯 実測負荷軽減効果
            </Typography>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
              <Box>
                <Typography variant="subtitle2" fontWeight="bold" color="error.main" gutterBottom>
                  Before (フル更新)
                </Typography>
                <Box sx={{ pl: 2 }}>
                  <Typography variant="body2">データサイズ: {formatBytes(loadComparison.fullUpdateMetrics?.dataSize || 0)}</Typography>
                  <Typography variant="body2">処理時間: {(loadComparison.fullUpdateMetrics?.processingTime || 0).toFixed(2)}ms</Typography>
                  <Typography variant="body2">メモリ使用量: {formatBytes(loadComparison.fullUpdateMetrics?.memoryUsage || 0)}</Typography>
                </Box>
              </Box>
              
              <Box>
                <Typography variant="subtitle2" fontWeight="bold" color="success.main" gutterBottom>
                  After (差分更新)
                </Typography>
                <Box sx={{ pl: 2 }}>
                  <Typography variant="body2">データサイズ: {formatBytes(loadComparison.deltaUpdateMetrics?.dataSize || 0)}</Typography>
                  <Typography variant="body2">処理時間: {(loadComparison.deltaUpdateMetrics?.processingTime || 0).toFixed(2)}ms</Typography>
                  <Typography variant="body2">メモリ使用量: {formatBytes(loadComparison.deltaUpdateMetrics?.memoryUsage || 0)}</Typography>
                  <Typography variant="body2">圧縮率: {((loadComparison.deltaUpdateMetrics?.compressionRatio || 0) * 100).toFixed(1)}%</Typography>
                </Box>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={`データ削減 ${(loadComparison.improvements?.dataSizeReduction || 0).toFixed(1)}%`}
                color="success"
                size="small"
              />
              <Chip
                label={`速度向上 ${(loadComparison.improvements?.processingSpeedup || 0).toFixed(1)}%`}
                color="primary"
                size="small"
              />
              <Chip
                label={`メモリ削減 ${(loadComparison.improvements?.memoryReduction || 0).toFixed(1)}%`}
                color="secondary"
                size="small"
              />
              <Chip
                label={`帯域削減 ${formatBytes(loadComparison.improvements?.bandwidthSavings || 0)}/分`}
                color="warning"
                size="small"
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* メトリクス履歴テーブル */}
      {metricsHistory.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              📊 最新メトリクス履歴
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>時刻</TableCell>
                    <TableCell>モード</TableCell>
                    <TableCell align="right">データサイズ</TableCell>
                    <TableCell align="right">処理時間</TableCell>
                    <TableCell align="right">圧縮率</TableCell>
                    <TableCell align="right">変更数</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metricsHistory.map((metric, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {new Date(metric.timestamp).toLocaleTimeString('ja-JP')}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={metric.mode}
                          color={metric.mode === 'delta' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">{formatBytes(metric.dataSize || 0)}</TableCell>
                      <TableCell align="right">{(metric.processingTime || 0).toFixed(1)}ms</TableCell>
                      <TableCell align="right">
                        {metric.mode === 'delta' ? `${((metric.compressionRatio || 0) * 100).toFixed(1)}%` : '-'}
                      </TableCell>
                      <TableCell align="right">{metric.changeCount || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default AdminCompressionStats;