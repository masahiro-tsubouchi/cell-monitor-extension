import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  ButtonGroup,
  Chip,
  Alert,
} from '@mui/material';
import {
  CheckCircle,
  School,
  Coffee,
  PowerSettingsNew,
} from '@mui/icons-material';
import { InstructorStatus, InstructorStatusUpdate } from '../../types/api';
import webSocketService from '../../services/websocket';

interface StatusPanelProps {
  currentStatus: InstructorStatus;
  instructorId: number;
  onStatusChange: (status: InstructorStatus) => void;
}

const getStatusConfig = (status: InstructorStatus) => {
  switch (status) {
    case InstructorStatus.AVAILABLE:
      return {
        text: '対応可能',
        color: '#4caf50',
        icon: <CheckCircle />,
        className: 'status-available',
      };
    case InstructorStatus.IN_SESSION:
      return {
        text: '授業中',
        color: '#2196f3',
        icon: <School />,
        className: 'status-in-session',
      };
    case InstructorStatus.BREAK:
      return {
        text: '休憩中',
        color: '#ff9800',
        icon: <Coffee />,
        className: 'status-break',
      };
    case InstructorStatus.OFFLINE:
      return {
        text: 'オフライン',
        color: '#9e9e9e',
        icon: <PowerSettingsNew />,
        className: 'status-offline',
      };
    default:
      return {
        text: '不明',
        color: '#f44336',
        icon: <PowerSettingsNew />,
        className: 'status-unknown',
      };
  }
};

export const StatusPanel: React.FC<StatusPanelProps> = ({
  currentStatus,
  instructorId,
  onStatusChange,
}) => {
  const [isConnected, setIsConnected] = useState(true);
  const statusConfig = getStatusConfig(currentStatus);

  // WebSocket統合: コンポーネントマウント時の接続とイベントハンドラ設定
  useEffect(() => {
    // 接続状態の確認
    const connectionState = webSocketService.getConnectionState();
    setIsConnected(connectionState === 'connected');

    // WebSocketイベントハンドラの定義
    const handleInstructorStatusUpdate = (data: InstructorStatusUpdate) => {
      // 自分のステータス更新の場合のみ反映
      if (data.instructor_id === instructorId) {
        onStatusChange(data.status);
      }
    };

    // WebSocketサービスにイベントハンドラを設定
    webSocketService.setEventHandlers({
      onInstructorStatusUpdate: handleInstructorStatusUpdate,
    });

    // クリーンアップ関数
    return () => {
      // コンポーネントのアンマウント時にイベントハンドラをクリア
      webSocketService.setEventHandlers({});
    };
  }, [instructorId, onStatusChange]);

  const handleStatusChange = (newStatus: InstructorStatus) => {
    if (!isConnected) return;

    // ローカル状態を即座に更新
    onStatusChange(newStatus);

    // WebSocket経由でサーバーに送信
    webSocketService.sendStatusUpdate({
      instructor_id: instructorId,
      status: newStatus,
      timestamp: new Date().toISOString(),
    });
  };

  const statusButtons = [
    { status: InstructorStatus.AVAILABLE, label: '対応可能', color: 'success' as const },
    { status: InstructorStatus.IN_SESSION, label: '授業中', color: 'primary' as const },
    { status: InstructorStatus.BREAK, label: '休憩中', color: 'warning' as const },
    { status: InstructorStatus.OFFLINE, label: 'オフライン', color: 'inherit' as const },
  ];

  return (
    <Box
      data-testid="status-panel"
      role="region"
      aria-label="講師ステータス管理"
      className={!isConnected ? 'connection-error' : ''}
      sx={{ mb: 2 }}
    >
      <Card>
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            講師ステータス
          </Typography>

          {/* 接続エラー表示 */}
          {!isConnected && (
            <Alert severity="error" sx={{ mb: 2 }}>
              接続エラー
            </Alert>
          )}

          {/* 現在のステータス表示 */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Chip
              data-testid="status-indicator"
              icon={statusConfig.icon}
              label={statusConfig.text}
              className={statusConfig.className}
              sx={{
                backgroundColor: statusConfig.color,
                color: 'white',
                '& .MuiChip-icon': {
                  color: 'white',
                },
              }}
            />
          </Box>

          {/* ステータス変更ボタン */}
          <Typography variant="body2" color="text.secondary" gutterBottom>
            ステータスを変更:
          </Typography>
          <ButtonGroup
            variant="outlined"
            size="small"
            disabled={!isConnected}
            sx={{ flexWrap: 'wrap', gap: 1 }}
          >
            {statusButtons.map(({ status, label, color }) => (
              <Button
                key={status}
                color={color}
                variant={currentStatus === status ? 'contained' : 'outlined'}
                onClick={() => handleStatusChange(status)}
                aria-pressed={currentStatus === status}
                disabled={!isConnected}
                sx={{ minWidth: 80 }}
              >
                {label}
              </Button>
            ))}
          </ButtonGroup>
        </CardContent>
      </Card>
    </Box>
  );
};
