import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import {
  Notifications,
  NotificationsActive,
  VolumeUp,
  Vibration,
  Help,
  Info,
  Warning,
} from '@mui/icons-material';
import webSocketService from '../../services/websocket';

interface NotificationSettings {
  helpRequests: boolean;
  statusUpdates: boolean;
  systemAlerts: boolean;
  sound: boolean;
  vibration: boolean;
}

interface NotificationHistoryItem {
  id: string;
  type: 'help_request' | 'status_update' | 'system_alert';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface NotificationSystemProps {
  instructorId: number;
  isEnabled: boolean;
  onSettingsChange: (settings: NotificationSettings) => void;
  notificationSettings: NotificationSettings;
  notificationHistory?: NotificationHistoryItem[];
  onNotificationRead?: (notificationId: string) => void;
}

// VAPID公開鍵（実際の実装では環境変数から取得）
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa40HdHSQqMjkcDdVxaPFkymkTHX6br5wNrXuLKrx.example';

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const NotificationSystem: React.FC<NotificationSystemProps> = ({
  instructorId,
  isEnabled,
  onSettingsChange,
  notificationSettings,
  notificationHistory = [],
  onNotificationRead,
}) => {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [serviceWorkerError, setServiceWorkerError] = useState<string | null>(null);

  // WebSocket統合: コンポーネントマウント時の接続とイベントハンドラ設定
  useEffect(() => {
    // 接続状態の確認
    const connectionState = webSocketService.getConnectionState();
    setIsConnected(connectionState === 'connected');

    // 通知許可状態の確認
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }

    // WebSocketイベントハンドラの定義
    const handleStudentHelpRequest = (data: any) => {
      if (notificationSettings.helpRequests && permissionStatus === 'granted') {
        showNotification('緊急ヘルプ要請', {
          body: `${data.student_name}さん (${data.seat_number}) からヘルプ要請があります`,
          icon: '/notification-icon.png',
          badge: '/notification-badge.png',
          tag: `help-request-${data.seat_number}`,
          requireInteraction: true,
        });
      }
    };

    const handleInstructorStatusUpdate = (data: any) => {
      if (notificationSettings.statusUpdates && permissionStatus === 'granted') {
        showNotification('ステータス更新', {
          body: `講師のステータスが更新されました`,
          icon: '/notification-icon.png',
          badge: '/notification-badge.png',
          tag: 'status-update',
        });
      }
    };

    const handleSystemAlert = (data: any) => {
      if (notificationSettings.systemAlerts && permissionStatus === 'granted') {
        showNotification('システムアラート', {
          body: data.message,
          icon: '/notification-icon.png',
          badge: '/notification-badge.png',
          tag: 'system-alert',
          requireInteraction: true,
        });
      }
    };

    // WebSocketサービスにイベントハンドラを設定
    webSocketService.setEventHandlers({
      onStudentHelpRequest: handleStudentHelpRequest,
      onInstructorStatusUpdate: handleInstructorStatusUpdate,
      onSystemAlert: handleSystemAlert,
    });

    // Push通知の初期化
    if (permissionStatus === 'granted') {
      initializePushNotifications();
    }

    // クリーンアップ関数
    return () => {
      // コンポーネントのアンマウント時にイベントハンドラをクリア
      webSocketService.setEventHandlers({});
    };
  }, [instructorId, notificationSettings, permissionStatus]);

