import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { LayoutTemplate } from '../../types/api';

// TDD開発ルール: LayoutTemplates（レイアウトテンプレート管理）Green フェーズ
// 目的: テストを通すための最小限の実装を作成する

export interface LayoutTemplatesProps {
  templates: LayoutTemplate[];
  selectedTemplate?: LayoutTemplate | null;
  isLoading?: boolean;
  error?: string;
  onTemplateSelect: (template: LayoutTemplate) => void;
  onTemplateCreate: (data: { name: string; description: string }) => void;
  onTemplateUpdate: (templateId: string, data: { name: string; description: string }) => void;
  onTemplateDelete: (templateId: string) => void;
  onTemplatePreview: (template: LayoutTemplate) => void;
}

export const LayoutTemplates: React.FC<LayoutTemplatesProps> = ({
  templates,
  selectedTemplate,
  isLoading = false,
  error,
  onTemplateSelect,
  onTemplateCreate,
  onTemplateUpdate,
  onTemplateDelete,
  onTemplatePreview,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState<LayoutTemplate | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<LayoutTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
  });

  // テンプレート検索フィルタリング
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;

    return templates.filter(template =>
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [templates, searchQuery]);

  // 新規作成ハンドラ
  const handleCreateTemplate = useCallback(() => {
    if (!newTemplate.name.trim() || !newTemplate.description.trim()) {
      return;
    }

    onTemplateCreate({
      name: newTemplate.name,
      description: newTemplate.description,
    });

    setCreateDialog(false);
    setNewTemplate({ name: '', description: '' });
  }, [newTemplate, onTemplateCreate]);

  // 編集ハンドラ
  const handleUpdateTemplate = useCallback(() => {
    if (!editDialog || !newTemplate.name.trim() || !newTemplate.description.trim()) {
      return;
    }

    onTemplateUpdate(editDialog.id, {
      name: newTemplate.name,
      description: newTemplate.description,
    });

    setEditDialog(null);
    setNewTemplate({ name: '', description: '' });
  }, [editDialog, newTemplate, onTemplateUpdate]);

  // 削除ハンドラ
  const handleDeleteTemplate = useCallback(() => {
    if (!deleteDialog) return;

    onTemplateDelete(deleteDialog.id);
    setDeleteDialog(null);
  }, [deleteDialog, onTemplateDelete]);

  // 編集ダイアログを開く
  const openEditDialog = useCallback((template: LayoutTemplate) => {
    setEditDialog(template);
    setNewTemplate({
      name: template.name,
      description: template.description,
    });
  }, []);

  // キーボードナビゲーション
  const handleCardKeyDown = useCallback((e: React.KeyboardEvent, template: LayoutTemplate) => {
    if (e.key === 'Enter') {
      onTemplateSelect(template);
    } else if (e.key === ' ') {
      e.preventDefault();
      onTemplatePreview(template);
    }
  }, [onTemplateSelect, onTemplatePreview]);

  // ローディング状態
  if (isLoading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" p={4}>
        <CircularProgress role="progressbar" />
        <Typography variant="body2" color="text.secondary" mt={2}>
          テンプレートを読み込み中...
        </Typography>
      </Box>
    );
  }

  // エラー状態
  if (error) {
    return (
      <Alert severity="error" role="alert">
        {error}
      </Alert>
    );
  }

  return (
    <Box role="region" aria-label="レイアウトテンプレート">
      {/* ヘッダー */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          レイアウトテンプレート
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialog(true)}
        >
          新規作成
        </Button>
      </Box>

      {/* 検索バー */}
      <TextField
        fullWidth
        variant="outlined"
        placeholder="テンプレートを検索..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
        inputProps={{
          'aria-label': 'テンプレート検索',
        }}
        sx={{ mb: 3 }}
      />

      {/* テンプレート一覧 */}
      {templates.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            テンプレートがありません
          </Typography>
          <Typography variant="body2" color="text.secondary">
            新しいテンプレートを作成してください
          </Typography>
        </Box>
      ) : filteredTemplates.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary">
            該当するテンプレートが見つかりません
          </Typography>
        </Box>
      ) : (
        <Box display="flex" flexWrap="wrap" gap={3}>
          {filteredTemplates.map((template) => (
            <Box key={template.id} sx={{ width: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(33.333% - 16px)' } }}>
              <Card
                role="article"
                aria-label={`テンプレート: ${template.name}`}
                data-testid={`template-card-${template.id}`}
                className={selectedTemplate?.id === template.id ? 'selected' : ''}
                tabIndex={0}
                onKeyDown={(e) => handleCardKeyDown(e, template)}
                sx={{
                  cursor: 'pointer',
                  border: selectedTemplate?.id === template.id ? 2 : 1,
                  borderColor: selectedTemplate?.id === template.id ? 'primary.main' : 'divider',
                  '&:hover': {
                    boxShadow: 2,
                  },
                  '&.selected': {
                    borderColor: 'primary.main',
                    backgroundColor: 'primary.50',
                  },
                }}
              >
                {/* プレビュー画像 */}
                {template.previewImage && (
                  <CardMedia
                    component="img"
                    height="140"
                    image={template.previewImage}
                    alt={`${template.name} プレビュー`}
                  />
                )}

                <CardContent>
                  <Typography variant="h6" component="h3" gutterBottom>
                    {template.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {template.description}
                  </Typography>

                  {/* 座席数表示 */}
                  <Chip
                    label={`${template.seats.length}席`}
                    size="small"
                    variant="outlined"
                    sx={{ mt: 1 }}
                  />

                  {/* アクションボタン */}
                  <Box display="flex" justifyContent="space-between" mt={2}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => onTemplateSelect(template)}
                    >
                      選択
                    </Button>
                    <Box>
                      <IconButton
                        size="small"
                        onClick={() => onTemplatePreview(template)}
                        aria-label="プレビュー"
                      >
                        <VisibilityIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => openEditDialog(template)}
                        aria-label="編集"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => setDeleteDialog(template)}
                        aria-label="削除"
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          ))}
        </Box>
      )}

      {/* 新規作成ダイアログ */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>新しいテンプレートを作成</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="テンプレート名"
            value={newTemplate.name}
            onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
            margin="normal"
            inputProps={{ 'aria-label': 'テンプレート名' }}
          />
          <TextField
            fullWidth
            label="説明"
            value={newTemplate.description}
            onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
            margin="normal"
            multiline
            rows={3}
            inputProps={{ 'aria-label': '説明' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateTemplate}
            disabled={!newTemplate.name.trim() || !newTemplate.description.trim()}
          >
            作成
          </Button>
        </DialogActions>
      </Dialog>

      {/* 編集ダイアログ */}
      <Dialog open={!!editDialog} onClose={() => setEditDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>テンプレートを編集</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="テンプレート名"
            value={newTemplate.name}
            onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
            margin="normal"
          />
          <TextField
            fullWidth
            label="説明"
            value={newTemplate.description}
            onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
            margin="normal"
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(null)}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateTemplate}
            disabled={!newTemplate.name.trim() || !newTemplate.description.trim()}
          >
            更新
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)}>
        <DialogTitle>テンプレートを削除しますか？</DialogTitle>
        <DialogContent>
          <Typography>
            この操作は取り消せません。
          </Typography>
          {deleteDialog && (
            <Typography variant="body2" color="text.secondary" mt={1}>
              削除するテンプレート: {deleteDialog.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteTemplate}
          >
            削除する
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
