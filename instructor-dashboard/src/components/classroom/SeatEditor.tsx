import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  ButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Switch,
  Menu,
  MenuItem,
  Chip,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Save as SaveIcon,
  GetApp as TemplateIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { Seat, SeatStatus, Position, LayoutConfig, LayoutTemplate } from '../../types/api';

// TDD開発ルール: SeatEditor（座席レイアウトエディタ）Green フェーズ
// 目的: テストを通すための最小限の実装を作成する

export interface SeatEditorProps {
  seats: Seat[];
  layout: LayoutConfig;
  isEditMode: boolean;
  onSeatMove: (seatId: string, position: Position) => void;
  onSeatAdd: (seat: Omit<Seat, 'id'>) => void;
  onSeatRemove: (seatId: string) => void;
  onLayoutSave: (data: { name: string; seats: Seat[]; layout: LayoutConfig }) => void;
  onTemplateLoad: (templateId: string) => void;
  onSeatClick?: (seatId: string) => void;
  onEditModeChange?: (isEditMode: boolean) => void;
}

export const SeatEditor: React.FC<SeatEditorProps> = ({
  seats,
  layout,
  isEditMode,
  onSeatMove,
  onSeatAdd,
  onSeatRemove,
  onLayoutSave,
  onTemplateLoad,
  onSeatClick,
  onEditModeChange,
}) => {
  // 状態管理
  const [draggedSeat, setDraggedSeat] = useState<string | null>(null);
  const [addSeatDialog, setAddSeatDialog] = useState(false);
  const [saveLayoutDialog, setSaveLayoutDialog] = useState(false);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const [gridSnap, setGridSnap] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [canvasTransform, setCanvasTransform] = useState({ scale: 1, translateX: 0, translateY: 0 });
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; seatId: string } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // 新しい座席追加用の状態
  const [newSeat, setNewSeat] = useState({
    seatNumber: '',
    x: '',
    y: '',
  });

  // レイアウト保存用の状態
  const [layoutName, setLayoutName] = useState('');

  // ドラッグ&ドロップハンドラ
  const handleDragStart = useCallback((e: React.DragEvent, seatId: string) => {
    if (!isEditMode) return;

    setDraggedSeat(seatId);

    // dataTransferが存在する場合のみ設定
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', seatId);
    }

    // ドラッグ中のスタイルを適用
    const seatElement = e.target as HTMLElement;
    seatElement.classList.add('dragging');
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedSeat(null);
    e.currentTarget.classList.remove('dragging');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();

    if (!isEditMode || !draggedSeat) return;

    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect) return;

    // clientX, clientYが有効な数値であることを確認
    const clientX = e.clientX || 0;
    const clientY = e.clientY || 0;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // NaNチェック
    if (isNaN(x) || isNaN(y)) {
      setDraggedSeat(null);
      return;
    }

    // キャンバス範囲内チェック
    if (x < 0 || y < 0 || x > layout.width || y > layout.height) {
      setDraggedSeat(null);
      return;
    }

    let finalX = x;
    let finalY = y;

    // グリッドスナップ
    if (gridSnap) {
      finalX = Math.round(x / layout.gridSize) * layout.gridSize;
      finalY = Math.round(y / layout.gridSize) * layout.gridSize;
    }

    // 最終的な座標もNaNチェック
    if (!isNaN(finalX) && !isNaN(finalY)) {
      onSeatMove?.(draggedSeat, { x: finalX, y: finalY });
    }

    setDraggedSeat(null);

    // ドラッグスタイルをクリア
    const draggedElement = document.querySelector('.dragging');
    if (draggedElement) {
      draggedElement.classList.remove('dragging');
    }
  }, [isEditMode, draggedSeat, gridSnap, layout, onSeatMove]);

  // 座席追加ハンドラ
  const handleAddSeat = useCallback(() => {
    const x = parseInt(newSeat.x);
    const y = parseInt(newSeat.y);

    // バリデーション
    if (!newSeat.seatNumber || isNaN(x) || isNaN(y)) {
      return;
    }

    // 新しい座席オブジェクトを作成
    const newSeatObj = {
      seatNumber: newSeat.seatNumber,
      position: { x, y },
      status: SeatStatus.AVAILABLE,
      studentId: null,
      studentName: null,
    };

    onSeatAdd?.(newSeatObj);

    // ダイアログを閉じて入力をリセット
    setAddSeatDialog(false);
    setNewSeat({ seatNumber: '', x: '', y: '' });
  }, [newSeat, onSeatAdd]);

  // 座席削除ハンドラ
  const handleRemoveSeat = useCallback((seatId: string) => {
    onSeatRemove?.(seatId);
    setDeleteConfirmation(null);
    setContextMenu(null);
  }, [onSeatRemove]);

  // レイアウト保存ハンドラ
  const handleSaveLayout = useCallback(() => {
    if (!layoutName.trim()) return;

    onLayoutSave({
      name: layoutName,
      seats,
      layout,
    });

    setSaveLayoutDialog(false);
    setLayoutName('');
  }, [layoutName, seats, layout, onLayoutSave]);

  // テンプレート読み込みハンドラ
  const handleLoadTemplate = useCallback((templateId: string) => {
    onTemplateLoad(templateId);
    setTemplateDialog(false);
  }, [onTemplateLoad]);

  // コンテキストメニューハンドラ
  const handleContextMenu = useCallback((e: React.MouseEvent, seatId: string) => {
    e.preventDefault();
    if (!isEditMode) return;

    setContextMenu({
      mouseX: e.clientX - 2,
      mouseY: e.clientY - 4,
      seatId,
    });
  }, [isEditMode]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleDeleteFromMenu = useCallback(() => {
    if (contextMenu) {
      setDeleteConfirmation(contextMenu.seatId);
      setContextMenu(null);
    }
  }, [contextMenu]);

  // キーボードナビゲーション
  const handleKeyDown = useCallback((e: React.KeyboardEvent, seatId: string) => {
    if (!isEditMode) return;

    const seat = seats.find(s => s.id === seatId);
    if (!seat) return;

    let newX = seat.position.x;
    let newY = seat.position.y;
    const step = gridSnap ? layout.gridSize : 10;

    switch (e.key) {
      case 'ArrowLeft':
        newX = Math.max(0, newX - step);
        break;
      case 'ArrowRight':
        newX = Math.min(layout.width - 40, newX + step);
        break;
      case 'ArrowUp':
        newY = Math.max(0, newY - step);
        break;
      case 'ArrowDown':
        newY = Math.min(layout.height - 40, newY + step);
        break;
      case 'Delete':
        onSeatRemove(seatId);
        return;
      default:
        return;
    }

    e.preventDefault();
    onSeatMove(seatId, { x: newX, y: newY });
  }, [isEditMode, seats, layout, gridSnap, onSeatMove, onSeatRemove]);

  // ズーム・パンハンドラ
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setCanvasTransform(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(3, prev.scale * delta)),
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // 左クリックのみ

    const startX = e.clientX;
    const startY = e.clientY;
    const startTranslateX = canvasTransform.translateX;
    const startTranslateY = canvasTransform.translateY;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      setCanvasTransform(prev => ({
        ...prev,
        translateX: startTranslateX + deltaX,
        translateY: startTranslateY + deltaY,
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [canvasTransform]);



  // 座席の色を取得するヘルパー関数
  const getSeatColor = (status: SeatStatus) => {
    switch (status) {
      case SeatStatus.HELP_REQUESTED:
        return '#f44336'; // 赤
      case SeatStatus.OCCUPIED:
        return '#ff9800'; // オレンジ
      case 'empty' as SeatStatus:
        return '#4caf50'; // 緑
      case 'inactive' as SeatStatus:
        return '#9e9e9e'; // グレー
      default:
        return '#4caf50';
    }
  };

  // 座席のCSSクラス名を取得するヘルパー関数
  const getSeatClassName = (status: SeatStatus) => {
    switch (status) {
      case SeatStatus.AVAILABLE:
        return 'seat-available';
      case SeatStatus.HELP_REQUESTED:
        return 'seat-help-requested';
      case SeatStatus.OCCUPIED:
        return 'seat-occupied';
      case 'empty' as SeatStatus:
        return 'seat-empty';
      case 'inactive' as SeatStatus:
        return 'seat-inactive';
      default:
        return 'seat-available';
    }
  };

  return (
    <Box
      data-testid="seat-editor"
      role="application"
      aria-label="座席レイアウトエディタ"
      sx={{ p: 2 }}
    >
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            座席レイアウトエディタ
          </Typography>

          {/* 編集コントロール */}
          {isEditMode && (
            <Box data-testid="edit-controls" sx={{ mb: 2 }}>
              <ButtonGroup variant="outlined" sx={{ mr: 2 }}>
                <Button
                >
                  講義室レイアウト
                </Button>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => setAddSeatDialog(true)}
                >
                  座席を追加
                </Button>
                <Button
                  startIcon={<SaveIcon />}
                  onClick={() => setSaveLayoutDialog(true)}
                >
                  レイアウト保存
                </Button>
                <Button
                  startIcon={<TemplateIcon />}
                  onClick={() => setTemplateDialog(true)}
                >
                  テンプレート読み込み
                </Button>
              </ButtonGroup>

              <FormControlLabel
                control={
                  <Switch
                    checked={isEditMode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      onEditModeChange?.(e.target.checked);
                    }}
                    color="primary"
                  />
                }
                label="編集モード"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={gridSnap}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setGridSnap(e.target.checked);
                    }}
                    color="primary"
                  />
                }
                label="グリッドスナップ"
              />
            </Box>
          )}

          {/* 編集モード切り替えボタン */}
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => onEditModeChange?.(!isEditMode)}
            sx={{ mb: 2 }}
          >
            編集モード
          </Button>

          {/* 座席配置キャンバス */}
          <Box
            data-testid="seat-editor-canvas"
            role="img"
            aria-label="座席配置キャンバス"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            sx={{
              width: layout.width,
              height: layout.height,
              border: '2px solid #ccc',
              position: 'relative',
              overflow: 'hidden',
              cursor: isEditMode ? 'crosshair' : 'default',
              transform: `scale(${canvasTransform.scale}) translate(${canvasTransform.translateX}px, ${canvasTransform.translateY}px)`,
            }}
          >
            {/* 座席レンダリング */}
            {seats.map((seat) => (
              <Box
                key={seat.id}
                data-testid={`seat-${seat.id}`}
                draggable={isEditMode}
                onDragStart={(e) => handleDragStart(e, seat.id)}
                onKeyDown={(e) => handleKeyDown(e, seat.id)}
                onContextMenu={(e) => handleContextMenu(e, seat.id)}
                tabIndex={isEditMode ? 0 : -1}
                className={`${getSeatClassName(seat.status)} ${draggedSeat === seat.id ? 'dragging' : ''}`}
                sx={{
                  position: 'absolute',
                  left: seat.position.x,
                  top: seat.position.y,
                  width: 40,
                  height: 40,
                  backgroundColor: getSeatColor(seat.status),
                  border: '2px solid #333',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isEditMode ? 'move' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#fff',
                  '&.dragging': {
                    opacity: 0.5,
                  },
                }}
                onClick={() => onSeatClick?.(seat.id)}
              >
                <Typography variant="caption" sx={{ fontSize: '10px', color: 'white', display: 'block' }}>
                  {seat.seatNumber}
                </Typography>
                {seat.studentName && (
                  <Typography variant="caption" sx={{ fontSize: '8px', color: 'white', display: 'block' }}>
                    {seat.studentName}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* 座席追加ダイアログ */}
      <Dialog
        open={addSeatDialog}
        onClose={() => setAddSeatDialog(false)}
        data-testid="add-seat-dialog"
      >
        <DialogTitle>座席を追加</DialogTitle>
        <DialogContent>
          <TextField
            label="座席番号"
            value={newSeat.seatNumber}
            onChange={(e) => setNewSeat(prev => ({ ...prev, seatNumber: e.target.value }))}
            fullWidth
            margin="normal"
          />
          <TextField
            label="X座標"
            type="number"
            value={newSeat.x}
            onChange={(e) => setNewSeat(prev => ({ ...prev, x: e.target.value }))}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Y座標"
            type="number"
            value={newSeat.y}
            onChange={(e) => setNewSeat(prev => ({ ...prev, y: e.target.value }))}
            fullWidth
            margin="normal"
          />
          {/* バリデーションエラー表示 */}
          {(parseInt(newSeat.x) < 0 || parseInt(newSeat.x) > layout.width ||
            parseInt(newSeat.y) < 0 || parseInt(newSeat.y) > layout.height) && (
            <Typography color="error" variant="caption">
              座標は0以上、キャンバス範囲内で入力してください
            </Typography>
          )}
          {seats.some(seat => seat.seatNumber === newSeat.seatNumber) && newSeat.seatNumber && (
            <Typography color="error" variant="caption">
              この座席番号は既に使用されています
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddSeatDialog(false)}>キャンセル</Button>
          <Button onClick={handleAddSeat} variant="contained">追加</Button>
        </DialogActions>
      </Dialog>

      {/* レイアウト保存ダイアログ */}
      <Dialog
        open={saveLayoutDialog}
        onClose={() => setSaveLayoutDialog(false)}
        data-testid="save-layout-dialog"
      >
        <DialogTitle>レイアウト保存</DialogTitle>
        <DialogContent>
          <TextField
            label="レイアウト名"
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveLayoutDialog(false)}>キャンセル</Button>
          <Button onClick={handleSaveLayout} variant="contained">保存</Button>
        </DialogActions>
      </Dialog>

      {/* テンプレート選択ダイアログ */}
      <Dialog
        open={templateDialog}
        onClose={() => setTemplateDialog(false)}
        data-testid="template-dialog"
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>レイアウトテンプレート</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ width: '48%' }}>
              <Card
                data-testid="template-classroom-standard"
                onClick={() => handleLoadTemplate('classroom-standard')}
                sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#f5f5f5' } }}
              >
                <CardContent>
                  <Typography variant="h6">標準教室レイアウト</Typography>
                  <Typography variant="body2" color="text.secondary">
                    一般的な教室の座席配置
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialog(false)}>キャンセル</Button>
          <Button onClick={() => handleLoadTemplate('classroom-standard')} variant="contained">
            読み込み
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog
        open={!!deleteConfirmation}
        onClose={() => setDeleteConfirmation(null)}
        data-testid="delete-confirmation"
      >
        <DialogTitle>座席を削除</DialogTitle>
        <DialogContent>
          <Typography>この座席を削除してもよろしいですか？</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmation(null)}>キャンセル</Button>
          <Button
            onClick={() => deleteConfirmation && handleRemoveSeat(deleteConfirmation)}
            variant="contained"
            color="error"
          >
            削除する
          </Button>
        </DialogActions>
      </Dialog>

      {/* コンテキストメニュー */}
      <Menu
        open={!!contextMenu}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem
          onClick={() => {
            if (contextMenu) {
              setDeleteConfirmation(contextMenu.seatId);
            }
          }}
        >
          削除
        </MenuItem>
      </Menu>
    </Box>
  );
};
