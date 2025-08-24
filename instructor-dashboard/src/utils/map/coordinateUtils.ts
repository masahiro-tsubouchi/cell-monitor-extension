/**
 * MAP座標計算ユーティリティ
 * チームアイコンの配置計算とブラウザ拡大率対応
 */

export interface Position {
  x: number;
  y: number;
}

export interface ContainerSize {
  width: number;
  height: number;
}

export interface CoordinateTransformer {
  logicalToScreen: (logical: Position) => Position;
  screenToLogical: (screen: Position) => Position;
  maintainAspectRatio: (position: Position, targetAspectRatio?: number) => Position;
}

/**
 * 座標変換クラス
 */
export class MapCoordinateTransformer implements CoordinateTransformer {
  constructor(
    private containerSize: ContainerSize,
    private browserZoomLevel: number = 1
  ) {}

  /**
   * 論理座標(%) → 画面座標(px) - ブラウザ拡大率補正付き
   */
  logicalToScreen(logical: Position): Position {
    const scaleX = this.containerSize.width / 100;
    const scaleY = this.containerSize.height / 100;

    return {
      x: (logical.x * scaleX) / this.browserZoomLevel,
      y: (logical.y * scaleY) / this.browserZoomLevel
    };
  }

  /**
   * 画面座標(px) → 論理座標(%) - ブラウザ拡大率補正付き
   */
  screenToLogical(screen: Position): Position {
    const scaleX = this.containerSize.width / 100;
    const scaleY = this.containerSize.height / 100;

    return {
      x: (screen.x * this.browserZoomLevel) / scaleX,
      y: (screen.y * this.browserZoomLevel) / scaleY
    };
  }

  /**
   * アスペクト比を維持した座標計算
   */
  maintainAspectRatio(position: Position, targetAspectRatio = 16/9): Position {
    const currentAspectRatio = this.containerSize.width / this.containerSize.height;
    const aspectScale = currentAspectRatio / targetAspectRatio;

    if (aspectScale > 1) {
      // 横長の場合、y座標を調整
      return { x: position.x, y: position.y * aspectScale };
    } else {
      // 縦長の場合、x座標を調整
      return { x: position.x / aspectScale, y: position.y };
    }
  }
}

/**
 * グリッドスナップ機能
 */
export const snapToGridPosition = (
  position: Position,
  gridSize: number = 10,
  enabled: boolean = true
): Position => {
  if (!enabled) return position;

  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize
  };
};

/**
 * 座標の境界チェック
 */
export const boundPosition = (
  position: Position,
  margin: number = 5
): Position => {
  return {
    x: Math.max(margin, Math.min(100 - margin, position.x)),
    y: Math.max(margin, Math.min(100 - margin, position.y))
  };
};

/**
 * 距離計算（論理座標での）
 */
export const calculateDistance = (pos1: Position, pos2: Position): number => {
  return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
};

/**
 * アイコン重複チェック・調整機能（画面サイズ適応）
 */
export const adjustIconPositionForOverlap = (
  targetPosition: Position,
  existingPositions: Position[],
  minDistance: number = 8, // 8%の最小距離
  maxAttempts: number = 12,
  screenWidth: number = 1200 // 画面幅（デフォルトはデスクトップ）
): Position => {
  // スマホの場合は最小距離を調整
  const adjustedMinDistance = screenWidth <= 480 ? Math.max(6, minDistance * 0.75) : minDistance;
  let adjustedPosition = { ...targetPosition };
  
  const checkOverlap = (position: Position) => {
    return existingPositions.some(existingPos => 
      calculateDistance(position, existingPos) < adjustedMinDistance
    );
  };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (!checkOverlap(adjustedPosition)) {
      return boundPosition(adjustedPosition);
    }
    
    // 重複がある場合は螺旋状に新しい位置を探す
    const angle = (attempt * 60) % 360; // 60度ずつ回転
    const radius = Math.min(5 + attempt * 2, 15); // 半径を徐々に拡大
    const radians = (angle * Math.PI) / 180;
    
    adjustedPosition = {
      x: targetPosition.x + Math.cos(radians) * radius,
      y: targetPosition.y + Math.sin(radians) * radius
    };
  }
  
  return boundPosition(adjustedPosition);
};

/**
 * チームの自動配置計算（重複回避機能付き）
 */
export const calculateTeamLayout = (
  teamCount: number,
  containerAspectRatio: number = 16/9,
  preventOverlap: boolean = true
): Position[] => {
  if (teamCount === 0) return [];

  // 最適な列数を計算（アスペクト比を考慮）
  const optimalCols = Math.ceil(Math.sqrt(teamCount * containerAspectRatio));
  const cols = Math.min(6, optimalCols); // 最大6列
  const rows = Math.ceil(teamCount / cols);

  const positions: Position[] = [];
  const margin = 10; // 10%のマージン
  const availableWidth = 100 - (margin * 2);
  const availableHeight = 100 - (margin * 2);

  for (let i = 0; i < teamCount; i++) {
    const colIndex = i % cols;
    const rowIndex = Math.floor(i / cols);

    // 1列/1行の場合は中央配置
    const xStep = cols === 1 ? 0 : availableWidth / (cols - 1);
    const yStep = rows === 1 ? 0 : availableHeight / (rows - 1);

    const basePosition = {
      x: margin + (cols === 1 ? availableWidth / 2 : colIndex * xStep),
      y: margin + (rows === 1 ? availableHeight / 2 : rowIndex * yStep)
    };

    // 重複回避機能が有効な場合は調整
    const finalPosition = preventOverlap 
      ? adjustIconPositionForOverlap(basePosition, positions)
      : basePosition;
    
    positions.push(finalPosition);
  }

  return positions;
};

/**
 * 座標フォーマット関数
 */
export const formatCoordinates = (x: number, y: number): string => {
  return `(${x.toFixed(1)}%, ${y.toFixed(1)}%)`;
};

/**
 * ドラッグ座標計算
 */
export const calculateDragPosition = (
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  dragOffset: Position,
  browserZoomLevel: number = 1
): Position => {
  // ドラッグ開始時のオフセットを考慮した実際のドロップ位置
  const dropX = clientX - containerRect.left - dragOffset.x;
  const dropY = clientY - containerRect.top - dragOffset.y;

  // コンテナサイズに対する相対位置（パーセント）に変換
  return {
    x: (dropX / containerRect.width) * 100,
    y: (dropY / containerRect.height) * 100
  };
};

/**
 * ブラウザ拡大率検出
 */
export const detectBrowserZoomLevel = (): number => {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const visualViewport = window.visualViewport;

  if (visualViewport) {
    // Visual Viewport APIが利用可能な場合
    return Math.round((window.innerWidth / visualViewport.width) * 100) / 100;
  } else {
    // フォールバック：devicePixelRatioを使用
    return devicePixelRatio;
  }
};
