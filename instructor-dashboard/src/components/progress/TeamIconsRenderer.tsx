import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { StudentActivity } from '../../services/dashboardAPI';
import { TeamPosition } from '../../services/classroomAPI';
import { calculateTeamLayout, adjustIconPositionForOverlap } from '../../utils/map/coordinateUtils';
import { 
  getDisplayMode, 
  getDisplayModeConfig, 
  getTeamDisplayText, 
  getTeamPriority, 
  shouldShowTeam,
  type TeamStats,
  type TeamPriority
} from '../../utils/displayModeUtils';

interface TeamIconsRendererProps {
  students: StudentActivity[];
  teams: string[];
  editingPositions: { [teamName: string]: TeamPosition };
  teamPositions?: { [teamName: string]: TeamPosition };
  draggedTeam: DraggedTeam | null;
  isEditMode: boolean;
  zoom?: number;
  browserZoomLevel: number;
  isModal?: boolean;
  onTeamDragStart?: (e: React.DragEvent, teamName: string) => void;
  onTeamDragEnd?: () => void;
  onTouchStart?: (e: React.TouchEvent, teamName: string) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
}

interface DraggedTeam {
  teamName: string;
  offsetX: number;
  offsetY: number;
}

// TeamStatsはdisplayModeUtilsからインポート

