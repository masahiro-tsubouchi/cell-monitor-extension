/**
 * 表示モード管理ユーティリティ
 * ズームレベルと画面サイズに応じた適応的表示制御
 */

import { getTeamDisplayName, TEAM_DISPLAY_PRESETS } from './teamNameUtils';

export type DisplayMode = 'minimal' | 'compact' | 'full';

export interface DisplayModeConfig {
  mode: DisplayMode;
  showTeamName: boolean;
  showFullTeamName: boolean;
  showBadges: boolean;
  iconSizeMultiplier: number;
  textVisibility: 'none' | 'abbreviated' | 'full';
}

/**
 * ズームレベルと画面サイズに基づく表示モード決定
 */
export const getDisplayMode = (
  zoom: number,
  screenWidth: number,
  isModal: boolean = false
): DisplayMode => {
  // モーダル表示では常にfullモード
  if (isModal) return 'full';
  
  if (screenWidth <= 480) { // スマホ
    if (zoom < 1.5) return 'minimal';
    if (zoom < 2.5) return 'compact';
    return 'full';
  } else if (screenWidth <= 768) { // タブレット
    if (zoom < 1.2) return 'minimal';
    if (zoom < 2.0) return 'compact';
    return 'full';
  } else { // デスクトップ
    if (zoom < 0.8) return 'minimal';
    if (zoom < 1.5) return 'compact';
    return 'full';
  }
};

/**
 * 表示モードに基づく設定取得
 */
export const getDisplayModeConfig = (mode: DisplayMode): DisplayModeConfig => {
  switch (mode) {
    case 'minimal':
      return {
        mode: 'minimal',
        showTeamName: true, // スマホでも常に文字表示
        showFullTeamName: false,
        showBadges: true, // ヘルプバッジは重要なので常に表示
        iconSizeMultiplier: 1.0,
        textVisibility: 'abbreviated' // minimalでも省略表示
      };
    
    case 'compact':
      return {
        mode: 'compact',
        showTeamName: true,
        showFullTeamName: false,
        showBadges: true,
        iconSizeMultiplier: 1.0,
        textVisibility: 'abbreviated'
      };
    
    case 'full':
      return {
        mode: 'full',
        showTeamName: true,
        showFullTeamName: true,
        showBadges: true,
        iconSizeMultiplier: 1.0,
        textVisibility: 'full'
      };
    
    default:
      return getDisplayModeConfig('full');
  }
};

/**
 * チーム名の表示テキスト取得（MAPアイコン専用 - 常にA-Z, 1-99表示）
 */
export const getTeamDisplayText = (
  teamName: string,
  displayMode: DisplayMode
): string => {
  const config = getDisplayModeConfig(displayMode);
  
  if (!config.showTeamName) return '';
  
  // MAPアイコンでは常にA-Z, 1-99形式で統一
  // スマホ・デスクトップ問わず簡略表示
  return getTeamDisplayName(teamName, TEAM_DISPLAY_PRESETS.MAP_ICON);
};

/**
 * 重要度ベースの表示優先順位計算
 */
export interface TeamStats {
  total: number;
  active: number;
  help: number;
  error: number;
}

export type TeamPriority = 'high' | 'medium' | 'low';

export const getTeamPriority = (stats: TeamStats): TeamPriority => {
  if (stats.help > 0) return 'high';     // ヘルプ要求あり
  if (stats.error > 0) return 'medium';  // エラーあり
  return 'low';                          // 通常状態
};

/**
 * 画面サイズに応じた表示可能チーム数の制御（スマホでも全チーム表示）
 */
export const shouldShowTeam = (
  teamName: string,
  priority: TeamPriority,
  screenWidth: number,
  currentVisibleCount: number,
  displayMode: DisplayMode
): boolean => {
  // 要求により、スマホでも全チーム表示するため制限を撤廃
  // 高優先度は常に表示（従来通り）
  if (priority === 'high') return true;
  
  // minimalモードでの制限は残す（極小表示時のパフォーマンス考慮）
  if (displayMode === 'minimal' && screenWidth <= 320) { 
    // 超小型画面（320px以下）でminimalモードの場合のみ制限
    const maxTeams = 8;
    if (currentVisibleCount >= maxTeams) {
      return false;
    }
  }
  
  // その他の場合は全チーム表示
  return true;
};