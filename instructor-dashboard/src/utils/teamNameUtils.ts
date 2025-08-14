/**
 * チーム名表示統一ユーティリティ
 * MAP表示用とUI表示用の表示ロジックを統一管理
 */

export type TeamNameDisplayMode = 'map-icon' | 'full-ui';

export interface TeamNameConfig {
  mode: TeamNameDisplayMode;
  forceSimplified?: boolean; // 強制的に簡略化（MAP以外でも1文字表示）
}

/**
 * チーム名から識別子（A-Z, 1-99）を抽出
 */
export const extractTeamIdentifier = (teamName: string): string => {
  // 「チームA」→「A」、「チーム1」→「1」、「チーム10」→「10」
  const match = teamName.match(/^チーム([A-Z]|[1-9][0-9]?)$/);
  if (match) {
    return match[1];
  }
  
  // フォールバック: 最後の文字または数字を抽出
  const fallbackMatch = teamName.match(/([A-Z]|[1-9][0-9]?)$/);
  if (fallbackMatch) {
    return fallbackMatch[1];
  }
  
  // 最終フォールバック: 最初の文字
  return teamName.charAt(0) || '?';
};

/**
 * 統一されたチーム名表示テキスト取得
 */
export const getTeamDisplayName = (teamName: string, config: TeamNameConfig): string => {
  if (!teamName) return '?';
  
  switch (config.mode) {
    case 'map-icon':
      // MAP表示: 常に1文字の識別子のみ
      return extractTeamIdentifier(teamName);
    
    case 'full-ui':
      // UI表示: 強制簡略化でなければ完全表示
      if (config.forceSimplified) {
        return extractTeamIdentifier(teamName);
      }
      return teamName; // 「チームA」のまま表示
    
    default:
      return teamName;
  }
};

/**
 * チーム名バリデーション（統一）
 */
export const isValidTeamName = (teamName: string): boolean => {
  const pattern = /^チーム([A-Z]|[1-9][0-9]?)$/;
  return pattern.test(teamName);
};

/**
 * チーム名の標準化（不正な形式を修正）
 */
export const normalizeTeamName = (teamName: string): string => {
  if (!teamName) return 'チームA';
  
  // すでに正しい形式の場合はそのまま
  if (isValidTeamName(teamName)) {
    return teamName;
  }
  
  // 「Team1」→「チーム1」のような変換を試行
  const teamMatch = teamName.match(/^Team([A-Z]|[1-9][0-9]?)$/i);
  if (teamMatch) {
    return `チーム${teamMatch[1].toUpperCase()}`;
  }
  
  // 「A」→「チームA」のような補完を試行
  const singleMatch = teamName.match(/^([A-Z]|[1-9][0-9]?)$/);
  if (singleMatch) {
    return `チーム${singleMatch[1]}`;
  }
  
  // 修正不可能な場合はデフォルト
  return 'チームA';
};

/**
 * 表示用設定のプリセット
 */
export const TEAM_DISPLAY_PRESETS = {
  // MAP表示用（アイコン内の1文字）
  MAP_ICON: { mode: 'map-icon' as TeamNameDisplayMode },
  
  // 通常のUI表示用（完全なチーム名）
  FULL_UI: { mode: 'full-ui' as TeamNameDisplayMode },
  
  // コンパクトUI表示用（1文字に省略）
  COMPACT_UI: { mode: 'full-ui' as TeamNameDisplayMode, forceSimplified: true },
} as const;

/**
 * チーム一覧のソート（A-Z, 1-99の順）
 */
export const sortTeamsByIdentifier = (teams: string[]): string[] => {
  return teams.sort((a, b) => {
    const idA = extractTeamIdentifier(a);
    const idB = extractTeamIdentifier(b);
    
    // アルファベットと数字を分離
    const isNumberA = /^\d+$/.test(idA);
    const isNumberB = /^\d+$/.test(idB);
    
    if (isNumberA && isNumberB) {
      // 両方数字の場合は数値でソート
      return parseInt(idA) - parseInt(idB);
    } else if (!isNumberA && !isNumberB) {
      // 両方アルファベットの場合は文字列でソート
      return idA.localeCompare(idB);
    } else {
      // アルファベットを先に、数字を後に
      return isNumberA ? 1 : -1;
    }
  });
};

/**
 * デバッグ用: チーム名情報を表示
 */
export const debugTeamName = (teamName: string) => {
  return {
    original: teamName,
    isValid: isValidTeamName(teamName),
    identifier: extractTeamIdentifier(teamName),
    normalized: normalizeTeamName(teamName),
    displays: {
      mapIcon: getTeamDisplayName(teamName, TEAM_DISPLAY_PRESETS.MAP_ICON),
      fullUI: getTeamDisplayName(teamName, TEAM_DISPLAY_PRESETS.FULL_UI),
      compactUI: getTeamDisplayName(teamName, TEAM_DISPLAY_PRESETS.COMPACT_UI),
    }
  };
};