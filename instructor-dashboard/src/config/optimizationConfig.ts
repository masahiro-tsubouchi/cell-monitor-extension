/**
 * 最適化フィーチャーフラグシステム
 * ユーザー設定による段階的最適化制御
 */

import { useState, useEffect } from 'react';

export interface OptimizationConfig {
  useVirtualizedList: boolean;
  useOptimizedCards: boolean;
  useLazyLoading: boolean;
  usePerformanceMonitoring: boolean;
  useTeamBasedGrid: boolean; // 新機能: チームベースグリッド
}

export const DEFAULT_OPTIMIZATION: OptimizationConfig = {
  useVirtualizedList: true,
  useOptimizedCards: true,
  useLazyLoading: true,
  usePerformanceMonitoring: process.env.NODE_ENV === 'development',
  useTeamBasedGrid: true // デフォルトでチームベースグリッド有効
};

// ローカルストレージキー
const OPTIMIZATION_STORAGE_KEY = 'dashboard-optimization-settings';

// 最適化設定の保存
export const saveOptimizationSettings = (config: Partial<OptimizationConfig>): void => {
  try {
    const currentSettings = getOptimizationSettings();
    const updatedSettings = { ...currentSettings, ...config };
    localStorage.setItem(OPTIMIZATION_STORAGE_KEY, JSON.stringify(updatedSettings));
  } catch (error) {
    console.warn('Failed to save optimization settings:', error);
  }
};

// 最適化設定の取得
export const getOptimizationSettings = (): Partial<OptimizationConfig> => {
  try {
    const stored = localStorage.getItem(OPTIMIZATION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load optimization settings:', error);
    return {};
  }
};

// 最適化設定のリセット
export const resetOptimizationSettings = (): void => {
  try {
    localStorage.removeItem(OPTIMIZATION_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to reset optimization settings:', error);
  }
};

// ユーザー設定による段階的最適化制御フック
export const useOptimizationSettings = (): {
  config: OptimizationConfig;
  updateConfig: (updates: Partial<OptimizationConfig>) => void;
  resetConfig: () => void;
} => {
  const [config, setConfig] = useState<OptimizationConfig>(DEFAULT_OPTIMIZATION);
  
  // ローカルストレージからの設定復元
  useEffect(() => {
    const savedConfig = getOptimizationSettings();
    if (Object.keys(savedConfig).length > 0) {
      setConfig({ ...DEFAULT_OPTIMIZATION, ...savedConfig });
    }
  }, []);

  // 設定更新関数
  const updateConfig = (updates: Partial<OptimizationConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    saveOptimizationSettings(updates);
  };

  // 設定リセット関数
  const resetConfig = () => {
    setConfig(DEFAULT_OPTIMIZATION);
    resetOptimizationSettings();
  };

  return { config, updateConfig, resetConfig };
};

// 最適化レベルのプリセット
export const OPTIMIZATION_PRESETS = {
  minimal: {
    useVirtualizedList: false,
    useOptimizedCards: false,
    useLazyLoading: false,
    usePerformanceMonitoring: false,
    useTeamBasedGrid: false
  } as OptimizationConfig,
  
  balanced: {
    useVirtualizedList: true,
    useOptimizedCards: true,
    useLazyLoading: true,
    usePerformanceMonitoring: false,
    useTeamBasedGrid: true
  } as OptimizationConfig,
  
  maximum: {
    useVirtualizedList: true,
    useOptimizedCards: true,
    useLazyLoading: true,
    usePerformanceMonitoring: true,
    useTeamBasedGrid: true
  } as OptimizationConfig
};

// 最適化設定の説明
export const OPTIMIZATION_DESCRIPTIONS = {
  useVirtualizedList: '仮想スクロールによる大量データ表示の最適化',
  useOptimizedCards: 'React.memoによるカードコンポーネントの最適化',
  useLazyLoading: 'コンポーネントの遅延読み込みによる初期ロード最適化',
  usePerformanceMonitoring: 'Core Web Vitalsとパフォーマンス統計の監視',
  useTeamBasedGrid: 'チーム単位でのグリッド表示（個人表示から変更）'
};