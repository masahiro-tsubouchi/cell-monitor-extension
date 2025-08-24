/**
 * ActivityTooltip コンポーネント
 * 活動状態の詳細情報をツールチップで表示
 */

import React from 'react';
import {
  Box,
  Typography,
  Divider,
  Chip
} from '@mui/material';
import { HelpOutline as HelpIcon } from '@mui/icons-material';
import { StudentActivity } from '../../services/dashboardAPI';
import { 
  getActivityStatus 
} from '../../utils/activityStatus';

interface ActivityTooltipProps {
  student: StudentActivity;
  score: number;
}

export const ActivityTooltip: React.FC<ActivityTooltipProps> = ({ 
  student, 
  score 
}) => {
  const status = getActivityStatus(score, student);
  const errorRate = (student.errorCount / Math.max(student.cellExecutions, 1)) * 100;
  
  return (
    <Box sx={{ p: 1, minWidth: 200 }}>
      {/* 状態ラベル */}
      <Typography 
        variant="body2" 
        sx={{ fontWeight: 'bold', mb: 1, color: getStatusDisplayColor(status.status) }}
      >
        {status.label}
      </Typography>
      
      <Divider sx={{ mb: 1 }} />
      
      {/* 詳細スコア情報 */}
      <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
        📈 活動スコア: <strong>{score.toFixed(1)}/100点</strong>
      </Typography>
      
      <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
        🔢 セル実行: <strong>{student.cellExecutions}回</strong>
      </Typography>
      
      <Typography 
        variant="caption" 
        display="block" 
        sx={{ 
          mb: 0.5,
          color: errorRate > 30 ? 'error.main' : 'text.secondary'
        }}
      >
        ❌ エラー率: <strong>{errorRate.toFixed(1)}%</strong>
      </Typography>
      
      <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
        ⏰ 最終活動: <strong>{student.lastActivity}</strong>
      </Typography>
      
      {/* ヘルプ要請バッジ */}
      {student.isRequestingHelp && (
        <Box sx={{ mt: 1 }}>
          <Chip 
            icon={<HelpIcon />} 
            label="ヘルプ要請中" 
            color="error" 
            size="small" 
            variant="filled"
            sx={{ 
              fontSize: '10px',
              height: '20px',
              animation: 'pulse 2s infinite'
            }}
          />
        </Box>
      )}
      
      {/* スコア構成の簡単な説明 */}
      <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #e0e0e0' }}>
        <Typography 
          variant="caption" 
          sx={{ 
            fontSize: '10px', 
            color: 'text.secondary',
            fontStyle: 'italic'
          }}
        >
          スコア = 実行回数(40点) + 活動度(30点) - エラー率(20点) + ヘルプ(10点)
        </Typography>
      </Box>
    </Box>
  );
};

// 状態別表示色
const getStatusDisplayColor = (status: 'good' | 'warning' | 'stopped' | 'error'): string => {
  const colorMap = {
    good: '#2e7d32',      // 濃い緑
    warning: '#ed6c02',   // 濃いオレンジ
    stopped: '#f57c00',   // 濃い琥珀色
    error: '#d32f2f'      // 濃い赤
  };
  return colorMap[status];
};

export default ActivityTooltip;