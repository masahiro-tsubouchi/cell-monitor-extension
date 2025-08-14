/**
 * 講師別ローカルストレージ管理ユーティリティ
 * 20人の講師が各自のデバイスで個別設定を保持
 */

// MAP設定の型定義
interface MapSettings {
  imageUrl?: string;
  imageName?: string;
  isVisible: boolean;
  teamPositions: { [teamName: string]: { x: number; y: number } };
}

// 講師設定の型定義
export interface InstructorSettings {
  instructorId: string;
  expandedTeams: string[];
  viewMode: 'grid' | 'team';
  autoRefresh: boolean;
  selectedStudent?: string;
  lastUpdate: string;
  refreshInterval: number;
  mapSettings?: MapSettings;
}

// デフォルト設定
const DEFAULT_SETTINGS: Omit<InstructorSettings, 'instructorId'> = {
  expandedTeams: [],
  viewMode: 'team',
  autoRefresh: true,
  refreshInterval: 10000, // 10秒
  lastUpdate: new Date().toISOString(),
  mapSettings: {
    isVisible: false,
    teamPositions: {}
  }
};

/**
 * 講師IDを生成または取得
 * 各デバイス/ブラウザで一意のIDを自動生成
 */
export const getInstructorId = (): string => {
  const STORAGE_KEY = 'instructorId';
  let instructorId = localStorage.getItem(STORAGE_KEY);

  if (!instructorId) {
    // 一意のIDを生成: タイムスタンプ + ランダム文字列
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substr(2, 9);
    instructorId = `instructor_${timestamp}_${randomStr}`;

    localStorage.setItem(STORAGE_KEY, instructorId);
    console.log(`新しい講師IDを生成: ${instructorId}`);
  }

  return instructorId;
};

/**
 * 講師設定を取得
 */
export const getInstructorSettings = (): InstructorSettings => {
  const instructorId = getInstructorId();
  const storageKey = `settings_${instructorId}`;

  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        instructorId,
        ...DEFAULT_SETTINGS,
        ...parsed,
        lastUpdate: new Date().toISOString(), // 取得時に更新
      };
    }
  } catch (error) {
    console.warn('講師設定の読み込みに失敗:', error);
  }

  // デフォルト設定を返す
  const defaultSettings: InstructorSettings = {
    instructorId,
    ...DEFAULT_SETTINGS,
  };

  saveInstructorSettings(defaultSettings);
  return defaultSettings;
};

/**
 * 講師設定を保存
 */
export const saveInstructorSettings = (settings: Partial<InstructorSettings>): void => {
  const instructorId = getInstructorId();
  const storageKey = `settings_${instructorId}`;

  try {
    const currentSettings = getInstructorSettings();
    const updatedSettings: InstructorSettings = {
      ...currentSettings,
      ...settings,
      instructorId,
      lastUpdate: new Date().toISOString(),
    };

    localStorage.setItem(storageKey, JSON.stringify(updatedSettings));
    console.log('講師設定を保存:', updatedSettings);
  } catch (error) {
    console.error('講師設定の保存に失敗:', error);
  }
};

/**
 * 展開中チーム設定の管理
 */
export const updateExpandedTeams = (teamName: string, isExpanded: boolean): void => {
  const settings = getInstructorSettings();
  const expandedTeams = new Set(settings.expandedTeams);

  if (isExpanded) {
    expandedTeams.add(teamName);
  } else {
    expandedTeams.delete(teamName);
  }

  saveInstructorSettings({
    expandedTeams: Array.from(expandedTeams),
  });
};

/**
 * 表示モード設定の更新
 */
export const updateViewMode = (viewMode: 'grid' | 'team'): void => {
  saveInstructorSettings({ viewMode });
};

/**
 * 自動更新設定の更新
 */
export const updateAutoRefresh = (autoRefresh: boolean): void => {
  saveInstructorSettings({ autoRefresh });
};

/**
 * 選択中学生の設定
 */
export const updateSelectedStudent = (studentEmail?: string): void => {
  saveInstructorSettings({ selectedStudent: studentEmail });
};

/**
 * 設定のリセット（開発・デバッグ用）
 */
export const resetInstructorSettings = (): void => {
  const instructorId = getInstructorId();
  const storageKey = `settings_${instructorId}`;
  localStorage.removeItem(storageKey);
  console.log('講師設定をリセットしました');
};

/**
 * 全講師のローカル設定を表示（デバッグ用）
 */
export const debugShowAllSettings = (): void => {
  console.log('=== 講師設定デバッグ情報 ===');
  console.log('現在の講師ID:', getInstructorId());
  console.log('現在の設定:', getInstructorSettings());

  // ローカルストレージの全キーを確認
  const allKeys = Object.keys(localStorage);
  const settingsKeys = allKeys.filter(key => key.startsWith('settings_'));

  console.log('保存済み設定キー:', settingsKeys);
  settingsKeys.forEach(key => {
    try {
      const settings = JSON.parse(localStorage.getItem(key) || '{}');
      console.log(`${key}:`, settings);
    } catch (e) {
      console.warn(`${key} の解析に失敗:`, e);
    }
  });
};