  const showNotification = (title: string, options: NotificationOptions) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, options);
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      setServiceWorkerError('通知機能が利用できません');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);

      if (permission === 'granted') {
        await initializePushNotifications();
      }
    } catch (error) {
      console.error('Notification permission request failed:', error);
      setServiceWorkerError('通知許可の取得に失敗しました');
    }
  };

  const initializePushNotifications = async () => {
    try {
      // Service Worker の準備状況を確認
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Worker not supported');
      }

      const registration = await navigator.serviceWorker.ready;

      // 既存の購読を確認
      const existingSubscription = await registration.pushManager.getSubscription();

      if (!existingSubscription) {
        // 新しい購読を作成
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        // サーバーに購読情報を送信
        if (webSocketService.sendNotificationSubscription) {
          webSocketService.sendNotificationSubscription({
            instructor_id: instructorId,
            subscription: {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.getKey('p256dh') ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('p256dh')!)))) : '',
                auth: subscription.getKey('auth') ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('auth')!)))) : '',
              },
            },
            settings: notificationSettings,
          });
        }

        setIsSubscribed(true);
      } else {
        setIsSubscribed(true);
      }
    } catch (error) {
      console.error('Push notification initialization failed:', error);
      setServiceWorkerError('通知機能が利用できません');
    }
  };

  const handleSettingChange = (setting: keyof NotificationSettings) => {
    const newSettings = {
      ...notificationSettings,
      [setting]: !notificationSettings[setting],
    };
    onSettingsChange(newSettings);
  };

  const handleNotificationClick = (notificationId: string) => {
    if (onNotificationRead) {
      onNotificationRead(notificationId);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'help_request':
        return <Help color="error" />;
      case 'status_update':
        return <Info color="info" />;
      case 'system_alert':
        return <Warning color="warning" />;
      default:
        return <Notifications />;
    }
  };

  const getPermissionStatusMessage = () => {
    switch (permissionStatus) {
      case 'granted':
        return '通知が有効になりました';
      case 'denied':
        return '通知が拒否されました';
      default:
        return '通知許可が必要です';
    }
  };

  return (
    <Box
      data-testid="notification-system"
      role="region"
      aria-label="通知システム"
      sx={{ mb: 2 }}
    >
      <Card>
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            <NotificationsActive sx={{ mr: 1, verticalAlign: 'middle' }} />
            通知設定
          </Typography>

          {/* 接続エラー表示 */}
          {!isConnected && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              通知サービス オフライン
            </Alert>
          )}

          {/* Service Worker エラー表示 */}
          {serviceWorkerError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {serviceWorkerError}
            </Alert>
          )}

          {/* 通知許可状態 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              通知許可状態
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={getPermissionStatusMessage()}
                color={permissionStatus === 'granted' ? 'success' : 'default'}
                size="small"
              />
              {permissionStatus !== 'granted' && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={requestNotificationPermission}
                  disabled={!isConnected}
                >
                  通知を有効にする
                </Button>
              )}
            </Box>
          </Box>

          {/* 通知設定 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              通知種別
            </Typography>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationSettings.helpRequests}
                    onChange={() => handleSettingChange('helpRequests')}
                    disabled={!isConnected || permissionStatus !== 'granted'}
                    inputProps={{ 'aria-describedby': 'help-requests-description' }}
                  />
                }
                label="ヘルプ要請"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationSettings.statusUpdates}
                    onChange={() => handleSettingChange('statusUpdates')}
                    disabled={!isConnected || permissionStatus !== 'granted'}
                    inputProps={{ 'aria-describedby': 'status-updates-description' }}
                  />
                }
                label="ステータス更新"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationSettings.systemAlerts}
                    onChange={() => handleSettingChange('systemAlerts')}
                    disabled={!isConnected || permissionStatus !== 'granted'}
                    inputProps={{ 'aria-describedby': 'system-alerts-description' }}
                  />
                }
                label="システムアラート"
              />
            </Box>
          </Box>

          {/* 通知オプション */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              通知オプション
            </Typography>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationSettings.sound}
                    onChange={() => handleSettingChange('sound')}
                    disabled={!isConnected || permissionStatus !== 'granted'}
                    inputProps={{ 'aria-describedby': 'sound-description' }}
                  />
                }
                label="音声通知"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationSettings.vibration}
                    onChange={() => handleSettingChange('vibration')}
                    disabled={!isConnected || permissionStatus !== 'granted'}
                    inputProps={{ 'aria-describedby': 'vibration-description' }}
                  />
                }
                label="バイブレーション"
              />
            </Box>
          </Box>

          {/* 通知履歴 */}
          {notificationHistory.length > 0 && (
            <Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary" gutterBottom>
                通知履歴
              </Typography>
              <List dense>
                {notificationHistory.slice(0, 5).map((notification) => (
                  <ListItem
                    key={notification.id}
                    data-testid={`notification-${notification.id}`}
                    onClick={() => handleNotificationClick(notification.id)}
                    sx={{
                      backgroundColor: notification.read ? 'transparent' : 'action.hover',
                      borderRadius: 1,
                      mb: 0.5,
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  >
                    <ListItemIcon>
                      {getNotificationIcon(notification.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={notification.message}
                      secondary={new Date(notification.timestamp).toLocaleString()}
                      primaryTypographyProps={{
                        fontWeight: notification.read ? 'normal' : 'bold',
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
