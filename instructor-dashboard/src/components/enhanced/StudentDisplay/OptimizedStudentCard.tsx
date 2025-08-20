/**
 * Optimized Student Card Component  
 * Phase 2.3: 強化学生カード
 * 
 * 機能:
 * - 大型ステータスインジケーターで瞬時に状態判別
 * - 情報密度最適化で必要な情報を一目で把握
 * - ワンタップアクションで即座に対応開始
 */

import React, { memo, useState } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Avatar,
  IconButton,
  Chip,
  LinearProgress,
  Tooltip,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  Badge,
  Collapse
} from '@mui/material';
import {
  Help as HelpIcon,
  Error as ErrorIcon,
  CheckCircle as ActiveIcon,
  Schedule as InactiveIcon,
  Message as MessageIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Group as TeamIcon,
  Code as CodeIcon,
  AccessTime as TimeIcon
} from '@mui/icons-material';
import { StudentActivity } from '../../../services/dashboardAPI';

interface OptimizedStudentCardProps {
  student: StudentActivity;
  onClick?: (student: StudentActivity) => void;
  onAction?: (action: string, student: StudentActivity) => void;
  compact?: boolean;
  showQuickActions?: boolean;
  animateStatus?: boolean;
}

interface StatusConfig {
  icon: React.ReactElement;
  color: string;
  bgColor: string;
  label: string;
  priority: number;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  help: {
    icon: <HelpIcon />,
    color: '#fff',
    bgColor: '#ff5722',
    label: 'ヘルプ要請',
    priority: 1
  },
  significant_error: {
    icon: <ErrorIcon />,
    color: '#000',
    bgColor: '#ffeb3b',  // 黄色で連続エラーを表現
    label: '連続エラー',
    priority: 2
  },
  error: {
    icon: <ErrorIcon />,
    color: '#fff', 
    bgColor: '#ff9800',
    label: 'エラー発生',
    priority: 3
  },
  active: {
    icon: <ActiveIcon />,
    color: '#fff',
    bgColor: '#4caf50', 
    label: 'アクティブ',
    priority: 4
  },
  idle: {
    icon: <InactiveIcon />,
    color: '#666',
    bgColor: '#f5f5f5',
    label: 'アイドル',
    priority: 5
  }
};

// 活動度を色で表現
const getActivityColor = (executions: number): string => {
  if (executions >= 10) return '#4caf50'; // 緑 - 高活動
  if (executions >= 5) return '#ff9800';  // オレンジ - 中活動  
  if (executions >= 1) return '#2196f3';  // 青 - 低活動
  return '#9e9e9e'; // グレー - 非活動
};

