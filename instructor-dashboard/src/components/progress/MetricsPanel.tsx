import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip
} from '@mui/material';
import {
  People as PeopleIcon,
  PlayArrow as ActiveIcon,
  Error as ErrorIcon,
  Code as ExecutionIcon,
  Help as HelpIcon
} from '@mui/icons-material';
import { DashboardMetrics } from '../../services/dashboardAPI';

interface MetricsPanelProps {
  metrics: DashboardMetrics;
  lastUpdated?: Date | null;
}

interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'primary' | 'success' | 'warning' | 'error' | 'info';
  subtitle?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  color,
  subtitle
}) => {
  const getColorValue = (color: string) => {
    switch (color) {
      case 'primary':
        return '#1976d2';
      case 'success':
        return '#2e7d32';
      case 'warning':
        return '#ed6c02';
      case 'error':
        return '#d32f2f';
      case 'info':
        return '#0288d1';
      default:
        return '#1976d2';
    }
  };

  return (
    <Card
      sx={{
        height: '100%',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: `${getColorValue(color)}20`,
              mr: 2
            }}
          >
            <Box sx={{ color: getColorValue(color) }}>
              {icon}
            </Box>
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" component="div" fontWeight="bold">
              {value.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
          </Box>
        </Box>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  metrics,
  lastUpdated
}) => {
  const activePercentage = metrics.totalStudents > 0
    ? Math.round((metrics.totalActive / metrics.totalStudents) * 100)
    : 0;

  const errorPercentage = metrics.totalStudents > 0
    ? Math.round((metrics.errorCount / metrics.totalStudents) * 100)
    : 0;

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" component="h2" fontWeight="bold">
          📊 クラス概要
        </Typography>
        {lastUpdated && (
          <Chip
            label={`最終更新: ${lastUpdated.toLocaleTimeString()}`}
            size="small"
            variant="outlined"
          />
        )}
      </Box>

      {/* メトリクスカード */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(5, 1fr)' }, gap: 3 }}>
        <MetricCard
          title="総学生数"
          value={metrics.totalStudents}
          icon={<PeopleIcon />}
          color="primary"
          subtitle="登録された学生の総数"
        />

        <MetricCard
          title="アクティブ"
          value={metrics.totalActive}
          icon={<ActiveIcon />}
          color="success"
          subtitle={`アクティブ率: ${activePercentage}%`}
        />

        <MetricCard
          title="エラー発生"
          value={metrics.errorCount}
          icon={<ErrorIcon />}
          color="error"
          subtitle={`エラー率: ${errorPercentage}%`}
        />

        <MetricCard
          title="総実行回数"
          value={metrics.totalExecutions}
          icon={<ExecutionIcon />}
          color="info"
          subtitle="全学生のセル実行回数合計"
        />

        <MetricCard
          title="ヘルプ要求"
          value={metrics.helpCount}
          icon={<HelpIcon />}
          color="warning"
          subtitle="学生からのヘルプ要求数"
        />
      </Box>

      {/* アラート表示 */}
      {(metrics.errorCount > 0 || metrics.helpCount > 0) && (
        <Box sx={{ mt: 2 }}>
          {metrics.errorCount > 0 && (
            <Chip
              icon={<ErrorIcon />}
              label={`${metrics.errorCount}名の学生がエラー状態です`}
              color="error"
              variant="outlined"
              sx={{ mr: 1, mb: 1 }}
            />
          )}
          {metrics.helpCount > 0 && (
            <Chip
              icon={<HelpIcon />}
              label={`${metrics.helpCount}件のヘルプ要求があります`}
              color="warning"
              variant="outlined"
              sx={{ mr: 1, mb: 1 }}
            />
          )}
        </Box>
      )}
    </Box>
  );
};

export default MetricsPanel;
