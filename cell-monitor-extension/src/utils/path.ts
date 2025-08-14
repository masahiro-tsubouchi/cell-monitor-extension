/**
 * パス処理ユーティリティ
 */

/**
 * ユーティリティ関数: パスからファイル名を抽出する
 * 将来的な拡張のために用意されている関数
 * @param path ファイルパス
 * @returns ファイル名
 */
export function extractFilenameFromPath(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
}
