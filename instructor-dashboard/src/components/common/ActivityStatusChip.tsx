/**
 * ActivityStatusChip コンポーネント
 * 活動スコアを4段階の直感的な状態表示に変換
 * 数値スコア(0-100点) → 視覚的なチップ表示
 */

import React, { useMemo } from 'react';
import {
  Chip,
  Tooltip,
  Box
} from '@mui/material';
import { StudentActivity } from '../../services/dashboardAPI';
import { 
  getActivityStatus,
  getChipColor,
  calculateActivityScore 
} from '../../utils/activityStatus';
import { ActivityIcon } from './ActivityIcon';
import { ActivityTooltip } from './ActivityTooltip';

interface ActivityStatusChipProps {
  student: StudentActivity;
  score?: number; // 外部から渡される場合はそれを使用
  size?: 'small' | 'medium';
  showTooltip?: boolean;
  onClick?: () => void;
}

export const ActivityStatusChip: React.FC<ActivityStatusChipProps> = ({
  student,
  score: providedScore,
  size = 'small',
  showTooltip = true,
  onClick
}) => {
  // スコア計算（外部から提供されない場合は内部で計算）
  const score = useMemo(() => {
    return providedScore !== undefined ? providedScore : calculateActivityScore(student);
  }, [providedScore, student]);
  
  // 状態判定
  const status = useMemo(() => {
    return getActivityStatus(score, student);
  }, [score, student]);
  
  const chipContent = (
    <Chip
      icon={<ActivityIcon status={status.status} size={size === 'small' ? 16 : 20} />}
      label={status.label}
      color={getChipColor(status.status)}
      size={size}
      variant="filled"
      onClick={onClick}
      sx={{
        // エラー状態の場合は点滅アニメーション
        animation: status.status === 'error' ? 'pulse 2s infinite' : 'none',
        cursor: onClick ? 'pointer' : 'default',
        fontWeight: 'bold',
        // 状態別の背景色とテキスト色を濃く設定
        backgroundColor: getCustomBackgroundColor(status.status),
        color: getCustomTextColor(status.status),
        '& .MuiChip-label': {
          fontSize: size === 'small' ? '11px' : '13px',
          fontWeight: 'bold',
          color: getCustomTextColor(status.status)
        },
        '& .MuiChip-icon': {
          color: getCustomTextColor(status.status)
        },
        // ホバー効果
        '&:hover': onClick ? {
          transform: 'scale(1.05)',
          transition: 'transform 0.2s ease',
          backgroundColor: getCustomHoverColor(status.status),
        } : {},
      }}
    />
  );
  
  // ツールチップの有無で分岐
  if (!showTooltip) {
    return chipContent;
  }
  
  return (
    <Tooltip
      title={<ActivityTooltip student={student} score={score} />}
      placement="top"
      arrow
      enterDelay={300}
      leaveDelay={100}
    >
      <Box component="span">
        {chipContent}
      </Box>
    </Tooltip>
  );
};

// CSSアニメーションを追加
const pulseKeyframes = `
  @keyframes pulse {
    0% { 
      opacity: 1; 
      transform: scale(1); 
    }
    50% { 
      opacity: 0.8; 
      transform: scale(1.05); 
    }
    100% { 
      opacity: 1; 
      transform: scale(1); 
    }
  }
`;

// スタイルをheadに追加
if (typeof document !== 'undefined' && !document.getElementById('activity-chip-styles')) {
  const styleElement = document.createElement('style');
  styleElement.id = 'activity-chip-styles';
  styleElement.textContent = pulseKeyframes;
  document.head.appendChild(styleElement);
}

// カスタム色関数
const getCustomBackgroundColor = (status: 'good' | 'warning' | 'stopped' | 'error'): string => {
  const colorMap = {
    good: '#2e7d32',      // 濃い緑
    warning: '#ed6c02',   // 濃いオレンジ
    stopped: '#f57c00',   // 濃い琥珀色
    error: '#d32f2f'      // 濃い赤
  };
  return colorMap[status];
};

const getCustomTextColor = (status: 'good' | 'warning' | 'stopped' | 'error'): string => {
  // すべて白文字で視認性を最大化
  return '#ffffff';
};

const getCustomHoverColor = (status: 'good' | 'warning' | 'stopped' | 'error'): string => {
  const colorMap = {
    good: '#1b5e20',      // より濃い緑
    warning: '#e65100',   // より濃いオレンジ  
    stopped: '#ef6c00',   // より濃い琥珀色
    error: '#c62828'      // より濃い赤
  };
  return colorMap[status];
};

export default ActivityStatusChip;