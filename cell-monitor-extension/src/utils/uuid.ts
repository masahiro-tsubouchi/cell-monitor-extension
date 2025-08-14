/**
 * UUID生成ユーティリティ
 * RFC 4122準拠のUUID v4を生成する
 */

/**
 * ユーティリティ関数: UUIDを生成する
 * @returns RFC 4122準拠のUUID v4文字列
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