export const TeamIconsRenderer: React.FC<TeamIconsRendererProps> = ({
  students,
  teams,
  editingPositions,
  teamPositions,
  draggedTeam,
  isEditMode,
  zoom = 1,
  browserZoomLevel,
  isModal = false,
  onTeamDragStart,
  onTeamDragEnd,
  onTouchStart,
  onTouchMove,
  onTouchEnd
}) => {
  // 画面サイズの状態管理（リサイズ対応）
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  // リサイズイベントリスナー
  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // テスト用チーム名（実際の生徒がいない場合でも表示するため）
  const testTeams = ['チームA', 'チームB', 'チームC', 'チームD', 'チームE', 'チームF', 'チームG', 'チームH'];
  const displayTeams = teams.length > 0 ? teams : testTeams;

  // チーム統計の計算 - memoized for performance
  const teamStatsCache = useMemo(() => {
    const statsMap = new Map<string, TeamStats>();

    displayTeams.forEach(teamName => {
      const teamStudents = students.filter(s => s.teamName === teamName);
      statsMap.set(teamName, {
        total: teamStudents.length,
        active: teamStudents.filter(s => s.status === 'active').length,
        help: teamStudents.filter(s => s.isRequestingHelp).length,
        error: teamStudents.filter(s => s.status === 'error' || s.status === 'significant_error').length
      });
    });

    return statsMap;
  }, [students, displayTeams]);

  const getTeamStats = useCallback((teamName: string): TeamStats => {
    return teamStatsCache.get(teamName) || { total: 0, active: 0, help: 0, error: 0 };
  }, [teamStatsCache]);

  // 表示モードの決定
  const displayMode = useMemo(() => {
    return getDisplayMode(zoom, screenWidth, isModal);
  }, [zoom, screenWidth, isModal]);

  const displayConfig = useMemo(() => {
    return getDisplayModeConfig(displayMode);
  }, [displayMode]);

  // 優先順位付きチーム一覧の生成
  const prioritizedTeams = useMemo(() => {
    return displayTeams.map(teamName => {
      const teamStudents = students.filter(s => s.teamName === teamName);
      const stats = {
        total: teamStudents.length,
        active: teamStudents.filter(s => s.status === 'active').length,
        help: teamStudents.filter(s => s.isRequestingHelp).length,
        error: teamStudents.filter(s => s.status === 'error' || s.status === 'significant_error').length
      };
      const priority = getTeamPriority(stats);
      
      return { teamName, stats, priority };
    }).sort((a, b) => {
      // 優先順位でソート（高→中→低）
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [displayTeams, students]);

  // 表示対象チームの決定
  const visibleTeams = useMemo(() => {
    let visibleCount = 0;
    return prioritizedTeams.filter(({ teamName, priority }) => {
      const shouldShow = shouldShowTeam(teamName, priority, screenWidth, visibleCount, displayMode);
      if (shouldShow) visibleCount++;
      return shouldShow;
    });
  }, [prioritizedTeams, screenWidth, displayMode]);

  // デフォルト配置の計算（重複回避機能付き）
  const defaultPositions = useMemo(() => {
    return calculateTeamLayout(visibleTeams.length, 16/9, true);
  }, [visibleTeams.length]);

  // 画面サイズに基づくアイコンサイズ調整
  const getViewportBasedIconSize = useCallback(() => {
    
    if (screenWidth <= 480) { // スマホ
      return {
        baseIconSize: 32,  // 28 → 32 (視認性向上)
        baseFontSize: 10,  // 9 → 10
        badgeSize: 18,     // 16 → 18
        badgeFontSize: 9   // 8 → 9
      };
    } else if (screenWidth <= 768) { // タブレット
      return {
        baseIconSize: 36,  // 48 → 36 (25%削減)
        baseFontSize: 10,  // 12 → 10
        badgeSize: 18,     // 20 → 18
        badgeFontSize: 9   // 10 → 9
      };
    } else { // デスクトップ
      return {
        baseIconSize: 48,
        baseFontSize: 12,
        badgeSize: 20,
        badgeFontSize: 10
      };
    }
  }, [screenWidth]);

  // チームアイコンの描画（表示モード対応）
  const renderTeamIcon = useCallback((teamData: { teamName: string; stats: TeamStats; priority: TeamPriority }, index: number) => {
    const { teamName, stats } = teamData;
    
    const position = editingPositions[teamName] ||
                    teamPositions?.[teamName] ||
                    defaultPositions[index] ||
                    { x: 50, y: 50 };
    
    // 画面サイズに基づくサイズ設定を取得
    const { baseIconSize, baseFontSize, badgeSize, badgeFontSize } = getViewportBasedIconSize();

    // ブラウザ拡大率とzoomを考慮したサイズ調整（最小サイズ制限を強化）
    const effectiveZoom = isModal ? zoom : 1;
    const combinedZoom = effectiveZoom / Math.max(1, browserZoomLevel - 0.2);
    
    // 最小サイズ制限を強化（スマホでは特に小さくなりすぎないよう調整）
    const minIconSize = screenWidth <= 480 ? 28 : 32; // スマホ用最小サイズ向上
    const minFontSize = screenWidth <= 480 ? 9 : 10;  // スマホ用最小フォントサイズ向上
    
    const zoomAdjustedIconSize = Math.max(minIconSize, baseIconSize * combinedZoom);
    const zoomAdjustedFontSize = Math.max(minFontSize, baseFontSize * combinedZoom);
    const zoomAdjustedBadgeSize = Math.max(14, badgeSize * combinedZoom);
    const zoomAdjustedBadgeFontSize = Math.max(7, badgeFontSize * combinedZoom);

    // ステータスカラーの決定
    const getStatusColor = () => {
      if (stats.help > 0) return '#f44336'; // 赤色 - HELP要請中
      if (stats.error > 0) return '#ffc107'; // 黄色 - エラー発生中（通常+連続）
      return '#4caf50'; // 緑色 - 正常
    };

    return (
      <Box
        key={`${teamName}-${isModal ? 'modal' : 'main'}`}
        draggable={isEditMode && !isModal && !!onTeamDragStart}
        onDragStart={!isModal && onTeamDragStart ? (e) => onTeamDragStart(e, teamName) : undefined}
        onDragEnd={!isModal && onTeamDragEnd ? onTeamDragEnd : undefined}
        onTouchStart={!isModal && onTouchStart ? (e) => onTouchStart(e, teamName) : undefined}
        onTouchMove={!isModal && onTouchMove ? onTouchMove : undefined}
        onTouchEnd={!isModal && onTouchEnd ? onTouchEnd : undefined}
        sx={{
          position: 'absolute',
          top: `${position.y}%`,
          left: `${position.x}%`,
          zIndex: draggedTeam?.teamName === teamName ? 1000 : 10,
          cursor: isEditMode && !isModal ? 'move' : 'default',
          opacity: draggedTeam?.teamName === teamName ? 0.8 : 1,
          filter: draggedTeam?.teamName === teamName
            ? 'drop-shadow(0 8px 16px rgba(0,0,0,0.4))'
            : 'none',
          transform: draggedTeam?.teamName === teamName
            ? (isModal
                ? `translate(-50%, -50%) scale(${effectiveZoom * 1.1}) rotate(3deg)`
                : 'translate(-50%, -50%) scale(1.1) rotate(3deg)')
            : (isModal
                ? `translate(-50%, -50%) scale(${effectiveZoom})`
                : 'translate(-50%, -50%)'),
          transition: draggedTeam?.teamName === teamName ? 'none' : 'all 0.2s ease'
        }}
      >
        <Box
          sx={{
            width: zoomAdjustedIconSize,
            height: zoomAdjustedIconSize,
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: zoomAdjustedFontSize,
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            border: '3px solid white',
            animation: stats.help > 0 ? 'pulse 1.5s infinite' : 'none',
            transition: 'all 0.2s ease',
            '&:hover': {
              boxShadow: '0 6px 12px rgba(0,0,0,0.4)',
              transform: isEditMode && !isModal ? 'scale(1.1)' : 'scale(1.05)'
            }
          }}
          title={isEditMode
            ? `${teamName} をドラッグして移動`
            : `${teamName}: ${stats.total}人 (ヘルプ: ${stats.help}, エラー: ${stats.error})`
          }
        >
          {getTeamDisplayText(teamName, displayMode)}
        </Box>

        {/* ヘルプリクエストバッジ（表示モード考慮） */}
        {stats.help > 0 && displayConfig.showBadges && (
          <Box
            sx={{
              position: 'absolute',
              top: -5,
              right: -5,
              backgroundColor: '#f44336', // 赤色に統一
              color: 'white',
              borderRadius: '50%',
              width: zoomAdjustedBadgeSize,
              height: zoomAdjustedBadgeSize,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: zoomAdjustedBadgeFontSize,
              fontWeight: 'bold',
              animation: 'pulse 1.5s infinite'
            }}
          >
            {stats.help}
          </Box>
        )}

        {/* エラー発生バッジ（ヘルプと同じ位置、ヘルプ優先） */}
        {stats.error > 0 && stats.help === 0 && displayConfig.showBadges && (
          <Box
            sx={{
              position: 'absolute',
              top: -5,
              right: -5,
              backgroundColor: '#ffc107', // 黄色
              color: 'white',
              borderRadius: '50%',
              width: zoomAdjustedBadgeSize,
              height: zoomAdjustedBadgeSize,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: zoomAdjustedBadgeFontSize,
              fontWeight: 'bold'
            }}
          >
            {stats.error}
          </Box>
        )}
      </Box>
    );
  }, [
    editingPositions,
    teamPositions,
    defaultPositions,
    draggedTeam,
    isEditMode,
    zoom,
    browserZoomLevel,
    isModal,
    onTeamDragStart,
    onTeamDragEnd,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    getTeamStats,
    getViewportBasedIconSize,
    displayMode,
    displayConfig
  ]);

  return (
    <>
      {visibleTeams.map((teamData, index) => renderTeamIcon(teamData, index))}
    </>
  );
};

export default TeamIconsRenderer;
