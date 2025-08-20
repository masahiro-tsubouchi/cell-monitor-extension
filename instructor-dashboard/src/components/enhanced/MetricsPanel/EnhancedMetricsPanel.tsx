/**
 * Enhanced Metrics Panel Component
 * Phase 1.2: 強化メトリクスパネル
 * 
 * 機能:
 * - クラス全体の統計情報表示
 * - 緊急監視はCriticalAlertBarに統合済み
 * - トレンド表示で状況変化を一目で把握
 */

import React, { memo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  People as PeopleIcon,
  Code as CodeIcon,
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
  // 学生の状態別集計 (緊急監視除く)
  const activeCount = students.filter(s => s.status === 'active').length;
  const totalStudents = students.length;

  // 活動度の計算
  const totalExecutions = students.reduce((sum, s) => sum + (s.cellExecutions || 0), 0);
  const averageExecutions = totalStudents > 0 ? Math.round(totalExecutions / totalStudents) : 0;

  return (
    <Box>
      {/* クラス統計情報 - 緊急監視はCriticalAlertBarに移行 */}
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold', color: 'text.primary' }}>
        📊 クラス統計
      </Typography>
      
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 3, mb: 4 }}>
        <CriticalMetricCard
          title="総学生数"
          count={totalStudents}
          color="#2196f3"
          icon={<PeopleIcon />}
          urgent={false}
          trend={0}
        />
        
        <CriticalMetricCard
          title="アクティブ"
          count={activeCount}
          color="#4caf50"
          icon={<CheckCircleIcon />}
          urgent={false}
          trend={0}
        />
        
        <CriticalMetricCard
          title="平均実行回数"
          count={averageExecutions}
          color="#9c27b0"
          icon={<CodeIcon />}
          urgent={false}
          trend={0}
        />
      </Box>


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