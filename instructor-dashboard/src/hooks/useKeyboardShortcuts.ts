/**
 * Keyboard Shortcuts Hook
 * Phase 1.3: キーボードナビゲーション
 * 
 * 機能:
 * - 1文字キーで瞬時に重要操作を実行
 * - 緊急時ワークフローを最適化
 * - アクセシビリティ向上
 */

import { useEffect, useCallback } from 'react';
import { StudentActivity } from '../services/dashboardAPI';

interface KeyboardShortcutsConfig {
  students: StudentActivity[];
  onHelpFocus?: (student: StudentActivity) => void;
  onRefresh?: () => void;
  onToggleFilter?: () => void;
  onSortByPriority?: () => void;
  onEscape?: () => void;
}

interface KeyboardShortcut {
  key: string;
  description: string;
  handler: () => void;
  requiresAlt?: boolean;
  requiresCtrl?: boolean;
}

export const useKeyboardShortcuts = ({
  students,
  onHelpFocus,
  onRefresh,
  onToggleFilter,
  onSortByPriority,
  onEscape
}: KeyboardShortcutsConfig) => {

  const handleHelpFocus = useCallback(() => {
    const helpStudents = students.filter(s => s.status === 'help');
    if (helpStudents.length > 0 && onHelpFocus) {
      onHelpFocus(helpStudents[0]);
      // 音声フィードバック
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 1000; // 1000Hz - 高めの音
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      } catch (error) {
        console.warn('Audio feedback failed:', error);
      }
    }
  }, [students, onHelpFocus]);

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'h',
      description: 'ヘルプ要請学生にフォーカス',
      handler: handleHelpFocus
    },
    {
      key: 'r',
      description: 'データリフレッシュ',
      handler: onRefresh || (() => {})
    },
    {
      key: 'f',
      description: 'フィルター開く',
      handler: onToggleFilter || (() => {})
    },
    {
      key: '1',
      description: '緊急度順ソート',
      handler: onSortByPriority || (() => {})
    },
    {
      key: 'Escape',
      description: 'モーダル・フィルタークリア',
      handler: onEscape || (() => {})
    }
  ];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 入力フィールドがフォーカスされている場合はスキップ
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
         activeElement.tagName === 'TEXTAREA' ||
         (activeElement as HTMLElement).contentEditable === 'true')
      ) {
        return;
      }

      // モディファイアキーの状態をチェック
      const isAltPressed = event.altKey;
      const isCtrlPressed = event.ctrlKey || event.metaKey;

      // 対応するショートカットを検索
      const shortcut = shortcuts.find(s => {
        const keyMatch = s.key.toLowerCase() === event.key.toLowerCase();
        const altMatch = (s.requiresAlt || false) === isAltPressed;
        const ctrlMatch = (s.requiresCtrl || false) === isCtrlPressed;
        
        return keyMatch && altMatch && ctrlMatch;
      });

      if (shortcut) {
        event.preventDefault();
        event.stopPropagation();
        shortcut.handler();
        
        // 視覚的フィードバック（一時的な通知）
        showKeyboardFeedback(shortcut.description);
      }
    };

    const showKeyboardFeedback = (description: string) => {
      // 既存のフィードバック要素があれば削除
      const existingFeedback = document.getElementById('keyboard-feedback');
      if (existingFeedback) {
        existingFeedback.remove();
      }

      // フィードバック要素を作成
      const feedback = document.createElement('div');
      feedback.id = 'keyboard-feedback';
      feedback.textContent = `⌨️ ${description}`;
      feedback.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #2196f3;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
        z-index: 9999;
        animation: slideIn 0.3s ease-out, fadeOut 0.3s ease-out 1.7s;
      `;

      // アニメーションCSSを追加
      if (!document.getElementById('keyboard-feedback-styles')) {
        const styles = document.createElement('style');
        styles.id = 'keyboard-feedback-styles';
        styles.textContent = `
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
          }
        `;
        document.head.appendChild(styles);
      }

      document.body.appendChild(feedback);

      // 2秒後に自動削除
      setTimeout(() => {
        if (feedback.parentNode) {
          feedback.parentNode.removeChild(feedback);
        }
      }, 2000);
    };

    // イベントリスナーを追加
    document.addEventListener('keydown', handleKeyDown);

    // クリーンアップ
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      
      // フィードバック要素をクリーンアップ
      const feedback = document.getElementById('keyboard-feedback');
      if (feedback) {
        feedback.remove();
      }
    };
  }, [shortcuts]);

  return {
    shortcuts: shortcuts.map(s => ({
      key: s.key,
      description: s.description,
      requiresAlt: s.requiresAlt,
      requiresCtrl: s.requiresCtrl
    }))
  };
};

export default useKeyboardShortcuts;