/**
 * ActivityIcon コンポーネント
 * 活動状態に応じた適切なアイコンを表示
 */

import React from 'react';
import {
  CheckCircle as CheckCircleIcon,
  PauseCircleFilled as PauseCircleFilledIcon,
  Stop as StopCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';

interface ActivityIconProps {
  status: 'good' | 'warning' | 'stopped' | 'error';
  size?: number;
}

export const ActivityIcon: React.FC<ActivityIconProps> = ({ 
  status, 
  size = 20 
}) => {
  const iconMap = {
    good: (
      <CheckCircleIcon 
        sx={{ 
          fontSize: size, 
          color: '#ffffff' // 白色で視認性最大化
        }} 
      />
    ),
    warning: (
      <PauseCircleFilledIcon 
        sx={{ 
          fontSize: size, 
          color: '#ffffff' // 白色で視認性最大化
        }} 
      />
    ),
    stopped: (
      <StopCircleIcon 
        sx={{ 
          fontSize: size, 
          color: '#ffffff' // 白色で視認性最大化
        }} 
      />
    ),
    error: (
      <ErrorIcon 
        sx={{ 
          fontSize: size, 
          color: '#ffffff' // 白色で視認性最大化
        }} 
      />
    )
  };
  
  return iconMap[status];
};

export default ActivityIcon;