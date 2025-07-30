import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  ButtonGroup,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  IconButton,
  Container
} from '@mui/material';
import {
  ExitToApp as LogoutIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { SeatMap } from '../components/classroom/SeatMap';
import { Seat, Instructor, HelpRequest, InstructorStatus, LayoutConfig } from '../types';

interface DashboardProps {
  instructor: Instructor | null;
  seats: Seat[];
  helpRequests: HelpRequest[];
  onSeatClick: (seat: Seat) => void;
  onHelpRequestClick: (helpRequest: HelpRequest) => void;
  onStatusChange: (status: InstructorStatus) => void;
  onLogout: () => void;
}

const getUrgencyIcon = (urgency: HelpRequest['urgency']) => {
  switch (urgency) {
    case 'high':
      return <ErrorIcon color="error" />;
    case 'medium':
      return <WarningIcon color="warning" />;
    case 'low':
      return <InfoIcon color="info" />;
    default:
      return <InfoIcon />;
  }
};

const getUrgencyClass = (urgency: HelpRequest['urgency']): string => {
  return `urgency-${urgency}`;
};

const getStatusLabel = (status: InstructorStatus): string => {
  switch (status) {
    case 'AVAILABLE':
      return '対応可能';
    case 'IN_SESSION':
      return '授業中';
    case 'BREAK':
      return '休憩中';
    case 'OFFLINE':
      return 'オフライン';
    default:
      return '不明';
  }
};

const HelpRequestItem: React.FC<{
  helpRequest: HelpRequest;
  onClick: (helpRequest: HelpRequest) => void;
}> = ({ helpRequest, onClick }) => {
  const handleClick = () => {
    onClick(helpRequest);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(helpRequest);
    }
  };

  return (
    <ListItem
      data-testid={`help-request-${helpRequest.id}`}
      className={getUrgencyClass(helpRequest.urgency)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      sx={{
        cursor: 'pointer',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        mb: 1,
        '&:hover': {
          backgroundColor: 'action.hover',
        },
        '&:focus': {
          outline: '2px solid #2196f3',
          outlineOffset: '2px',
        },
      }}
    >
      <ListItemIcon>
        {getUrgencyIcon(helpRequest.urgency)}
      </ListItemIcon>
      <ListItemText
        primary={
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="subtitle1">
              {helpRequest.studentName}
            </Typography>
            <Chip
              label={helpRequest.seatNumber}
              size="small"
              color="primary"
              data-testid="help-request-seat-number"
            />
            <Chip
              label={helpRequest.urgency}
              size="small"
              color={
                helpRequest.urgency === 'high'
                  ? 'error'
                  : helpRequest.urgency === 'medium'
                  ? 'warning'
                  : 'info'
              }
            />
          </Box>
        }
        secondary={helpRequest.description}
      />
    </ListItem>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({
  instructor,
  seats,
  helpRequests,
  onSeatClick,
  onHelpRequestClick,
  onStatusChange,
  onLogout
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const defaultLayout: LayoutConfig = {
    totalSeats: 200,
    gridRows: 10,
    gridCols: 20,
    gridSize: 3
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  return (
    <Box data-testid="dashboard" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <AppBar position="static" data-testid="dashboard-header" role="banner">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            講師支援ダッシュボード
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" data-testid="current-time">
                {formatTime(currentTime)}
              </Typography>
              <Typography variant="caption" data-testid="current-date">
                {formatDate(currentTime)}
              </Typography>
            </Box>

            {instructor ? (
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body1">
                  {instructor.name}
                </Typography>
                <Typography variant="caption">
                  {getStatusLabel(instructor.status)} - {instructor.currentLocation}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body1">
                講師情報なし
              </Typography>
            )}

            <IconButton color="inherit" onClick={onLogout} aria-label="ログアウト">
              <LogoutIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* ナビゲーション・ステータス制御 */}
      <Paper elevation={1} sx={{ p: 2 }} role="navigation">
        <Box data-testid="status-controls" sx={{ display: 'flex', justifyContent: 'center' }}>
          <ButtonGroup variant="outlined" aria-label="講師ステータス変更">
            <Button
              onClick={() => onStatusChange('AVAILABLE')}
              variant={instructor?.status === 'AVAILABLE' ? 'contained' : 'outlined'}
            >
              対応可能
            </Button>
            <Button
              onClick={() => onStatusChange('IN_SESSION')}
              variant={instructor?.status === 'IN_SESSION' ? 'contained' : 'outlined'}
            >
              授業中
            </Button>
            <Button
              onClick={() => onStatusChange('BREAK')}
              variant={instructor?.status === 'BREAK' ? 'contained' : 'outlined'}
            >
              休憩中
            </Button>
          </ButtonGroup>
        </Box>
      </Paper>

      {/* メインコンテンツ */}
      <Container maxWidth="xl" sx={{ flexGrow: 1, py: 2 }} component="main" role="main">
        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
          {/* 座席マップセクション */}
          <Box sx={{ flex: { xs: '1 1 100%', lg: '1 1 66%' } }}>
            <Paper elevation={2} sx={{ p: 2, height: '100%' }} data-testid="seat-map-section">
              <Typography variant="h6" gutterBottom>
                座席マップ
              </Typography>
              <SeatMap
                seats={seats}
                layout={defaultLayout}
                onSeatClick={onSeatClick}
              />
            </Paper>
          </Box>

          {/* ヘルプ要請セクション */}
          <Box sx={{ flex: { xs: '1 1 100%', lg: '1 1 33%' } }}>
            <Paper elevation={2} sx={{ p: 2, height: '100%' }} data-testid="help-requests-section">
              <Typography variant="h6" gutterBottom>
                ヘルプ要請一覧
              </Typography>

              {helpRequests.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  現在ヘルプ要請はありません
                </Typography>
              ) : (
                <List sx={{ maxHeight: 600, overflow: 'auto' }}>
                  {helpRequests.map((helpRequest) => (
                    <HelpRequestItem
                      key={helpRequest.id}
                      helpRequest={helpRequest}
                      onClick={onHelpRequestClick}
                    />
                  ))}
                </List>
              )}
            </Paper>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Dashboard;
