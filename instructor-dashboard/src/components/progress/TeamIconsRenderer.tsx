import React, { useCallback, useMemo } from 'react';
import { Box } from '@mui/material';
import { StudentActivity } from '../../services/dashboardAPI';
import { TeamPosition } from '../../services/classroomAPI';
import { calculateTeamLayout } from '../../utils/map/coordinateUtils';

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

interface TeamStats {
  total: number;
  active: number;
  help: number;
  error: number;
}

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
        error: teamStudents.filter(s => s.status === 'error').length
      });
    });

    return statsMap;
  }, [students, displayTeams]);

  const getTeamStats = useCallback((teamName: string): TeamStats => {
    return teamStatsCache.get(teamName) || { total: 0, active: 0, help: 0, error: 0 };
  }, [teamStatsCache]);

  // デフォルト配置の計算
  const defaultPositions = useMemo(() => {
    return calculateTeamLayout(displayTeams.length);
  }, [displayTeams.length]);

  // チームアイコンの描画
  const renderTeamIcon = useCallback((teamName: string, index: number) => {
    const position = editingPositions[teamName] ||
                    teamPositions?.[teamName] ||
                    defaultPositions[index] ||
                    { x: 50, y: 50 };

    const stats = getTeamStats(teamName);

    // ブラウザ拡大率に応じてアイコンサイズを動的調整
    const baseIconSize = 48;
    const baseFontSize = 12;
    const zoomAdjustedIconSize = Math.max(24, baseIconSize / Math.max(1, browserZoomLevel - 0.2));
    const zoomAdjustedFontSize = Math.max(8, baseFontSize / Math.max(1, browserZoomLevel - 0.2));

    // ステータスカラーの決定
    const getStatusColor = () => {
      if (stats.error > 0) return '#f44336'; // 赤
      if (stats.help > 0) return '#ff9800';  // オレンジ
      return '#4caf50'; // 緑
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
                ? `translate(-50%, -50%) scale(${zoom * 1.1}) rotate(3deg)`
                : 'translate(-50%, -50%) scale(1.1) rotate(3deg)')
            : (isModal
                ? `translate(-50%, -50%) scale(${zoom})`
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
          {teamName.replace('チーム', '')}
        </Box>

        {/* ヘルプリクエストバッジ */}
        {stats.help > 0 && (
          <Box
            sx={{
              position: 'absolute',
              top: -5,
              right: -5,
              backgroundColor: '#ff9800',
              color: 'white',
              borderRadius: '50%',
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              animation: 'pulse 1.5s infinite'
            }}
          >
            {stats.help}
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
    getTeamStats
  ]);

  return (
    <>
      {displayTeams.map((teamName, index) => renderTeamIcon(teamName, index))}
    </>
  );
};

export default TeamIconsRenderer;
