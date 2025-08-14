import { useState, useCallback } from 'react';
import { classroomAPI } from '../../services/classroomAPI';
import { getInstructorId } from '../../utils/instructorStorage';

interface UseMapUploadProps {
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
  onDataReload: () => Promise<void>;
}

export const useMapUpload = ({
  onSuccess,
  onError,
  onDataReload
}: UseMapUploadProps) => {
  const [uploadProgress, setUploadProgress] = useState(false);

  // ドラッグ&ドロップ処理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));

    if (imageFile) {
      handleImageUpload(imageFile);
    }
  }, []); // handleImageUploadは意図的に除外

  // ファイルアップロード処理
  const handleImageUpload = useCallback(async (file: File) => {
    // ファイル検証
    const validation = classroomAPI.validateUploadFile(file);
    if (!validation.valid) {
      onError(validation.error || 'ファイルが無効です');
      return;
    }

    try {
      setUploadProgress(true);

      const instructorId = getInstructorId();
      const result = await classroomAPI.uploadMapImage(file, instructorId);

      if (result.success) {
        onSuccess('MAPが正常にアップロードされました');
        await onDataReload();
      } else {
        onError(result.message || 'アップロードに失敗しました');
      }
    } catch (err) {
      if (err instanceof Error) {
        // ネットワークエラーの詳細分類
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          onError('ネットワーク接続エラー。インターネット接続を確認してください。');
        } else if (err.message.includes('413')) {
          onError('ファイルサイズが大きすぎます。10MB以下の画像を選択してください。');
        } else if (err.message.includes('415')) {
          onError('サポートされていないファイル形式です。JPG、PNG、GIF形式を使用してください。');
        } else if (err.message.includes('403')) {
          onError('アップロード権限がありません。管理者にお問い合わせください。');
        } else if (err.message.includes('500')) {
          onError('サーバーエラーが発生しました。しばらく時間をおいて再試行してください。');
        } else {
          onError(`アップロードエラー: ${err.message}`);
        }
      } else {
        onError('不明なエラーが発生しました');
      }
    } finally {
      setUploadProgress(false);
    }
  }, [onSuccess, onError, onDataReload]);

  // ファイル入力処理
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  }, [handleImageUpload]);

  // アップロード可能ファイル形式の検証
  const validateFileType = useCallback((file: File): boolean => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    return allowedTypes.includes(file.type);
  }, []);

  // ファイルサイズの検証
  const validateFileSize = useCallback((file: File, maxSizeMB: number = 10): boolean => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024; // MB to bytes
    return file.size <= maxSizeBytes;
  }, []);

  // プレビュー画像の生成
  const generatePreview = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  // 複数ファイルのバッチアップロード
  const handleMultipleFileUpload = useCallback(async (files: FileList) => {
    const validFiles = Array.from(files).filter(file => {
      if (!validateFileType(file)) {
        onError(`${file.name}: サポートされていないファイル形式です`);
        return false;
      }
      if (!validateFileSize(file)) {
        onError(`${file.name}: ファイルサイズが大きすぎます (最大10MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      onError('有効なファイルがありません');
      return;
    }

    // 最初のファイルのみアップロード（複数MAP対応は将来拡張）
    if (validFiles.length > 1) {
      onError('一度に1つのMAPファイルのみアップロード可能です');
      return;
    }

    await handleImageUpload(validFiles[0]);
  }, [validateFileType, validateFileSize, handleImageUpload, onError]);

  return {
    uploadProgress,
    handleDragOver,
    handleDrop,
    handleImageUpload,
    handleFileInput,
    handleMultipleFileUpload,
    validateFileType,
    validateFileSize,
    generatePreview
  };
};

export default useMapUpload;
