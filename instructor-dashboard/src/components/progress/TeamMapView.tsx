import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  IconButton,
  Switch,
  FormControlLabel,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar,
  Button
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  ZoomIn as ZoomInIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { StudentActivity } from '../../services/dashboardAPI';
import {
  classroomAPI,
  ClassroomMapWithPositions,
  TeamPosition
} from '../../services/classroomAPI';
import { getInstructorId } from '../../utils/instructorStorage';

// 新しいコンポーネントとフック
import TeamIconsRenderer from './TeamIconsRenderer';
import MapModal from './MapModal';
import MapUploadArea from './MapUploadArea';
import useDragAndDrop from '../../hooks/map/useDragAndDrop';
import useMapUpload from '../../hooks/map/useMapUpload';

// ユーティリティ
import {
  detectBrowserZoomLevel,
  throttle,
  debounce
} from '../../utils/map/performanceUtils';
import {
  formatCoordinates,
  calculateTeamLayout
} from '../../utils/map/coordinateUtils';
import {
  MapErrorHandler,
  useMapErrorHandler
} from '../../utils/map/errorHandling';

interface TeamMapViewProps {
  students: StudentActivity[];
  teams: string[];
}

export const TeamMapView: React.FC<TeamMapViewProps> = ({ students, teams }) => {
  // エラーハンドリング
  const errorHandler = useMapErrorHandler();

  // テスト用チーム名
  const testTeams = ['チームA', 'チームB', 'チームC', 'チームD', 'チームE', 'チームF', 'チームG', 'チームH'];
  const displayTeams = teams.length > 0 ? teams : testTeams;

  // 画像URL生成
  const getImageUrl = useCallback((imageUrl: string) => {
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1';
    const staticBaseUrl = apiBaseUrl.replace('/api/v1', '');
    const finalBaseUrl = staticBaseUrl.includes('fastapi') ? 'http://localhost:8000' : staticBaseUrl;
    return `${finalBaseUrl}${imageUrl}`;
  }, []);

  // サーバー側データ
  const [mapData, setMapData] = useState<ClassroomMapWithPositions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI状態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isEditMode, setIsEditMode] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [browserZoomLevel, setBrowserZoomLevel] = useState(1);

  // チーム配置編集
  const [editingPositions, setEditingPositions] = useState<{ [teamName: string]: TeamPosition }>({});

  // グリッドスナップ機能
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);

  // Undo/Redo機能
  const [history, setHistory] = useState<{ [teamName: string]: TeamPosition }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // UI フィードバック
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 履歴管理
  const saveToHistory = useCallback((newPositions: { [teamName: string]: TeamPosition }) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ ...newPositions });
      return newHistory.slice(-50);
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      setEditingPositions(previousState);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setEditingPositions(nextState);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // ドラッグ&ドロップフック
  const dragAndDrop = useDragAndDrop({
    isEditMode,
    editingPositions,
    snapToGrid,
    browserZoomLevel,
    onPositionUpdate: setEditingPositions,
    onSaveToHistory: saveToHistory,
    onError: setError
  });

  // ブラウザ拡大率検知
  useEffect(() => {
    const detectZoomLevel = debounce(() => {
      const zoomLevel = detectBrowserZoomLevel();
      if (Math.abs(zoomLevel - browserZoomLevel) > 0.01) {
        setBrowserZoomLevel(zoomLevel);
      }
    }, 100);

    detectZoomLevel();
    window.addEventListener('resize', detectZoomLevel);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', detectZoomLevel);
    }

    return () => {
      window.removeEventListener('resize', detectZoomLevel);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', detectZoomLevel);
      }
    };
  }, [browserZoomLevel]);

  // ResizeObserver
  useEffect(() => {
    const handleResize = throttle((entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    }, 16);

    const resizeObserver = new ResizeObserver(handleResize);

    if (dragAndDrop.mapContainerRef.current) {
      resizeObserver.observe(dragAndDrop.mapContainerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditMode) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, undo, redo]);

  // 初期データ読み込み
  useEffect(() => {
    loadMapData();
  }, []);

  // 自動リフレッシュ
  useEffect(() => {
    if (isEditMode) return;

    const interval = setInterval(async () => {
      try {
        const latestData = await classroomAPI.getClassroomMap();
        const hasChanges = !mapData ||
          JSON.stringify(mapData.team_positions) !== JSON.stringify(latestData.team_positions) ||
          mapData.map_info?.uploaded_at !== latestData.map_info?.uploaded_at;

        if (hasChanges) {
          setMapData(latestData);
        }
      } catch (err) {
        console.warn('MAP自動リフレッシュエラー:', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isEditMode, mapData]);

  // データ読み込み
  const loadMapData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await classroomAPI.getClassroomMap();
      setMapData(data);
    } catch (err) {
      const errorMessage = errorHandler.handleError(err, 'MAP読み込み');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 成功メッセージハンドラー
  const handleSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
  }, []);

  // エラーハンドラー
  const handleError = useCallback((error: string) => {
    setError(error);
  }, []);

  // 表示切り替え
  const handleVisibilityToggle = () => {
    if (mapData) {
      setMapData({
        ...mapData,
        is_visible: !mapData.is_visible
      });
    }
  };

  // MAP削除
  const handleDeleteMap = async () => {
    if (!mapData?.map_info?.id) return;

    try {
      setIsLoading(true);
      await classroomAPI.deleteClassroomMap(mapData.map_info.id);
      setSuccessMessage('MAPが正常に削除されました');
      await loadMapData();
    } catch (err) {
      const errorMessage = errorHandler.handleError(err, 'MAP削除');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 編集モード切り替え
  const handleEditModeToggle = () => {
    if (isEditMode) {
      setIsEditMode(false);
      setEditingPositions({});
    } else {
      setIsEditMode(true);
      const currentPositions: { [teamName: string]: { x: number; y: number } } = {};
      displayTeams.forEach((teamName, index) => {
        const existing = mapData?.team_positions?.[teamName];
        if (existing) {
          currentPositions[teamName] = { x: existing.x, y: existing.y };
        } else {
          const defaultPositions = calculateTeamLayout(displayTeams.length);
          const defaultPos = defaultPositions[index] || { x: 50, y: 50 };
          currentPositions[teamName] = defaultPos;
        }
      });
      setEditingPositions(currentPositions);
    }
  };

  // チーム配置保存
  const handleSavePositions = async () => {
    if (!mapData?.map_info?.id) return;

    try {
      setIsLoading(true);
      const instructorId = getInstructorId();

      // 競合検出
      const latestData = await classroomAPI.getClassroomMap();
      const hasConflict = Object.keys(editingPositions).some(teamName => {
        const current = mapData.team_positions[teamName];
        const latest = latestData.team_positions[teamName];
        return current && latest &&
               (current.x !== latest.x || current.y !== latest.y);
      });

      if (hasConflict) {
        const shouldContinue = window.confirm(
          '他の講師が同時にチーム配置を更新しています。続行すると他の更新を上書きしますが、よろしいですか？'
        );
        if (!shouldContinue) {
          setError('保存がキャンセルされました。最新の配置を確認してください。');
          await loadMapData();
          setIsEditMode(false);
          return;
        }
      }

      await classroomAPI.updateTeamPositions(
        mapData.map_info.id,
        editingPositions,
        instructorId
      );

      setSuccessMessage('チーム配置が保存されました');
      setIsEditMode(false);
      await loadMapData();
    } catch (err) {
      const errorMessage = errorHandler.handleError(err, 'チーム配置保存');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // ズーム制御
  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.5));

  // マウスドラッグ制御
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStart) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => setDragStart(null);

  // MAPが存在しない場合のアップロード画面
  if (!mapData || !mapData.map_info) {
    return (
      <MapUploadArea
        onSuccess={handleSuccess}
        onError={handleError}
        onDataReload={loadMapData}
        onVisibilityToggle={handleVisibilityToggle}
      />
    );
  }

  return (
    <Box sx={{ mb: 3 }}>
      {/* MAP制御パネル */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight="bold">
          🗺️ チームMAP ({mapData?.map_info?.original_filename || 'classroom-map'})
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={mapData?.is_visible || false}
                onChange={handleVisibilityToggle}
                size="small"
              />
            }
            label="表示"
          />

          {isEditMode && (
            <>
              <FormControlLabel
                control={
                  <Switch
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    size="small"
                  />
                }
                label="グリッド"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={snapToGrid}
                    onChange={(e) => setSnapToGrid(e.target.checked)}
                    size="small"
                  />
                }
                label="スナップ"
              />

              <Tooltip title="元に戻す (Ctrl+Z)">
                <IconButton
                  onClick={undo}
                  size="small"
                  disabled={!canUndo}
                  sx={{ ml: 1 }}
                >
                  <Box sx={{ transform: 'scaleX(-1)' }}>↩</Box>
                </IconButton>
              </Tooltip>

              <Tooltip title="やり直し (Ctrl+Y)">
                <IconButton
                  onClick={redo}
                  size="small"
                  disabled={!canRedo}
                >
                  ↩
                </IconButton>
              </Tooltip>
            </>
          )}

          {isEditMode ? (
            <>
              <Tooltip title="編集を保存">
                <IconButton onClick={handleSavePositions} size="small" color="primary" disabled={isLoading}>
                  <SaveIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="編集をキャンセル">
                <IconButton onClick={handleEditModeToggle} size="small" color="secondary">
                  <CancelIcon />
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip title="チーム配置を編集">
                <IconButton onClick={handleEditModeToggle} size="small" color="primary">
                  <EditIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="拡大表示">
                <IconButton onClick={() => setIsModalOpen(true)} size="small">
                  <ZoomInIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="MAP削除">
                <IconButton onClick={handleDeleteMap} size="small" color="error">
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      </Box>

      {/* 編集モード通知 */}
      {isEditMode && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            📍 編集モード: チームアイコンをドラッグして配置を変更できます。完了したら「保存」ボタンを押してください。
          </Typography>
        </Alert>
      )}

      {/* MAP表示エリア */}
      <Card sx={{
        position: 'relative',
        maxHeight: '350px',
        overflow: 'hidden',
        border: isEditMode ? '2px dashed #1976d2' : 'none'
      }}>
        <Box
          ref={dragAndDrop.mapContainerRef}
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            minHeight: 250,
            maxHeight: 350,
            cursor: isEditMode ? 'crosshair' : 'pointer',
            display: 'grid',
            placeItems: 'stretch',
            overflow: 'hidden',
            backgroundColor: dragAndDrop.isDragOverMap && isEditMode ? 'rgba(25, 118, 210, 0.1)' : 'transparent',
            border: dragAndDrop.isDragOverMap && isEditMode ? '3px dashed #1976d2' : 'none',
            transition: 'all 0.2s ease'
          }}
          onClick={isEditMode ? undefined : () => setIsModalOpen(true)}
          onDragOver={dragAndDrop.handleTeamDragOver}
          onDragLeave={dragAndDrop.handleTeamDragLeave}
          onDrop={dragAndDrop.handleTeamDrop}
        >
          {mapData?.map_info?.image_url && (
            <img
              src={getImageUrl(mapData.map_info.image_url)}
              alt="チームMAP"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                zIndex: 1
              }}
            />
          )}

          {/* グリッドオーバーレイ */}
          {showGrid && isEditMode && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 5,
                background: `
                  linear-gradient(to right, rgba(25, 118, 210, 0.2) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(25, 118, 210, 0.2) 1px, transparent 1px)
                `,
                backgroundSize: '10% 10%',
                pointerEvents: 'none'
              }}
            />
          )}

          {/* ドラッグ中の座標表示 */}
          {dragAndDrop.draggedTeam && dragAndDrop.currentDragPosition && (
            <Box
              sx={{
                position: 'absolute',
                top: `${dragAndDrop.currentDragPosition.y}%`,
                left: `${dragAndDrop.currentDragPosition.x}%`,
                transform: 'translate(-50%, -120%)',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace',
                zIndex: 1001,
                pointerEvents: 'none'
              }}
            >
              {dragAndDrop.draggedTeam.teamName}: {formatCoordinates(dragAndDrop.currentDragPosition.x, dragAndDrop.currentDragPosition.y)}
            </Box>
          )}

          {/* チームアイコン表示 */}
          <TeamIconsRenderer
            students={students}
            teams={displayTeams}
            editingPositions={editingPositions}
            teamPositions={mapData.team_positions}
            draggedTeam={dragAndDrop.draggedTeam}
            isEditMode={isEditMode}
            browserZoomLevel={browserZoomLevel}
            isModal={false}
            onTeamDragStart={dragAndDrop.handleTeamDragStart}
            onTeamDragEnd={dragAndDrop.handleTeamDragEnd}
            onTouchStart={dragAndDrop.handleTouchStart}
            onTouchMove={dragAndDrop.handleTouchMove}
            onTouchEnd={dragAndDrop.handleTouchEnd}
          />
        </Box>
      </Card>

      {/* 拡大表示モーダル */}
      <MapModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mapImageUrl={mapData?.map_info?.image_url || ''}
        students={students}
        teams={displayTeams}
        editingPositions={editingPositions}
        teamPositions={mapData.team_positions}
        browserZoomLevel={browserZoomLevel}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        position={position}
        dragStart={dragStart}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        getImageUrl={getImageUrl}
      />

      {/* アニメーション定義 */}
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
        `}
      </style>

      {/* 成功・エラーメッセージ */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSuccessMessage(null)}
          severity="success"
          sx={{ width: '100%' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={10000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setError(null)}
          severity="error"
          sx={{ width: '100%' }}
          action={
            errorHandler.isRetryable(error) ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  setError(null);
                  loadMapData();
                }}
              >
                {errorHandler.getRecommendedAction(error) || '再試行'}
              </Button>
            ) : undefined
          }
        >
          {error}
        </Alert>
      </Snackbar>

      {/* ローディング表示 */}
      {isLoading && (
        <Box sx={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999
        }}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
};

export default TeamMapView;
