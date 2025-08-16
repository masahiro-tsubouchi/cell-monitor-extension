/**
 * Enhanced Metrics Panel Component
 * Phase 1.2: 強化メトリクスパネル
 * 
 * 機能:
 * - 3階層の情報表示で重要度を視覚的に区別
 * - 緊急レベル（ヘルプ・エラー）を最上部に大きく表示
 * - トレンド表示で状況変化を一目で把握
 */

import React, { memo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  Help as HelpIcon,
  Error as ErrorIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  People as PeopleIcon,
  Code as CodeIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { DashboardMetrics, StudentActivity } from '../../../services/dashboardAPI';

interface EnhancedMetricsPanelProps {
  metrics: DashboardMetrics;
  students: StudentActivity[];
  lastUpdated?: Date | null;
}

interface CriticalMetricCardProps {
  title: string;
  count: number;
  trend?: number; // 前回からの変化
  color: string;
  icon: React.ReactNode;
  urgent?: boolean;
}

const CriticalMetricCard: React.FC<CriticalMetricCardProps> = memo(({
  title,
  count,
  trend = 0,
  color,
  icon,
  urgent = false
}) => {
  const getTrendIcon = () => {
    if (trend > 0) return <TrendingUpIcon sx={{ fontSize: 16, color: '#f44336' }} />;
    if (trend < 0) return <TrendingDownIcon sx={{ fontSize: 16, color: '#4caf50' }} />;
    return null;
  };

  return (
    <Card
      sx={{
        height: '100%',
        border: urgent ? `3px solid ${color}` : `1px solid ${color}20`,
        backgroundColor: urgent ? `${color}08` : 'background.paper',
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: urgent ? `0 8px 32px ${color}40` : 4
        },
        ...(urgent && {
          animation: 'pulse 2s ease-in-out infinite',
          '@keyframes pulse': {
            '0%': { 
              boxShadow: `0 0 0 0 ${color}40`,
              borderColor: color
            },
            '50%': { 
              boxShadow: `0 0 0 8px ${color}20`,
              borderColor: `${color}80`
            },
            '100%': { 
              boxShadow: `0 0 0 0 ${color}40`,
              borderColor: color
            }
          }
        })
      }}
    >
      <CardContent sx={{ p: 3, textAlign: 'center' }}>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          gap: 1
        }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: urgent ? 80 : 60,
              height: urgent ? 80 : 60,
              borderRadius: '50%',
              bgcolor: `${color}20`,
              mb: 1
            }}
          >
            <Box sx={{ color: color, fontSize: urgent ? '2rem' : '1.5rem' }}>
              {icon}
            </Box>
          </Box>

          <Typography 
            variant={urgent ? "h3" : "h4"} 
            sx={{ 
              fontWeight: 'bold',
              color: urgent ? color : 'text.primary',
              mb: 0.5
            }}
          >
            {count}
          </Typography>

          <Typography 
            variant={urgent ? "h6" : "body1"} 
            sx={{ 
              fontWeight: urgent ? 'bold' : 'medium',
              color: urgent ? color : 'text.secondary'
            }}
          >
            {title}
          </Typography>

          {trend !== 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {getTrendIcon()}
              <Typography 
                variant="caption" 
                sx={{ 
                  color: trend > 0 ? '#f44336' : '#4caf50',
                  fontWeight: 'bold'
                }}
              >
                {trend > 0 ? '+' : ''}{trend}
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
});

CriticalMetricCard.displayName = 'CriticalMetricCard';

export const EnhancedMetricsPanel: React.FC<EnhancedMetricsPanelProps> = memo(({
  metrics,
  students,
  lastUpdated
}) => {
  // 学生の状態別集計
  const helpCount = students.filter(s => s.status === 'help').length;
  const errorCount = students.filter(s => s.status === 'error').length;
  const activeCount = students.filter(s => s.status === 'active').length;
  const totalStudents = students.length;

  // 活動度の計算
  const totalExecutions = students.reduce((sum, s) => sum + (s.cellExecutions || 0), 0);
  const averageExecutions = totalStudents > 0 ? Math.round(totalExecutions / totalStudents) : 0;

  return (
    <Box>
      {/* Critical Metrics - 最重要エリア */}
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold', color: 'text.primary' }}>
        🔴 緊急監視
      </Typography>
      
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 3, mb: 4 }}>
        <CriticalMetricCard
          title="ヘルプ要請"
          count={helpCount}
          color="#ff5722"
          icon={<HelpIcon />}
          urgent={helpCount > 0}
          trend={0} // TODO: 前回との差分を計算
        />
        
        <CriticalMetricCard
          title="エラー発生"
          count={errorCount}
          color="#ff9800"
          icon={<ErrorIcon />}
          urgent={errorCount > 5}
          trend={0} // TODO: 前回との差分を計算
        />
      </Box>

      {/* Activity Overview - 概要エリア */}
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'text.primary' }}>
        📊 活動概要
      </Typography>
      
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <Card sx={{ textAlign: 'center', p: 2 }}>
          <PeopleIcon sx={{ fontSize: 40, color: '#1976d2', mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            {totalStudents}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            総受講生数
          </Typography>
        </Card>

        <Card sx={{ textAlign: 'center', p: 2 }}>
          <CheckCircleIcon sx={{ fontSize: 40, color: '#4caf50', mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            {activeCount}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            アクティブ
          </Typography>
        </Card>

        <Card sx={{ textAlign: 'center', p: 2 }}>
          <CodeIcon sx={{ fontSize: 40, color: '#9c27b0', mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            {totalExecutions}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            総実行回数
          </Typography>
        </Card>

        <Card sx={{ textAlign: 'center', p: 2 }}>
          <ScheduleIcon sx={{ fontSize: 40, color: '#607d8b', mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            {averageExecutions}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            平均実行回数
          </Typography>
        </Card>
      </Box>

      {/* 活動率の可視化 */}
      <Card sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          📈 活動率ダッシュボード
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">アクティブ率</Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {totalStudents > 0 ? Math.round((activeCount / totalStudents) * 100) : 0}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={totalStudents > 0 ? (activeCount / totalStudents) * 100 : 0}
            sx={{
              height: 8,
              borderRadius: 4,
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#4caf50'
              }
            }}
          />
        </Box>

        {helpCount > 0 && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="error">ヘルプ要請率</Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                {Math.round((helpCount / totalStudents) * 100)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={(helpCount / totalStudents) * 100}
              sx={{
                height: 8,
                borderRadius: 4,
                '& .MuiLinearProgress-bar': {
                  backgroundColor: '#ff5722'
                }
              }}
            />
          </Box>
        )}
      </Card>

      {/* 最終更新情報 */}
      {lastUpdated && (
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Chip
            label={`最終更新: ${lastUpdated.toLocaleTimeString()}`}
            size="small"
            variant="outlined"
            sx={{ color: 'text.secondary' }}
          />
        </Box>
      )}
    </Box>
  );
});

EnhancedMetricsPanel.displayName = 'EnhancedMetricsPanel';

export default EnhancedMetricsPanel;