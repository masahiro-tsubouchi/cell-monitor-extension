/**
 * システム設定管理コンポーネント
 * 差分更新、WebSocket、リフレッシュ間隔などの設定
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Divider,
  Alert,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  // Settings as SettingsIcon,
  Save as SaveIcon,
  RestoreOutlined as RestoreIcon,
  Wifi as WebSocketIcon,
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useProgressDashboardStore } from '../../../stores/progressDashboardStore';

interface SystemConfig {
  // 差分更新設定
  deltaUpdateEnabled: boolean;
  compressionThreshold: number;
  batchSize: number;
  
  // リフレッシュ設定
  autoRefreshEnabled: boolean;
  refreshInterval: number;
  smartRefreshEnabled: boolean;
  
  // WebSocket設定
  websocketEnabled: boolean;
  reconnectAttempts: number;
  heartbeatInterval: number;
  
  // パフォーマンス設定
  performanceMonitoringEnabled: boolean;
  metricsRetentionDays: number;
  
  // セキュリティ設定
  adminAccessEnabled: boolean;
  debugModeEnabled: boolean;
}

const defaultConfig: SystemConfig = {
  deltaUpdateEnabled: true,
  compressionThreshold: 0.1,
  batchSize: 50,
  autoRefreshEnabled: true,
  refreshInterval: 5000,
  smartRefreshEnabled: true,
  websocketEnabled: true,
  reconnectAttempts: 3,
  heartbeatInterval: 30000,
  performanceMonitoringEnabled: false,
  metricsRetentionDays: 7,
  adminAccessEnabled: true,
  debugModeEnabled: false
};

export const SystemSettings: React.FC = () => {
  const [config, setConfig] = useState<SystemConfig>(defaultConfig);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [connectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connected');
  
  const {
    deltaMode,
    enableDeltaMode,
    autoRefresh,
    setAutoRefresh,
    performanceMonitoring,
    startPerformanceMonitoring,
    stopPerformanceMonitoring
  } = useProgressDashboardStore();

  // 初期設定読み込み
  useEffect(() => {
    const savedConfig = localStorage.getItem('systemConfig');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig({ ...defaultConfig, ...parsed });
      } catch (error) {
      }
    }
  }, []);

  // 設定保存
  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      // ローカルストレージに保存
      localStorage.setItem('systemConfig', JSON.stringify(config));
      
      // Zustand storeの設定を更新
      enableDeltaMode(config.deltaUpdateEnabled);
      setAutoRefresh(config.autoRefreshEnabled);
      
      if (config.performanceMonitoringEnabled && !performanceMonitoring) {
        startPerformanceMonitoring();
      } else if (!config.performanceMonitoringEnabled && performanceMonitoring) {
        stopPerformanceMonitoring();
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // 設定リセット
  const handleReset = () => {
    setConfig(defaultConfig);
    localStorage.removeItem('systemConfig');
  };

  const handleConfigChange = (key: keyof SystemConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* 保存状態表示 */}
      {saveStatus !== 'idle' && (
        <Alert 
          severity={saveStatus === 'saved' ? 'success' : saveStatus === 'error' ? 'error' : 'info'} 
          sx={{ mb: 3 }}
        >
          {saveStatus === 'saving' && '設定を保存中...'}
          {saveStatus === 'saved' && '設定が正常に保存されました'}
          {saveStatus === 'error' && '設定の保存に失敗しました'}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
        {/* 差分更新設定 */}
        <Box>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SpeedIcon color="primary" />
                <Typography variant="h6" fontWeight="bold">差分更新設定</Typography>
              </Box>

              <FormControlLabel
                control={
                  <Switch
                    checked={config.deltaUpdateEnabled}
                    onChange={(e) => handleConfigChange('deltaUpdateEnabled', e.target.checked)}
                    color="success"
                  />
                }
                label="差分更新を有効化"
                sx={{ mb: 2 }}
              />

              <Box sx={{ mb: 2 }}>
                <Typography gutterBottom>圧縮閾値 ({(config.compressionThreshold * 100).toFixed(0)}%)</Typography>
                <Slider
                  value={config.compressionThreshold}
                  onChange={(e, value) => handleConfigChange('compressionThreshold', value)}
                  min={0.05}
                  max={0.5}
                  step={0.05}
                  marks={[
                    { value: 0.1, label: '10%' },
                    { value: 0.25, label: '25%' },
                    { value: 0.5, label: '50%' }
                  ]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
                />
              </Box>

              <TextField
                label="バッチサイズ"
                type="number"
                value={config.batchSize}
                onChange={(e) => handleConfigChange('batchSize', parseInt(e.target.value) || 50)}
                fullWidth
                size="small"
                InputProps={{ inputProps: { min: 10, max: 1000 } }}
              />
            </CardContent>
          </Card>
        </Box>

        {/* リフレッシュ設定 */}
        <Box>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <RefreshIcon color="secondary" />
                <Typography variant="h6" fontWeight="bold">リフレッシュ設定</Typography>
              </Box>

              <FormControlLabel
                control={
                  <Switch
                    checked={config.autoRefreshEnabled}
                    onChange={(e) => handleConfigChange('autoRefreshEnabled', e.target.checked)}
                    color="secondary"
                  />
                }
                label="自動リフレッシュを有効化"
                sx={{ mb: 2 }}
              />

              <TextField
                label="リフレッシュ間隔 (ミリ秒)"
                type="number"
                value={config.refreshInterval}
                onChange={(e) => handleConfigChange('refreshInterval', parseInt(e.target.value) || 5000)}
                fullWidth
                size="small"
                sx={{ mb: 2 }}
                InputProps={{ inputProps: { min: 1000, max: 60000 } }}
                helperText={`現在: ${config.refreshInterval / 1000}秒間隔`}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={config.smartRefreshEnabled}
                    onChange={(e) => handleConfigChange('smartRefreshEnabled', e.target.checked)}
                    color="info"
                  />
                }
                label="スマートリフレッシュ (展開状態に応じた頻度調整)"
              />
            </CardContent>
          </Card>
        </Box>

        {/* WebSocket設定 */}
        <Box>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <WebSocketIcon color="success" />
                <Typography variant="h6" fontWeight="bold">WebSocket設定</Typography>
                <Chip 
                  label={connectionStatus} 
                  color={connectionStatus === 'connected' ? 'success' : 'error'} 
                  size="small" 
                />
              </Box>

              <FormControlLabel
                control={
                  <Switch
                    checked={config.websocketEnabled}
                    onChange={(e) => handleConfigChange('websocketEnabled', e.target.checked)}
                    color="success"
                  />
                }
                label="WebSocket接続を有効化"
                sx={{ mb: 2 }}
              />

              <TextField
                label="再接続試行回数"
                type="number"
                value={config.reconnectAttempts}
                onChange={(e) => handleConfigChange('reconnectAttempts', parseInt(e.target.value) || 3)}
                fullWidth
                size="small"
                sx={{ mb: 2 }}
                InputProps={{ inputProps: { min: 1, max: 10 } }}
              />

              <TextField
                label="ハートビート間隔 (ミリ秒)"
                type="number"
                value={config.heartbeatInterval}
                onChange={(e) => handleConfigChange('heartbeatInterval', parseInt(e.target.value) || 30000)}
                fullWidth
                size="small"
                helperText={`現在: ${config.heartbeatInterval / 1000}秒間隔`}
              />
            </CardContent>
          </Card>
        </Box>

        {/* パフォーマンス設定 */}
        <Box>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <StorageIcon color="warning" />
                <Typography variant="h6" fontWeight="bold">パフォーマンス設定</Typography>
              </Box>

              <FormControlLabel
                control={
                  <Switch
                    checked={config.performanceMonitoringEnabled}
                    onChange={(e) => handleConfigChange('performanceMonitoringEnabled', e.target.checked)}
                    color="warning"
                  />
                }
                label="パフォーマンス監視を有効化"
                sx={{ mb: 2 }}
              />

              <FormControl fullWidth size="small">
                <InputLabel>メトリクス保持期間</InputLabel>
                <Select
                  value={config.metricsRetentionDays}
                  onChange={(e) => handleConfigChange('metricsRetentionDays', e.target.value)}
                  label="メトリクス保持期間"
                >
                  <MenuItem value={1}>1日</MenuItem>
                  <MenuItem value={3}>3日</MenuItem>
                  <MenuItem value={7}>1週間</MenuItem>
                  <MenuItem value={14}>2週間</MenuItem>
                  <MenuItem value={30}>1ヶ月</MenuItem>
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Box>

        {/* セキュリティ設定 */}
        <Card sx={{ backgroundColor: '#fafafa', mt: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <SecurityIcon color="error" />
              <Typography variant="h6" fontWeight="bold">セキュリティ・デバッグ設定</Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.adminAccessEnabled}
                    onChange={(e) => handleConfigChange('adminAccessEnabled', e.target.checked)}
                    color="error"
                  />
                }
                label="管理画面アクセスを有効化"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={config.debugModeEnabled}
                    onChange={(e) => handleConfigChange('debugModeEnabled', e.target.checked)}
                    color="warning"
                  />
                }
                label="デバッグモードを有効化"
              />
            </Box>

            {config.debugModeEnabled && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                デバッグモードが有効です。本番環境では無効にしてください。
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* 現在の設定状況 */}
        <Paper sx={{ p: 2, backgroundColor: '#f9f9f9', mt: 3 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            現在のシステム状況
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                {deltaMode ? <CheckIcon color="success" /> : <ErrorIcon color="error" />}
              </ListItemIcon>
              <ListItemText 
                primary="差分更新モード" 
                secondary={deltaMode ? '有効 - データ転送量90%削減中' : '無効 - フル更新モード'}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                {autoRefresh ? <CheckIcon color="success" /> : <ErrorIcon color="error" />}
              </ListItemIcon>
              <ListItemText 
                primary="自動リフレッシュ" 
                secondary={autoRefresh ? `有効 - ${config.refreshInterval / 1000}秒間隔` : '無効'}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                {performanceMonitoring ? <CheckIcon color="success" /> : <InfoIcon color="info" />}
              </ListItemIcon>
              <ListItemText 
                primary="パフォーマンス監視" 
                secondary={performanceMonitoring ? '測定中' : '停止中'}
              />
            </ListItem>
          </List>
        </Paper>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* アクションボタン */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<RestoreIcon />}
          onClick={handleReset}
          color="warning"
        >
          初期設定に戻す
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? '保存中...' : '設定を保存'}
        </Button>
      </Box>
    </Box>
  );
};

export default SystemSettings;