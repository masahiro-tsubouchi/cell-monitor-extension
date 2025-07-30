import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  Alert,
  Chip,
} from '@mui/material';
import {
  LocationOn,
  Timeline,
  Analytics,
} from '@mui/icons-material';
import webSocketService from '../../services/websocket';

interface Location {
  x: number;
  y: number;
  zone: string;
}

interface Zone {
  id: string;
  name: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface ClassroomLayout {
  width: number;
  height: number;
  zones: Zone[];
}

interface LocationHistory {
  zone: string;
  timestamp: string;
  duration: number;
}

interface EfficiencyMetrics {
  totalDistance: number;
  averageResponseTime: number;
  zoneUtilization: Record<string, number>;
}

interface LocationTrackerProps {
  instructorId: number;
  currentLocation: Location;
  onLocationChange: (location: Location) => void;
  classroomLayout: ClassroomLayout;
  locationHistory?: LocationHistory[];
  efficiencyMetrics?: EfficiencyMetrics;
}

export const LocationTracker: React.FC<LocationTrackerProps> = ({
  instructorId,
  currentLocation,
  onLocationChange,
  classroomLayout,
  locationHistory = [],
  efficiencyMetrics,
}) => {
  const [isConnected, setIsConnected] = useState(true);

  // WebSocket統合: コンポーネントマウント時の接続とイベントハンドラ設定
  useEffect(() => {
    // 接続状態の確認
    const connectionState = webSocketService.getConnectionState();
    setIsConnected(connectionState === 'connected');

    // WebSocketイベントハンドラの定義
    const handleInstructorLocationUpdate = (data: any) => {
      // 自分の位置更新の場合のみ反映
      if (data.instructor_id === instructorId) {
        onLocationChange(data.location);
      }
    };

    // WebSocketサービスにイベントハンドラを設定
    webSocketService.setEventHandlers({
      onInstructorLocationUpdate: handleInstructorLocationUpdate,
    });

    // クリーンアップ関数
    return () => {
      // コンポーネントのアンマウント時にイベントハンドラをクリア
      webSocketService.setEventHandlers({});
    };
  }, [instructorId, onLocationChange]);

  const handleZoneClick = (zone: Zone) => {
    if (!isConnected) return;

    // クリック位置を計算（ゾーンの中央）
    const newLocation: Location = {
      x: zone.bounds.x + zone.bounds.width / 2,
      y: zone.bounds.y + zone.bounds.height / 2,
      zone: zone.id,
    };

    // ローカル状態を即座に更新
    onLocationChange(newLocation);

    // WebSocket経由でサーバーに送信
    if (webSocketService.sendLocationUpdate) {
      webSocketService.sendLocationUpdate({
        instructor_id: instructorId,
        location: newLocation,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const getCurrentZoneName = () => {
    const zone = classroomLayout.zones.find(z => z.id === currentLocation.zone);
    return zone ? zone.name : '不明';
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  const formatResponseTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  return (
    <Box
      data-testid="location-tracker"
      role="application"
      aria-label="講師位置追跡"
      className={!isConnected ? 'offline-mode' : ''}
      sx={{ mb: 2 }}
    >
      <Card>
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            <LocationOn sx={{ mr: 1, verticalAlign: 'middle' }} />
            位置追跡
          </Typography>

          {/* 接続エラー表示 */}
          {!isConnected && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              位置追跡オフライン
            </Alert>
          )}

          {/* 現在位置表示 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body1" gutterBottom>
              現在位置: {getCurrentZoneName()}
            </Typography>
            <Chip
              data-testid="location-indicator"
              icon={<LocationOn />}
              label={getCurrentZoneName()}
              color="primary"
              variant="outlined"
            />
          </Box>

          {/* 教室レイアウトマップ */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              教室レイアウト
            </Typography>
            <Box
              data-testid="classroom-layout-map"
              role="img"
              aria-label="教室レイアウトマップ"
              sx={{
                position: 'relative',
                width: '100%',
                maxWidth: '100%', // レスポンシブ対応
                height: 300,
                border: '1px solid #ccc',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              {classroomLayout.zones.map((zone) => (
                <Box
                  key={zone.id}
                  data-testid={`zone-${zone.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleZoneClick(zone)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleZoneClick(zone);
                    }
                  }}
                  sx={{
                    position: 'absolute',
                    left: `${(zone.bounds.x / classroomLayout.width) * 100}%`,
                    top: `${(zone.bounds.y / classroomLayout.height) * 100}%`,
                    width: `${(zone.bounds.width / classroomLayout.width) * 100}%`,
                    height: `${(zone.bounds.height / classroomLayout.height) * 100}%`,
                    border: '1px solid #999',
                    backgroundColor: currentLocation.zone === zone.id ? '#e3f2fd' : '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isConnected ? 'pointer' : 'not-allowed',
                    '&:hover': {
                      backgroundColor: isConnected ? '#e8f5e8' : '#f5f5f5',
                    },
                    '&:focus': {
                      outline: '2px solid #1976d2',
                      outlineOffset: '-2px',
                    },
                  }}
                >
                  <Typography variant="caption" align="center">
                    {zone.name}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* 位置履歴 */}
          {locationHistory.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <Timeline sx={{ mr: 1, verticalAlign: 'middle' }} />
                位置履歴
              </Typography>
              <List dense>
                {locationHistory.slice(0, 3).map((history, index) => {
                  const zone = classroomLayout.zones.find(z => z.id === history.zone);
                  const zoneName = zone ? zone.name : history.zone;
                  return (
                    <ListItem key={index} sx={{ py: 0.5 }}>
                      <ListItemText
                        primary={`${zoneName} (${formatDuration(history.duration)})`}
                        secondary={new Date(history.timestamp).toLocaleTimeString()}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          )}

          {/* 効率性分析 */}
          {efficiencyMetrics && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <Analytics sx={{ mr: 1, verticalAlign: 'middle' }} />
                移動効率
              </Typography>
              <Box>
                <Typography variant="body2">
                  総移動距離: {efficiencyMetrics.totalDistance}m
                </Typography>
                <Typography variant="body2">
                  平均応答時間: {formatResponseTime(efficiencyMetrics.averageResponseTime)}
                </Typography>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