// 最後の活動からの経過時間を計算
const getLastActivityTime = (lastActivity: string | null): string => {
  if (!lastActivity) return '未接続';
  
  const now = new Date();
  const lastTime = new Date(lastActivity);
  const diff = now.getTime() - lastTime.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}日前`;
  if (hours > 0) return `${hours}時間前`;
  if (minutes > 0) return `${minutes}分前`;
  return '1分以内';
};

export const OptimizedStudentCard: React.FC<OptimizedStudentCardProps> = memo(({
  student,
  onClick,
  onAction,
  compact = false,
  showQuickActions = true,
  animateStatus = true
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [expanded, setExpanded] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const statusConfig = STATUS_CONFIG[student.status] || STATUS_CONFIG.inactive;
  const activityColor = getActivityColor(student.cellExecutions || 0);
  const lastActivity = getLastActivityTime(student.lastActivity);
  const isUrgent = student.status === 'help' || student.status === 'error';

  // カードクリックハンドラー
  const handleCardClick = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && 
        (e.target.closest('.quick-action') || e.target.closest('.menu-action'))) {
      return; // アクションボタンのクリックは除外
    }
    onClick?.(student);
  };

  // クイックアクションハンドラー
  const handleQuickAction = (action: string) => {
    onAction?.(action, student);
  };

  // メニューアクション
  const handleMenuAction = (action: string) => {
    onAction?.(action, student);
    setMenuAnchor(null);
  };

  return (
    <Card
      onClick={handleCardClick}
      data-student-id={student.emailAddress}
      sx={{
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.3s ease-in-out',
        border: isUrgent ? `3px solid ${statusConfig.bgColor}` : '1px solid #e0e0e0',
        borderRadius: 3,
        overflow: 'visible',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: isUrgent ? `0 8px 32px ${statusConfig.bgColor}40` : 6,
          '& .quick-actions': {
            opacity: 1,
            transform: 'translateY(0)'
          }
        },
        ...(isUrgent && animateStatus && {
          animation: 'pulse 2s ease-in-out infinite',
          '@keyframes pulse': {
            '0%': { 
              boxShadow: `0 0 0 0 ${statusConfig.bgColor}40`,
              borderColor: statusConfig.bgColor
            },
            '50%': { 
              boxShadow: `0 0 0 8px ${statusConfig.bgColor}20`,
              borderColor: `${statusConfig.bgColor}80`
            },
            '100%': { 
              boxShadow: `0 0 0 0 ${statusConfig.bgColor}40`,
              borderColor: statusConfig.bgColor
            }
          }
        })
      }}
    >
      {/* ステータスバッジ */}
      <Box
        sx={{
          position: 'absolute',
          top: -12,
          right: 16,
          zIndex: 1
        }}
      >
        <Badge
          badgeContent={student.cellExecutions || 0}
          color="primary"
          max={99}
          sx={{
            '& .MuiBadge-badge': {
              backgroundColor: activityColor,
              color: 'white',
              fontWeight: 'bold'
            }
          }}
        >
          <Chip
            icon={statusConfig.icon}
            label={statusConfig.label}
            sx={{
              backgroundColor: statusConfig.bgColor,
              color: statusConfig.color,
              fontWeight: 'bold',
              fontSize: isMobile ? '0.75rem' : '0.8rem',
              height: isMobile ? 36 : 32,
              '& .MuiChip-icon': {
                fontSize: isMobile ? '1.2rem' : '1rem'
              }
            }}
          />
        </Badge>
      </Box>

      <CardContent sx={{ 
        p: isMobile ? 2 : 3,
        '&:last-child': { pb: isMobile ? 2 : 3 }
      }}>
        {/* ヘッダー部分 */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
          <Avatar
            sx={{
              width: isMobile ? 48 : 56,
              height: isMobile ? 48 : 56,
              backgroundColor: activityColor,
              mr: 2,
              fontSize: isMobile ? '1.2rem' : '1.5rem',
              fontWeight: 'bold'
            }}
          >
            <PersonIcon />
          </Avatar>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography 
              variant={isMobile ? "subtitle1" : "h6"}
              sx={{ 
                fontWeight: 'bold',
                mb: 0.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: compact ? 'nowrap' : 'normal',
                lineHeight: 1.2
              }}
            >
              {student.userName}
            </Typography>
            
            {!compact && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{ 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {student.emailAddress}
                </Typography>
              </Box>
            )}

            {student.teamName && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TeamIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  {student.teamName}
                </Typography>
              </Box>
            )}
          </Box>

          {/* メニューボタン */}
          <IconButton
            size="small"
            className="menu-action"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            sx={{ alignSelf: 'flex-start' }}
          >
            <MoreIcon />
          </IconButton>
        </Box>

        {/* 詳細情報 */}
        {!compact && (
          <Box sx={{ mb: 2 }}>
            {/* 活動統計 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: activityColor }}>
                  {student.cellExecutions || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  実行回数
                </Typography>
              </Box>
              
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  {lastActivity}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  最後の活動
                </Typography>
              </Box>
            </Box>

            {/* 進捗バー */}
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  活動度
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                  {Math.min((student.cellExecutions || 0) * 10, 100)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min((student.cellExecutions || 0) * 10, 100)}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: activityColor,
                    borderRadius: 3
                  }
                }}
              />
            </Box>
          </Box>
        )}

        {/* 展開可能な詳細情報 */}
        {!compact && !isMobile && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
              <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                {expanded ? <CollapseIcon /> : <ExpandIcon />}
              </IconButton>
            </Box>

            <Collapse in={expanded}>
              <Box sx={{ pt: 2, borderTop: '1px solid #e0e0e0' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  📊 詳細統計
                </Typography>
                
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      現在のノートブック
                    </Typography>
                    <Typography variant="body2">
                      {student.currentNotebook || '未開始'}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      最終活動
                    </Typography>
                    <Typography variant="body2">
                      {student.lastActivity ? 
                        new Date(student.lastActivity).toLocaleTimeString() : 
                        '未更新'
                      }
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Collapse>
          </>
        )}

        {/* クイックアクション */}
        {showQuickActions && (
          <Box
            className="quick-actions"
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              display: 'flex',
              gap: 1,
              opacity: 0,
              transform: 'translateY(-10px)',
              transition: 'all 0.3s ease-in-out',
              zIndex: 2
            }}
          >
            {isUrgent && (
              <Tooltip title="メッセージ送信">
                <IconButton
                  size="small"
                  className="quick-action"
                  onClick={() => handleQuickAction('message')}
                  sx={{
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    '&:hover': { backgroundColor: 'white' }
                  }}
                >
                  <MessageIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            
            <Tooltip title="セッション再起動">
              <IconButton
                size="small"
                className="quick-action"
                onClick={() => handleQuickAction('restart')}
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  '&:hover': { backgroundColor: 'white' }
                }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </CardContent>

      {/* メニュー */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => handleMenuAction('view')}>
          <PersonIcon sx={{ mr: 1 }} />
          詳細表示
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('message')}>
          <MessageIcon sx={{ mr: 1 }} />
          メッセージ送信
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('restart')}>
          <RefreshIcon sx={{ mr: 1 }} />
          セッション再起動
        </MenuItem>
        {isUrgent && (
          <MenuItem 
            onClick={() => handleMenuAction('resolve')}
            sx={{ color: 'success.main' }}
          >
            <ActiveIcon sx={{ mr: 1 }} />
            問題解決済み
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
});

OptimizedStudentCard.displayName = 'OptimizedStudentCard';

export default OptimizedStudentCard;