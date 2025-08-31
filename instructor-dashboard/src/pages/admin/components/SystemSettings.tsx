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
  Button,
  Divider,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip
} from '@mui/material';
import {
  Save as SaveIcon,
  RestoreOutlined as RestoreIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useProgressDashboardStore } from '../../../stores/progressDashboardStore';

interface SystemConfig {
  // 核心機能（必須）
  deltaUpdateEnabled: boolean;
  autoRefreshEnabled: boolean;
  
  // 運用支援（推奨）
  performanceMonitoringEnabled: boolean;
  debugModeEnabled: boolean;
  
  // 運用柔軟性（新規）
  websocketFallbackEnabled: boolean;
  
  // セキュリティ設定
  adminAccessEnabled: boolean;
}

const defaultConfig: SystemConfig = {
  deltaUpdateEnabled: true,
  autoRefreshEnabled: true,
  performanceMonitoringEnabled: false,
  debugModeEnabled: false,
  websocketFallbackEnabled: false,
  adminAccessEnabled: true
};

export const SystemSettings: React.FC = () => {
  const [config, setConfig] = useState<SystemConfig>(defaultConfig);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
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
        {/* 核心機能設定 */}
        <Box>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SpeedIcon color="primary" />
                <Typography variant="h6" fontWeight="bold">核心機能設定</Typography>
              </Box>

              <Tooltip 
                title="オン: 変更データのみ送信で90%転送量削減、200名環境で必須
オフ: 全データ送信でネットワーク負荷増大、緊急時のみ"
                placement="right"
                arrow
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.deltaUpdateEnabled}
                      onChange={(e) => handleConfigChange('deltaUpdateEnabled', e.target.checked)}
                      color="success"
                    />
                  }
                  label="差分更新を有効化 (90%データ転送削減)"
                  sx={{ mb: 2 }}
                />
              </Tooltip>

              <Tooltip 
                title="オン: 5-15秒間隔で自動データ更新、リアルタイム監視に必須
オフ: 手動更新のみ、学生状況の把握が遅れる可能性"
                placement="right"
                arrow
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.autoRefreshEnabled}
                      onChange={(e) => handleConfigChange('autoRefreshEnabled', e.target.checked)}
                      color="secondary"
                    />
                  }
                  label="自動リフレッシュを有効化 (リアルタイム監視)"
                />
              </Tooltip>
            </CardContent>
          </Card>
        </Box>

        {/* 運用支援設定 */}
        <Box>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <StorageIcon color="warning" />
                <Typography variant="h6" fontWeight="bold">運用支援設定</Typography>
              </Box>

              <Tooltip 
                title="オン: システム性能を詳細測定、問題発見に有効
オフ: 通常運用時、CPU使用量を若干軽減"
                placement="right"
                arrow
              >
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
              </Tooltip>

              <Tooltip 
                title="オン: WebSocket接続失敗時に自動でポーリングに切替
オフ: WebSocketのみ、接続問題時に更新停止の可能性"
                placement="right"
                arrow
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.websocketFallbackEnabled}
                      onChange={(e) => handleConfigChange('websocketFallbackEnabled', e.target.checked)}
                      color="info"
                    />
                  }
                  label="WebSocket代替モード (接続問題時の自動切替)"
                />
              </Tooltip>
            </CardContent>
          </Card>
        </Box>

      </Box>
      
      {/* セキュリティ・デバッグ設定 */}
      <Card sx={{ backgroundColor: '#fafafa', mt: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <SecurityIcon color="error" />
            <Typography variant="h6" fontWeight="bold">セキュリティ・デバッグ設定</Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Tooltip 
              title="オン: このシステム設定画面へのアクセス許可
オフ: セキュリティ強化、設定変更を禁止"
              placement="top"
              arrow
            >
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
            </Tooltip>
            <Tooltip 
              title="オン: 詳細ログ出力でトラブルシューティング支援
オフ: 通常運用、本番環境では基本的にオフ推奨"
              placement="top"
              arrow
            >
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
            </Tooltip>
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
              secondary={autoRefresh ? '有効 - スマート間隔調整' : '無効'}
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