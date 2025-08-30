/**
 * Responsive Dashboard Layout Component
 * Phase 2.2: レスポンシブレイアウトシステム
 * 
 * 機能:
 * - デバイス自動判別で最適なレイアウトを自動適用
 * - タッチ操作最適化でスマートフォンでも快適操作
 * - 画面サイズ別情報密度調整で必要な情報を確実に表示
 */

import React, { memo, useState, useEffect } from 'react';
import {
  Box,
  Container,
  useTheme,
  useMediaQuery,
  Fab,
  SpeedDial,
  SpeedDialAction,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Collapse
} from '@mui/material';
import {
  Menu as MenuIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  ViewModule as GridIcon,
  List as ListIcon,
  Settings as SettingsIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon
} from '@mui/icons-material';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type LayoutMode = 'compact' | 'normal' | 'expanded';

interface ResponsiveBreakpoints {
  mobile: string;
  tablet: string;
  desktop: string;
}

interface ResponsiveDashboardProps {
  children: React.ReactNode;
  onDeviceChange?: (device: DeviceType) => void;
  onLayoutModeChange?: (mode: LayoutMode) => void;
  showMobileDrawer?: boolean;
  mobileDrawerContent?: React.ReactNode;
  floatingActions?: Array<{
    icon: React.ReactNode;
    name: string;
    onClick: () => void;
  }>;
}

const RESPONSIVE_BREAKPOINTS: ResponsiveBreakpoints = {
  mobile: '< 768px',
  tablet: '768px-1024px', 
  desktop: '> 1024px'
};

// デバイス検出Hook
const useDeviceDetection = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  const deviceType: DeviceType = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
  
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    if (isMobile) return 'compact';
    if (isTablet) return 'normal';
    return 'expanded';
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleOrientationChange();

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
    }
  };

  return {
    deviceType,
    layoutMode,
    setLayoutMode,
    isMobile,
    isTablet,
    isDesktop,
    isFullscreen,
    orientation,
    toggleFullscreen
  };
};

