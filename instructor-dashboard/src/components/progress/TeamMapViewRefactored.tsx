import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button,
  Switch,
  FormControlLabel,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Close as CloseIcon,
  CloudUpload as UploadIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { StudentActivity } from '../../services/dashboardAPI';
import {
  classroomAPI,
  ClassroomMapWithPositions,
  TeamPosition
} from '../../services/classroomAPI';
import {
  getInstructorId
} from '../../utils/instructorStorage';
import TeamIconsRenderer from './TeamIconsRenderer';
import useDragAndDrop from '../../hooks/map/useDragAndDrop';
import {
  detectBrowserZoomLevel,
  throttle,
  debounce
} from '../../utils/map/performanceUtils';
import {
  snapToGridPosition,
  formatCoordinates,
  calculateTeamLayout
} from '../../utils/map/coordinateUtils';

interface TeamMapViewProps {
  students: StudentActivity[];
  teams: string[];
}

export const TeamMapViewRefactored: React.FC<TeamMapViewProps> = ({ students, teams }) => {
  // テスト用チーム名（実際の生徒がいない場合でも表示するため）
  const testTeams = ['チームA', 'チームB', 'チームC', 'チームD', 'チームE', 'チームF', 'チームG', 'チームH'];
  const displayTeams = teams.length > 0 ? teams : testTeams;

  // 画像URL生成ヘルパー関数
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
  const [uploadProgress, setUploadProgress] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalMapContainerRef = useRef<HTMLDivElement>(null);

  // 履歴管理機能
  const saveToHistory = useCallback((newPositions: { [teamName: string]: TeamPosition }) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ ...newPositions });
      return newHistory.slice(-50); // 最大50個
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

  // ドラッグ&ドロップフックの初期化
  const dragAndDrop = useDragAndDrop({
    isEditMode,
    editingPositions,
    snapToGrid,
    browserZoomLevel,
    onPositionUpdate: setEditingPositions,
    onSaveToHistory: saveToHistory,
    onError: setError
  });

  // ResizeObserver for responsive layout - throttled for performance
  useEffect(() => {
    const handleResize = throttle((entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    }, 16); // 60fps相当

    const resizeObserver = new ResizeObserver(handleResize);

    if (dragAndDrop.mapContainerRef.current) {
      resizeObserver.observe(dragAndDrop.mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // ブラウザ拡大率検知 - debounced for performance
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

  // 自動リフレッシュ（他の講師による更新を検出）
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
    }, 30000); // 30秒ごと

    return () => clearInterval(interval);
  }, [isEditMode, mapData]);

  // データ読み込み関数
  const loadMapData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await classroomAPI.getClassroomMap();
      setMapData(data);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Failed to fetch')) {
          setError('ネットワーク接続エラー。インターネット接続を確認してください。');
        } else if (err.message.includes('404')) {
          setError('MAPデータが見つかりません。管理者にお問い合わせください。');
        } else if (err.message.includes('500')) {
          setError('サーバーエラーが発生しました。しばらく時間をおいて再試行してください。');
        } else {
          setError(`MAP読み込みエラー: ${err.message}`);
        }
      } else {
        setError('不明なエラーが発生しました');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ファイルアップロード関連
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));

    if (imageFile) {
      handleImageUpload(imageFile);
    }
  }, []); // handleImageUploadは意図的に除外

  const handleImageUpload = async (file: File) => {
    const validation = classroomAPI.validateUploadFile(file);
    if (!validation.valid) {
      setError(validation.error || 'ファイルが無効です');
      return;
    }

    try {
      setUploadProgress(true);
      setError(null);

      const instructorId = getInstructorId();
      const result = await classroomAPI.uploadMapImage(file, instructorId);

      if (result.success) {
        setSuccessMessage('MAPが正常にアップロードされました');
        await loadMapData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップロードに失敗しました');
    } finally {
      setUploadProgress(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleVisibilityToggle = () => {
    if (mapData) {
      setMapData({
        ...mapData,
        is_visible: !mapData.is_visible
      });
    }
  };

  const handleDeleteMap = async () => {
    if (!mapData?.map_info?.id) return;

    try {
      setIsLoading(true);
      await classroomAPI.deleteClassroomMap(mapData.map_info.id);
      setSuccessMessage('MAPが正常に削除されました');
      await loadMapData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MAP削除に失敗しました');
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
      // 現在の配置情報を編集用にコピー
      const currentPositions: { [teamName: string]: { x: number; y: number } } = {};
      displayTeams.forEach((teamName, index) => {
        const existing = mapData?.team_positions?.[teamName];
        if (existing) {
          currentPositions[teamName] = { x: existing.x, y: existing.y };
        } else {
          // calculateTeamLayout関数を使用してデフォルト配置を計算
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

      // 保存前に最新データを確認（競合検出）
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
      if (err instanceof Error) {
        if (err.message.includes('404')) {
          setError('MAPが削除されたか見つかりません。ページを更新してください。');
        } else if (err.message.includes('403')) {
          setError('配置更新の権限がありません。');
        } else if (err.message.includes('500')) {
          setError('サーバーエラーが発生しました。しばらく時間をおいて再試行してください。');
        } else {
          setError(`配置保存エラー: ${err.message}`);
        }
      } else {
        setError('チーム配置の保存に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ズーム制御
  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.5));

  // マウスドラッグ制御（モーダル内）
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
      <Card
        sx={{
          mb: 3,
          border: '2px dashed #ccc',
          backgroundColor: '#fafafa'
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <Box sx={{ mb: 2 }}>
            <UploadIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
            <Typography variant="h6" color="text.secondary">
              📍 チームMAPを追加
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              画像をドラッグ&ドロップするか、ボタンをクリックして教室のレイアウト画像をアップロード
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => fileInputRef.current?.click()}
            sx={{ mr: 2 }}
          >
            MAP画像を選択
          </Button>

          <FormControlLabel
            control={
              <Switch
                checked={false}
                onChange={handleVisibilityToggle}
              />
            }
            label="MAP表示"
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </CardContent>
      </Card>
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
        maxHeight: '400px',
        overflow: 'hidden',
        border: isEditMode ? '2px dashed #1976d2' : 'none'
      }}>
        <Box
          ref={dragAndDrop.mapContainerRef}
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            minHeight: 300,
            maxHeight: 500,
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
                objectFit: 'contain',
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
      <Dialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">チームMAP - 詳細表示</Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={handleZoomOut} size="small">
              <ZoomOutIcon />
            </IconButton>
            <Typography variant="body2" sx={{ minWidth: '60px', textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </Typography>
            <IconButton onClick={handleZoomIn} size="small">
              <ZoomInIcon />
            </IconButton>

            <IconButton onClick={() => setIsModalOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
          <Box
            ref={modalMapContainerRef}
            sx={{
              width: '100%',
              height: '70vh',
              minHeight: 400,
              position: 'relative',
              cursor: dragStart ? 'grabbing' : 'grab',
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              aspectRatio: '16 / 9'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {mapData?.map_info?.image_url && (
              <>
                <img
                  src={getImageUrl(mapData.map_info.image_url)}
                  alt="チームMAP"
                  style={{
                    transform: `scale(${zoom}) translate(${position.x}px, ${position.y}px)`,
                    transformOrigin: 'center center',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    width: '100%',
                    height: 'auto',
                    userSelect: 'none',
                    pointerEvents: 'none'
                  }}
                />
                {/* モーダル内チームアイコン */}
                <TeamIconsRenderer
                  students={students}
                  teams={displayTeams}
                  editingPositions={editingPositions}
                  teamPositions={mapData.team_positions}
                  draggedTeam={null}
                  isEditMode={false}
                  zoom={zoom}
                  browserZoomLevel={browserZoomLevel}
                  isModal={true}
                />
              </>
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setIsModalOpen(false)}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>

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
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setError(null);
                loadMapData();
              }}
            >
              再試行
            </Button>
          }
        >
          {error}
        </Alert>
      </Snackbar>

      {/* ローディング表示 */}
      {(isLoading || uploadProgress) && (
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

export default TeamMapViewRefactored;
