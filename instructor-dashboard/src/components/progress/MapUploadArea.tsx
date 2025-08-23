import React, { useRef } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box
} from '@mui/material';
import {
  Add as AddIcon,
  CloudUpload as UploadIcon
} from '@mui/icons-material';
import useMapUpload from '../../hooks/map/useMapUpload';

interface MapUploadAreaProps {
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
  onDataReload: () => Promise<void>;
}

export const MapUploadArea: React.FC<MapUploadAreaProps> = ({
  onSuccess,
  onError,
  onDataReload
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useMapUpload({
    onSuccess,
    onError,
    onDataReload
  });

  return (
    <Card
      sx={{
        mb: 3,
        border: '2px dashed #ccc',
        backgroundColor: '#fafafa',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: '#1976d2',
          backgroundColor: '#f0f7ff'
        }
      }}
      onDragOver={upload.handleDragOver}
      onDrop={upload.handleDrop}
    >
      <CardContent sx={{ textAlign: 'center', py: 4 }}>
        <Box sx={{ mb: 2 }}>
          <UploadIcon sx={{
            fontSize: 48,
            color: '#ccc',
            mb: 1,
            transition: 'color 0.2s ease'
          }} />
          <Typography variant="h6" color="text.secondary">
            📍 チームMAPを追加
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
            画像をドラッグ&ドロップするか、ボタンをクリックして教室のレイアウト画像をアップロード
          </Typography>

          {/* サポートファイル形式の表示 */}
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            対応形式: JPG, PNG, GIF, WebP (最大10MB)
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={upload.uploadProgress}
            sx={{
              minWidth: '160px',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: 2
              }
            }}
          >
            {upload.uploadProgress ? 'アップロード中...' : 'MAP画像を選択'}
          </Button>

        </Box>

        {/* 使用方法のヒント */}
        <Box sx={{ mt: 3, p: 2, backgroundColor: 'rgba(25, 118, 210, 0.05)', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            💡 ヒント: 教室の座席配置図やフロアプランを使用すると、チームの配置を視覚的に管理できます
          </Typography>
        </Box>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={upload.handleFileInput}
        />
      </CardContent>
    </Card>
  );
};

export default MapUploadArea;
