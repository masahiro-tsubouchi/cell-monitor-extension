/**
 * 管理画面 - Phase 1実装
 * 差分更新統計、システム設定、パフォーマンス監視の管理
 */

import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  Divider,
  Button,
  Alert,
  Breadcrumbs,
  Link
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Speed as SpeedIcon,
  Home as HomeIcon,
  AdminPanelSettings as AdminIcon,
  Storage as StorageIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// 管理画面専用コンポーネント
import { SystemSettings } from './components/SystemSettings';
import { PerformanceMonitoring } from './components/PerformanceMonitoring';
import { DatabaseManagement } from './components/DatabaseManagement';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const a11yProps = (index: number) => {
  return {
    id: `admin-tab-${index}`,
    'aria-controls': `admin-tabpanel-${index}`,
  };
};

export const AdminPanel: React.FC = () => {
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 3 }}>
        {/* パンくずリスト */}
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            underline="hover"
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            color="inherit"
            onClick={handleBackToDashboard}
          >
            <HomeIcon sx={{ mr: 0.5, fontSize: 16 }} />
            ダッシュボード
          </Link>
          <Typography
            sx={{ display: 'flex', alignItems: 'center' }}
            color="text.primary"
          >
            <AdminIcon sx={{ mr: 0.5, fontSize: 16 }} />
            管理画面
          </Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
              🔧 システム管理画面
            </Typography>
            <Typography variant="body1" color="text.secondary">
              差分更新システムの監視・設定とパフォーマンス分析
            </Typography>
          </Box>

          <Button
            variant="outlined"
            startIcon={<HomeIcon />}
            onClick={handleBackToDashboard}
            sx={{ fontWeight: 'bold' }}
          >
            ダッシュボードに戻る
          </Button>
        </Box>
      </Box>

      {/* 統合完了状況の表示 */}
      <Alert severity="success" sx={{ mb: 3 }}>
        <Typography variant="body2" fontWeight="bold">
          📋 統合パフォーマンス監視実装完了
        </Typography>
        <Typography variant="caption" display="block">
          • 差分更新統計とパフォーマンス監視の統合 ✅
          • システム設定管理UI ✅
          • システム簡素化完了 ✅
        </Typography>
      </Alert>

      {/* タブナビゲーション */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            aria-label="管理画面タブ"
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': {
                minHeight: 64,
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 500
              }
            }}
          >
            <Tab
              icon={<SpeedIcon />}
              label="統合パフォーマンス監視"
              {...a11yProps(0)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'rgba(76, 175, 80, 0.04)'
                }
              }}
            />
            <Tab
              icon={<SettingsIcon />}
              label="システム設定"
              {...a11yProps(1)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'rgba(255, 152, 0, 0.04)'
                }
              }}
            />
            <Tab
              icon={<StorageIcon />}
              label="データベース管理"
              {...a11yProps(2)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'rgba(63, 81, 181, 0.04)'
                }
              }}
            />
          </Tabs>
        </Box>

        {/* タブコンテンツ */}
        <TabPanel value={currentTab} index={0}>
          <PerformanceMonitoring />
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <SystemSettings />
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <DatabaseManagement />
        </TabPanel>
      </Paper>

      <Divider sx={{ my: 4 }} />

      {/* フッター情報 */}
      <Box sx={{ textAlign: 'center', mt: 4, py: 2 }}>
        <Typography variant="caption" color="text.secondary">
          JupyterLab Cell Monitor Extension v2.0 - 統合パフォーマンス監視
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          最終更新: {new Date().toLocaleString('ja-JP')}
        </Typography>
      </Box>
    </Container>
  );
};

export default AdminPanel;