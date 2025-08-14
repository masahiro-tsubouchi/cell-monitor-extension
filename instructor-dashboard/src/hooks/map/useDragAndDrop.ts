import { useState, useCallback, useRef } from 'react';
import { TeamPosition } from '../../services/classroomAPI';
import {
  calculateDragPosition,
  snapToGridPosition,
  boundPosition,
  Position
} from '../../utils/map/coordinateUtils';

interface DraggedTeam {
  teamName: string;
  offsetX: number;
  offsetY: number;
}

interface UseDragAndDropProps {
  isEditMode: boolean;
  editingPositions: { [teamName: string]: TeamPosition };
  snapToGrid: boolean;
  browserZoomLevel: number;
  onPositionUpdate: (positions: { [teamName: string]: TeamPosition }) => void;
  onSaveToHistory: (positions: { [teamName: string]: TeamPosition }) => void;
  onError: (error: string) => void;
}

interface TouchState {
  startPos: Position | null;
  isDragging: boolean;
}

export const useDragAndDrop = ({
  isEditMode,
  editingPositions,
  snapToGrid,
  browserZoomLevel,
  onPositionUpdate,
  onSaveToHistory,
  onError
}: UseDragAndDropProps) => {
  const [draggedTeam, setDraggedTeam] = useState<DraggedTeam | null>(null);
  const [isDragOverMap, setIsDragOverMap] = useState(false);
  const [currentDragPosition, setCurrentDragPosition] = useState<Position | null>(null);
  const [touchState, setTouchState] = useState<TouchState>({
    startPos: null,
    isDragging: false
  });

  const mapContainerRef = useRef<HTMLDivElement>(null);

  // ドラッグ開始ハンドラー
  const handleTeamDragStart = useCallback((e: React.DragEvent, teamName: string) => {
    if (!isEditMode) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;

    setDraggedTeam({
      teamName,
      offsetX,
      offsetY
    });

    console.log('ドラッグ開始:', teamName);
  }, [isEditMode]);

  // ドラッグオーバーハンドラー
  const handleTeamDragOver = useCallback((e: React.DragEvent) => {
    if (!isEditMode || !draggedTeam) return;
    e.preventDefault();
    setIsDragOverMap(true);

    // リアルタイム座標表示のため現在位置を更新
    const containerRect = mapContainerRef.current?.getBoundingClientRect();
    if (containerRect) {
      const position = calculateDragPosition(
        e.clientX,
        e.clientY,
        containerRect,
        { x: draggedTeam.offsetX, y: draggedTeam.offsetY },
        browserZoomLevel
      );
      setCurrentDragPosition(boundPosition(position));
    }
  }, [isEditMode, draggedTeam, browserZoomLevel]);

  // ドラッグリーブハンドラー
  const handleTeamDragLeave = useCallback((e: React.DragEvent) => {
    if (!isEditMode) return;

    // イベントがMAP領域外に出た場合のみドラッグオーバー状態をリセット
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (rect && (e.clientX < rect.left || e.clientX > rect.right ||
                 e.clientY < rect.top || e.clientY > rect.bottom)) {
      setIsDragOverMap(false);
      setCurrentDragPosition(null);
    }
  }, [isEditMode]);

  // ドロップハンドラー
  const handleTeamDrop = useCallback((e: React.DragEvent) => {
    if (!isEditMode || !draggedTeam) {
      console.warn('ドロップ処理スキップ: 編集モードOFF または ドラッグ中のチーム情報なし');
      return;
    }

    e.preventDefault();

    try {
      const containerRect = mapContainerRef.current?.getBoundingClientRect();
      if (!containerRect) {
        console.error('コンテナ要素が見つかりません');
        setDraggedTeam(null);
        return;
      }

      // 座標計算
      const position = calculateDragPosition(
        e.clientX,
        e.clientY,
        containerRect,
        { x: draggedTeam.offsetX, y: draggedTeam.offsetY },
        browserZoomLevel
      );

      // 境界チェック
      let boundedPosition = boundPosition(position);

      // グリッドスナップ適用
      const snappedPosition = snapToGridPosition(boundedPosition, 10, snapToGrid);
      boundedPosition = snappedPosition;

      console.log('ドラッグドロップ座標計算:', {
        client: { x: e.clientX, y: e.clientY },
        container: { width: containerRect.width, height: containerRect.height },
        offset: { x: draggedTeam.offsetX, y: draggedTeam.offsetY },
        bounded: boundedPosition,
        teamName: draggedTeam.teamName
      });

      // 編集中の位置を更新
      const newPositions = {
        ...editingPositions,
        [draggedTeam.teamName]: boundedPosition
      };

      onPositionUpdate(newPositions);
      onSaveToHistory(newPositions);

      console.log(`チーム${draggedTeam.teamName}の位置を更新: (${boundedPosition.x.toFixed(1)}%, ${boundedPosition.y.toFixed(1)}%)`);

    } catch (error) {
      console.error('ドラッグドロップ処理エラー:', error);
      onError('チーム位置の更新に失敗しました');
    } finally {
      setDraggedTeam(null);
      setIsDragOverMap(false);
      setCurrentDragPosition(null);
    }
  }, [
    isEditMode,
    draggedTeam,
    browserZoomLevel,
    snapToGrid,
    editingPositions,
    onPositionUpdate,
    onSaveToHistory,
    onError
  ]);

  // ドラッグ終了ハンドラー
  const handleTeamDragEnd = useCallback(() => {
    setDraggedTeam(null);
    setIsDragOverMap(false);
    setCurrentDragPosition(null);
  }, []);

  // タッチイベントハンドラー
  const handleTouchStart = useCallback((e: React.TouchEvent, teamName: string) => {
    if (!isEditMode) return;

    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();

    setTouchState({
      startPos: { x: touch.clientX, y: touch.clientY },
      isDragging: true
    });

    setDraggedTeam({
      teamName,
      offsetX: touch.clientX - rect.left - rect.width / 2,
      offsetY: touch.clientY - rect.top - rect.height / 2
    });

    console.log('タッチドラッグ開始:', teamName);
  }, [isEditMode]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchState.isDragging || !draggedTeam) return;

    e.preventDefault();
    const touch = e.touches[0];

    // タッチ移動距離が閾値を超えたらドラッグ開始
    if (touchState.startPos) {
      const distance = Math.sqrt(
        Math.pow(touch.clientX - touchState.startPos.x, 2) +
        Math.pow(touch.clientY - touchState.startPos.y, 2)
      );

      if (distance > 10) { // 10px以上移動でドラッグ開始
        setIsDragOverMap(true);

        // リアルタイム座標表示
        const containerRect = mapContainerRef.current?.getBoundingClientRect();
        if (containerRect) {
          const position = calculateDragPosition(
            touch.clientX,
            touch.clientY,
            containerRect,
            { x: draggedTeam.offsetX, y: draggedTeam.offsetY },
            browserZoomLevel
          );
          setCurrentDragPosition(boundPosition(position));
        }
      }
    }
  }, [touchState, draggedTeam, browserZoomLevel]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchState.isDragging || !draggedTeam) {
      setTouchState({ startPos: null, isDragging: false });
      return;
    }

    e.preventDefault();

    try {
      const touch = e.changedTouches[0];
      const containerRect = mapContainerRef.current?.getBoundingClientRect();

      if (!containerRect) {
        console.error('コンテナ要素が見つかりません (タッチ)');
        return;
      }

      // 座標計算
      const position = calculateDragPosition(
        touch.clientX,
        touch.clientY,
        containerRect,
        { x: draggedTeam.offsetX, y: draggedTeam.offsetY },
        browserZoomLevel
      );

      let boundedPosition = boundPosition(position);

      // グリッドスナップ適用
      const snappedPosition = snapToGridPosition(boundedPosition, 10, snapToGrid);
      boundedPosition = snappedPosition;

      console.log('タッチドロップ座標:', {
        touch: { x: touch.clientX, y: touch.clientY },
        container: { width: containerRect.width, height: containerRect.height },
        bounded: boundedPosition,
        teamName: draggedTeam.teamName
      });

      const newPositions = {
        ...editingPositions,
        [draggedTeam.teamName]: boundedPosition
      };

      onPositionUpdate(newPositions);
      onSaveToHistory(newPositions);

      console.log(`チーム${draggedTeam.teamName}の位置を更新 (タッチ): (${boundedPosition.x.toFixed(1)}%, ${boundedPosition.y.toFixed(1)}%)`);

    } catch (error) {
      console.error('タッチドロップ処理エラー:', error);
      onError('チーム位置の更新に失敗しました (タッチ)');
    } finally {
      setDraggedTeam(null);
      setIsDragOverMap(false);
      setCurrentDragPosition(null);
      setTouchState({ startPos: null, isDragging: false });
    }
  }, [
    touchState,
    draggedTeam,
    browserZoomLevel,
    snapToGrid,
    editingPositions,
    onPositionUpdate,
    onSaveToHistory,
    onError
  ]);

  return {
    // 状態
    draggedTeam,
    isDragOverMap,
    currentDragPosition,
    mapContainerRef,

    // イベントハンドラー
    handleTeamDragStart,
    handleTeamDragOver,
    handleTeamDragLeave,
    handleTeamDrop,
    handleTeamDragEnd,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  };
};

export default useDragAndDrop;