// タッチ操作の強化Hook
const useTouchEnhancements = (deviceType: DeviceType) => {
  useEffect(() => {
    if (deviceType === 'mobile') {
      // タッチイベントの最適化
      const handleTouchStart = (e: TouchEvent) => {
        // マルチタッチのサポート
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        // スクロールの最適化
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      };

      // ダブルタップズームの無効化（必要に応じて）
      let lastTouchEnd = 0;
      const handleTouchEnd = (e: TouchEvent) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      };

      document.addEventListener('touchstart', handleTouchStart, { passive: false });
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd, { passive: false });

      return () => {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [deviceType]);
};

export const ResponsiveDashboard: React.FC<ResponsiveDashboardProps> = memo(({
  children,
  onDeviceChange,
  onLayoutModeChange,
  showMobileDrawer = false,
  mobileDrawerContent,
  floatingActions = []
}) => {
  const {
    deviceType,
    layoutMode,
    setLayoutMode,
    isMobile,
    isTablet,
    isDesktop,
    isFullscreen,
    orientation,
    toggleFullscreen
  } = useDeviceDetection();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);

  // タッチ操作の強化
  useTouchEnhancements(deviceType);

  // デバイス変更の通知
  useEffect(() => {
    onDeviceChange?.(deviceType);
  }, [deviceType, onDeviceChange]);

  // レイアウトモード変更の通知
  useEffect(() => {
    onLayoutModeChange?.(layoutMode);
  }, [layoutMode, onLayoutModeChange]);

  // レスポンシブなコンテナ設定
  const getContainerProps = () => {
    const baseProps = {
      maxWidth: false as const,
      sx: {
        minHeight: '100vh',
        padding: isMobile ? 1 : isTablet ? 2 : 3,
        transition: 'all 0.3s ease-in-out'
      }
    };

    if (isMobile) {
      return {
        ...baseProps,
        sx: {
          ...baseProps.sx,
          paddingTop: '64px', // AppBar分の余白
          paddingBottom: '80px' // FAB分の余白
        }
      };
    }

    return baseProps;
  };

  // デフォルトフローティングアクション
  const defaultActions = [
    {
      icon: <RefreshIcon />,
      name: 'リフレッシュ',
      onClick: () => window.location.reload()
    },
    {
      icon: <FilterIcon />,
      name: 'フィルター',
    },
    {
      icon: isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />,
      name: isFullscreen ? 'フルスクリーン終了' : 'フルスクリーン',
      onClick: toggleFullscreen
    }
  ];

  const allActions = [...floatingActions, ...defaultActions];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'background.default',
        // デバイス別のスタイル調整
        '& .MuiCard-root': {
          borderRadius: isMobile ? 2 : 3,
          boxShadow: isMobile ? 1 : 3
        },
        '& .MuiButton-root': {
          minHeight: isMobile ? 48 : 36, // タッチターゲットサイズ
          fontSize: isMobile ? '1rem' : '0.875rem'
        },
        '& .MuiChip-root': {
          height: isMobile ? 36 : 32,
          fontSize: isMobile ? '0.875rem' : '0.8125rem'
        }
      }}
      data-device-type={deviceType}
      data-layout-mode={layoutMode}
      data-orientation={orientation}
    >
      {/* モバイル用AppBar */}
      {isMobile && (
        <AppBar 
          position="fixed" 
          sx={{ 
            zIndex: (theme) => theme.zIndex.drawer + 1,
            backgroundColor: 'primary.main'
          }}
        >
          <Toolbar>
            {showMobileDrawer && (
              <IconButton
                edge="start"
                color="inherit"
                onClick={() => setMobileDrawerOpen(true)}
                sx={{ mr: 2 }}
              >
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
              📚 学習進捗ダッシュボード
            </Typography>
            <IconButton color="inherit" onClick={toggleFullscreen}>
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Toolbar>
        </AppBar>
      )}

      {/* モバイル用サイドドロワー */}
      {isMobile && showMobileDrawer && (
        <Drawer
          anchor="left"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          sx={{
            '& .MuiDrawer-paper': {
              width: 280,
              padding: 2
            }
          }}
        >
          {mobileDrawerContent}
        </Drawer>
      )}

      {/* メインコンテンツエリア */}
      <Container {...getContainerProps()}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? 2 : isTablet ? 3 : 4,
            '& > *': {
              minWidth: 0, // オーバーフロー防止
            }
          }}
        >
          {children}
        </Box>
      </Container>

      {/* フローティングアクションボタン */}
      {isMobile ? (
        // モバイル: SpeedDial
        <SpeedDial
          ariaLabel="アクション"
          sx={{ 
            position: 'fixed', 
            bottom: 16, 
            right: 16,
            '& .MuiFab-primary': {
              width: 56,
              height: 56
            }
          }}
          icon={<SettingsIcon />}
          open={speedDialOpen}
          onClose={() => setSpeedDialOpen(false)}
          onOpen={() => setSpeedDialOpen(true)}
        >
          {allActions.map((action) => (
            <SpeedDialAction
              key={action.name}
              icon={action.icon}
              tooltipTitle={action.name}
              onClick={() => {
                action.onClick?.();
                setSpeedDialOpen(false);
              }}
              sx={{
                '& .MuiSpeedDialAction-fab': {
                  width: 48,
                  height: 48
                }
              }}
            />
          ))}
        </SpeedDial>
      ) : (
        // タブレット・デスクトップ: 個別FAB
        <Box sx={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {allActions.slice(0, 3).map((action, index) => (
            <Fab
              key={action.name}
              size={isTablet ? 'medium' : 'large'}
              color={index === 0 ? 'primary' : 'secondary'}
              onClick={action.onClick}
              sx={{ 
                boxShadow: 3,
                '&:hover': {
                  transform: 'scale(1.1)'
                },
                transition: 'transform 0.2s ease-in-out'
              }}
            >
              {action.icon}
            </Fab>
          ))}
        </Box>
      )}

      {/* デバッグ情報（開発時のみ） */}
      {process.env.NODE_ENV === 'development' && (
        <Box
          sx={{
            position: 'fixed',
            top: isMobile ? 70 : 10,
            left: 10,
            backgroundColor: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: 1,
            borderRadius: 1,
            fontSize: '0.75rem',
            fontFamily: 'monospace',
            zIndex: 9999
          }}
        >
          <div>Device: {deviceType}</div>
          <div>Layout: {layoutMode}</div>
          <div>Orientation: {orientation}</div>
          <div>Fullscreen: {isFullscreen ? 'Yes' : 'No'}</div>
        </Box>
      )}
    </Box>
  );
});

ResponsiveDashboard.displayName = 'ResponsiveDashboard';

export default ResponsiveDashboard;