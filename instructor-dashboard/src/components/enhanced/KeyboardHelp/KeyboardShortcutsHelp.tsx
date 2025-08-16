/**
 * Keyboard Shortcuts Help Component
 * Phase 1.3: キーボードナビゲーション
 * 
 * 機能:
 * - 利用可能なキーボードショートカットを表示
 * - ヘルプモーダルの提供
 */

import React, { memo, useState } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Chip,
  Fab,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  Keyboard as KeyboardIcon,
  Help as HelpIcon
} from '@mui/icons-material';

interface ShortcutInfo {
  key: string;
  description: string;
  category: 'emergency' | 'navigation' | 'general';
}

const shortcuts: ShortcutInfo[] = [
  {
    key: 'H',
    description: 'ヘルプ要請学生にフォーカス',
    category: 'emergency'
  },
  {
    key: 'R',
    description: 'データリフレッシュ',
    category: 'general'
  },
  {
    key: 'F',
    description: 'フィルター開く',
    category: 'navigation'
  },
  {
    key: '1',
    description: '緊急度順ソート',
    category: 'navigation'
  },
  {
    key: 'ESC',
    description: 'モーダル・フィルタークリア',
    category: 'general'
  }
];

const categoryColors = {
  emergency: '#ff5722',
  navigation: '#2196f3',
  general: '#4caf50'
};

const categoryLabels = {
  emergency: '🆘 緊急対応',
  navigation: '🧭 ナビゲーション',
  general: '⚙️ 一般操作'
};

interface KeyboardShortcutsHelpProps {
  helpStudentsCount?: number;
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = memo(({
  helpStudentsCount = 0
}) => {
  const [open, setOpen] = useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const groupedShortcuts = shortcuts.reduce((groups, shortcut) => {
    const category = shortcut.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(shortcut);
    return groups;
  }, {} as Record<string, ShortcutInfo[]>);

  return (
    <>
      {/* ヘルプボタン */}
      <Tooltip title="キーボードショートカット (?)">
        <Fab
          size="small"
          onClick={handleOpen}
          sx={{
            position: 'fixed',
            bottom: 90,
            right: 24,
            backgroundColor: '#2196f3',
            color: 'white',
            '&:hover': {
              backgroundColor: '#1976d2'
            }
          }}
        >
          <KeyboardIcon />
        </Fab>
      </Tooltip>

      {/* ヘルプ要請がある場合の緊急表示 */}
      {helpStudentsCount > 0 && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 150,
            right: 24,
            backgroundColor: '#ff5722',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 'bold',
            animation: 'pulse 1s ease-in-out infinite',
            cursor: 'pointer',
            zIndex: 1000,
            '@keyframes pulse': {
              '0%': { 
                boxShadow: '0 0 0 0 rgba(255, 87, 34, 0.7)'
              },
              '50%': { 
                boxShadow: '0 0 0 10px rgba(255, 87, 34, 0)'
              },
              '100%': { 
                boxShadow: '0 0 0 0 rgba(255, 87, 34, 0.7)'
              }
            }
          }}
          onClick={handleOpen}
        >
          H キーで即座に対応!
        </Box>
      )}

      {/* ショートカットヘルプダイアログ */}
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 1
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <KeyboardIcon sx={{ color: '#2196f3' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              キーボードショートカット
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            緊急時の迅速な対応のため、以下のキーボードショートカットをご利用ください。
          </Typography>

          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <Box key={category} sx={{ mb: 3 }}>
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  mb: 2, 
                  fontWeight: 'bold',
                  color: categoryColors[category as keyof typeof categoryColors]
                }}
              >
                {categoryLabels[category as keyof typeof categoryLabels]}
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
                {categoryShortcuts.map((shortcut) => (
                  <Box
                    key={shortcut.key}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      p: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      backgroundColor: category === 'emergency' ? 
                        'rgba(255, 87, 34, 0.05)' : 'background.paper'
                    }}
                  >
                    <Chip
                      label={shortcut.key}
                      size="small"
                      sx={{
                        backgroundColor: categoryColors[category as keyof typeof categoryColors],
                        color: 'white',
                        fontWeight: 'bold',
                        minWidth: 40,
                        fontFamily: 'monospace'
                      }}
                    />
                    <Typography variant="body2">
                      {shortcut.description}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}

          <Box sx={{ 
            mt: 3, 
            p: 2, 
            backgroundColor: 'rgba(33, 150, 243, 0.05)',
            borderRadius: 2,
            border: '1px solid rgba(33, 150, 243, 0.2)'
          }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
              💡 使い方のコツ
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • 入力フィールド以外の場所で直接キーを押すだけで動作します<br/>
              • 緊急時は <strong>H</strong> キーでヘルプ要請学生に即座に移動できます<br/>
              • <strong>ESC</strong> キーで開いているモーダルやフィルターをクリアできます
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
});

KeyboardShortcutsHelp.displayName = 'KeyboardShortcutsHelp';

export default KeyboardShortcutsHelp;