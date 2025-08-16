/**
 * Dashboard共通型定義
 * 従来版と最適化版で統一された型定義
 */

// ViewMode型の統一定義
export type DashboardViewMode = 'grid' | 'team' | 'virtualized';

// ViewModeラベルの取得関数
export function getViewModeLabel(mode: DashboardViewMode): string {
  switch (mode) {
    case 'team': return 'チーム別表示';
    case 'grid': return 'チームグリッド（優先度順・最大8チーム）';
    case 'virtualized': return '仮想スクロール（全員表示）';
    default: return '';
  }
}

// ViewModeの初期値
export const DEFAULT_VIEW_MODE: DashboardViewMode = 'team';

// ViewModeのバリデーション
export function isValidViewMode(mode: string): mode is DashboardViewMode {
  return ['grid', 'team', 'virtualized'].includes(mode);
}

// レガシー型からの変換
export function convertLegacyViewMode(legacyMode: 'grid' | 'team'): DashboardViewMode {
  return legacyMode;
}