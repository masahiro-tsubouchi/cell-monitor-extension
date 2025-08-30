/**
 * Critical Alert Bar Component
 * Phase 1.1: 緊急アラートシステム
 * 
 * 機能:
 * - ダッシュボード上部に目立つアラートバーを常時表示
 * - ヘルプ要請の赤色点滅で即座に視認可能
 * - 音声アラート対応
 */

import React, { memo } from 'react';
import { Box, Alert, Typography, Chip } from '@mui/material';
import { keyframes } from '@mui/system';
import { StudentActivity } from '../../../services/dashboardAPI';

interface CriticalAlertBarProps {
  students: StudentActivity[];
  onHelpStudentClick?: (student: StudentActivity) => void;
  onErrorStudentClick?: (student: StudentActivity) => void;
  soundAlertEnabled?: boolean;
}

// ヘルプ要請アラートの点滅アニメーション
const helpPulseAnimation = keyframes`
  0% { 
    backgroundColor: '#ff5722',
    boxShadow: '0 0 0 0 rgba(255, 87, 34, 0.7)',
    transform: 'scale(1)'
  }
  50% { 
    backgroundColor: '#ff3d00',
    boxShadow: '0 0 0 10px rgba(255, 87, 34, 0)',
    transform: 'scale(1.01)'
  }
  100% { 
    backgroundColor: '#ff5722',
    boxShadow: '0 0 0 0 rgba(255, 87, 34, 0.7)',
    transform: 'scale(1)'
  }
`;

// 連続エラーアラートの点滅アニメーション
const errorPulseAnimation = keyframes`
  0% { 
    backgroundColor: '#ffeb3b',
    boxShadow: '0 0 0 0 rgba(255, 235, 59, 0.7)',
    transform: 'scale(1)'
  }
  50% { 
    backgroundColor: '#ffc107',
    boxShadow: '0 0 0 10px rgba(255, 235, 59, 0)',
    transform: 'scale(1.01)'
  }
  100% { 
    backgroundColor: '#ffeb3b',
    boxShadow: '0 0 0 0 rgba(255, 235, 59, 0.7)',
    transform: 'scale(1)'
  }
`;

export const CriticalAlertBar: React.FC<CriticalAlertBarProps> = memo(({
  students,
  onHelpStudentClick,
  onErrorStudentClick,
  soundAlertEnabled = true
}) => {
  // ヘルプ要請中の学生を抽出
  const helpStudents = students.filter(student => student.status === 'help');
  
  // 連続エラー検出対応: 有意なエラーのみを緊急アラート対象とする
  const significantErrorStudents = students.filter(student => student.status === 'significant_error');
  const regularErrorStudents = students.filter(student => student.status === 'error');
  
  // アラートが必要かどうか判定（有意なエラーのみを緊急表示）
  const hasAlerts = helpStudents.length > 0 || significantErrorStudents.length > 0;

  // 音声アラート（ヘルプ要請時のみ）
  React.useEffect(() => {
    if (soundAlertEnabled && helpStudents.length > 0) {
      // ブラウザの Audio API を使用して音声通知
      // 実際の音声ファイルは別途追加が必要
      try {
        const audio = new Audio();
        audio.volume = 0.3; // 控えめな音量
        // 短いビープ音を生成
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800; // 800Hz
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } catch (error) {
      }
    }
  }, [helpStudents.length, soundAlertEnabled]);

  if (!hasAlerts) {
    return null; // アラートがない場合は非表示
  }

  return (
    <Box sx={{ 
      position: 'sticky',
      top: 0,
      zIndex: 1200,
      mb: 2
    }}>
      {/* ヘルプ要請アラート */}
      {helpStudents.length > 0 && (
        <Alert 
          severity="error"
          sx={{
            mb: 1,
            backgroundColor: '#ff5722',
            color: 'white',
            border: '2px solid #d32f2f',
            '& .MuiAlert-icon': { color: 'white' },
            animation: `${helpPulseAnimation} 2s ease-in-out infinite`,
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: '#ff3d00',
              transform: 'scale(1.02)'
            },
            transition: 'transform 0.2s ease-in-out'
          }}
          onClick={() => helpStudents[0] && onHelpStudentClick?.(helpStudents[0])}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'white' }}>
              🆘 {helpStudents.length}名がヘルプを要請中！
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {helpStudents.slice(0, 3).map((student) => (
                <Chip
                  key={student.emailAddress}
                  label={student.userName}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onHelpStudentClick?.(student);
                  }}
                />
              ))}
              {helpStudents.length > 3 && (
                <Chip
                  label={`+${helpStudents.length - 3}名`}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                />
              )}
            </Box>

            <Typography variant="body2" sx={{ 
              marginLeft: 'auto', 
              color: 'rgba(255, 255, 255, 0.9)',
              fontWeight: 'bold'
            }}>
              クリックで最初の学生に移動 →
            </Typography>
          </Box>
        </Alert>
      )}

      {/* 重要: 有意なエラー（3回以上連続エラー）アラート */}
      {significantErrorStudents.length > 0 && (
        <Alert 
          severity="warning" 
          sx={{ 
            backgroundColor: '#ffeb3b',
            color: '#000',
            border: '2px solid #ff9800',
            '& .MuiAlert-icon': { color: '#000' },
            animation: `${errorPulseAnimation} 2s ease-in-out infinite`,
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: '#ffc107',
              transform: 'scale(1.01)'
            },
            transition: 'all 0.2s ease-in-out'
          }}
          onClick={() => significantErrorStudents[0] && onErrorStudentClick?.(significantErrorStudents[0])}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
              🚨 {significantErrorStudents.length}名で連続エラー発生中！
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              {significantErrorStudents.slice(0, 3).map((student) => (
                <Chip
                  key={student.emailAddress}
                  label={`${student.userName} (${student.consecutiveErrorCount || 0}回)`}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(0, 0, 0, 0.1)',
                    color: '#000',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      transform: 'scale(1.05)'
                    },
                    transition: 'all 0.2s ease-in-out'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onErrorStudentClick?.(student);
                  }}
                />
              ))}
              {significantErrorStudents.length > 3 && (
                <Typography variant="caption" sx={{ color: '#000' }}>
                  +{significantErrorStudents.length - 3}名
                </Typography>
              )}
            </Box>
            
            <Typography variant="caption" sx={{ 
              marginLeft: 'auto', 
              color: 'rgba(0, 0, 0, 0.7)',
              fontWeight: 'bold'
            }}>
              クリックで詳細確認 →
            </Typography>
          </Box>
        </Alert>
      )}

      {/* 通常エラーアラート（情報提示のみ） */}
      {regularErrorStudents.length > 0 && (
        <Alert severity="warning" sx={{ 
          backgroundColor: '#ffc107',
          color: 'white',
          '& .MuiAlert-icon': { color: 'white' }
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
              ⚠️ {regularErrorStudents.length}名で通常エラー発生中
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              {regularErrorStudents.slice(0, 5).map((student) => (
                <Chip
                  key={student.emailAddress}
                  label={student.userName}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white'
                  }}
                />
              ))}
              {regularErrorStudents.length > 5 && (
                <Typography variant="caption">
                  +{regularErrorStudents.length - 5}名
                </Typography>
              )}
            </Box>
          </Box>
        </Alert>
      )}
    </Box>
  );
});

CriticalAlertBar.displayName = 'CriticalAlertBar';

export default CriticalAlertBar;