/**
 * 教室MAP管理API サービス
 */

import { API_BASE_URL } from './dashboardAPI';

export interface ClassroomMapInfo {
  id: number;
  image_filename: string;
  image_url: string;
  original_filename?: string;
  uploaded_at: string;
  uploaded_by?: string;
  is_active: boolean;
  file_size_bytes?: number;
  content_type?: string;
}

export interface TeamPosition {
  x: number;
  y: number;
}

export interface ClassroomMapWithPositions {
  map_info: ClassroomMapInfo | null;
  team_positions: { [teamName: string]: TeamPosition };
  is_visible: boolean;
}

export interface MapUploadResponse {
  success: boolean;
  message: string;
  map_id?: number;
  image_url?: string;
}

export interface TeamPositionBulkUpdate {
  positions: { [teamName: string]: TeamPosition };
  updated_by?: string;
}

class ClassroomAPIService {
  private baseUrl = `${API_BASE_URL}/classroom`;

  /**
   * アクティブな教室MAPと配置情報を取得
   */
  async getClassroomMap(): Promise<ClassroomMapWithPositions> {
    const response = await fetch(`${this.baseUrl}/map`);

    if (!response.ok) {
      throw new Error(`Failed to fetch classroom map: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 教室MAP画像をアップロード
   */
  async uploadMapImage(
    file: File,
    uploadedBy?: string
  ): Promise<MapUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    if (uploadedBy) {
      formData.append('uploaded_by', uploadedBy);
    }

    const response = await fetch(`${this.baseUrl}/map/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Upload failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * チーム配置情報を一括更新
   */
  async updateTeamPositions(
    mapId: number,
    positions: { [teamName: string]: TeamPosition },
    updatedBy?: string
  ): Promise<{ success: boolean; message: string; updated_teams: string[] }> {
    const updateData: TeamPositionBulkUpdate = {
      positions,
      updated_by: updatedBy
    };

    const response = await fetch(`${this.baseUrl}/map/${mapId}/positions`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Update failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 教室MAPを削除
   */
  async deleteClassroomMap(mapId: number): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/map/${mapId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Delete failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 全MAP一覧を取得（管理用）
   */
  async getAllMaps(limit: number = 10): Promise<ClassroomMapInfo[]> {
    const response = await fetch(`${this.baseUrl}/maps?limit=${limit}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch maps: ${response.status}`);
    }

    return response.json();
  }

  /**
   * MAP画像のURLを生成
   */
  getImageUrl(filename: string): string {
    return `${this.baseUrl}/map/image/${filename}`;
  }

  /**
   * ファイルサイズを人間が読める形式に変換
   */
  formatFileSize(bytes?: number): string {
    if (!bytes || bytes === 0) return '不明';

    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(2);

    return `${size} ${sizes[i]}`;
  }

  /**
   * 画像ファイルかどうかを判定
   */
  isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }

  /**
   * ファイルサイズ制限チェック（10MB）
   */
  isFileSizeValid(file: File): boolean {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    return file.size <= MAX_SIZE;
  }

  /**
   * アップロードファイル検証
   */
  validateUploadFile(file: File): { valid: boolean; error?: string } {
    if (!this.isImageFile(file)) {
      return {
        valid: false,
        error: '画像ファイルのみアップロード可能です。(JPEG, PNG, WebP)'
      };
    }

    if (!this.isFileSizeValid(file)) {
      return {
        valid: false,
        error: 'ファイルサイズが大きすぎます。最大10MBまでです。'
      };
    }

    return { valid: true };
  }
}

// シングルトンインスタンス
export const classroomAPI = new ClassroomAPIService();
export default classroomAPI;
