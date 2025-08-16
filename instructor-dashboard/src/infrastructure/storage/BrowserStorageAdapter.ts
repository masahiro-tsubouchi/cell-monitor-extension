/**
 * Browser Storage Adapter
 * ローカルストレージとセッションストレージの抽象化
 */

export interface StorageAdapter {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;
  has(key: string): boolean;
  getAllKeys(): string[];
}

export class LocalStorageAdapter implements StorageAdapter {
  private readonly prefix: string;

  constructor(prefix: string = 'instructor-dashboard') {
    this.prefix = prefix;
  }

  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.getKey(key));
      if (item === null) return null;
      
      const parsed = JSON.parse(item);
      
      // TTL チェック
      if (parsed.expires && Date.now() > parsed.expires) {
        this.remove(key);
        return null;
      }
      
      return parsed.value;
    } catch (error) {
      console.warn(`Failed to get item from localStorage: ${key}`, error);
      return null;
    }
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    try {
      const item = {
        value,
        expires: ttlMs ? Date.now() + ttlMs : null,
        timestamp: Date.now()
      };
      
      localStorage.setItem(this.getKey(key), JSON.stringify(item));
    } catch (error) {
      console.warn(`Failed to set item in localStorage: ${key}`, error);
      // ストレージ容量不足の場合、古いアイテムを削除して再試行
      if (error instanceof DOMException && error.code === 22) {
        this.cleanupExpiredItems();
        try {
          const item = {
            value,
            expires: ttlMs ? Date.now() + ttlMs : null,
            timestamp: Date.now()
          };
          localStorage.setItem(this.getKey(key), JSON.stringify(item));
        } catch (retryError) {
          console.error(`Failed to set item after cleanup: ${key}`, retryError);
        }
      }
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.getKey(key));
    } catch (error) {
      console.warn(`Failed to remove item from localStorage: ${key}`, error);
    }
  }

  clear(): void {
    try {
      const keys = this.getAllKeys();
      keys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear localStorage', error);
    }
  }

  has(key: string): boolean {
    return localStorage.getItem(this.getKey(key)) !== null;
  }

  getAllKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix + ':')) {
        keys.push(key);
      }
    }
    return keys;
  }

  // ユーティリティメソッド
  getSize(): number {
    return this.getAllKeys().length;
  }

  getStorageUsage(): { used: number; total: number } {
    let used = 0;
    this.getAllKeys().forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        used += item.length;
      }
    });
    
    // 概算の総容量（5MB）
    const total = 5 * 1024 * 1024;
    return { used, total };
  }

  cleanupExpiredItems(): void {
    const keys = this.getAllKeys();
    let cleanedCount = 0;
    
    keys.forEach(fullKey => {
      try {
        const item = localStorage.getItem(fullKey);
        if (item) {
          const parsed = JSON.parse(item);
          if (parsed.expires && Date.now() > parsed.expires) {
            localStorage.removeItem(fullKey);
            cleanedCount++;
          }
        }
      } catch (error) {
        // 壊れたアイテムも削除
        localStorage.removeItem(fullKey);
        cleanedCount++;
      }
    });
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired items from localStorage`);
    }
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }
}

export class SessionStorageAdapter implements StorageAdapter {
  private readonly prefix: string;

  constructor(prefix: string = 'instructor-dashboard-session') {
    this.prefix = prefix;
  }

  get<T>(key: string): T | null {
    try {
      const item = sessionStorage.getItem(this.getKey(key));
      if (item === null) return null;
      
      const parsed = JSON.parse(item);
      return parsed.value;
    } catch (error) {
      console.warn(`Failed to get item from sessionStorage: ${key}`, error);
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      const item = {
        value,
        timestamp: Date.now()
      };
      
      sessionStorage.setItem(this.getKey(key), JSON.stringify(item));
    } catch (error) {
      console.warn(`Failed to set item in sessionStorage: ${key}`, error);
    }
  }

  remove(key: string): void {
    try {
      sessionStorage.removeItem(this.getKey(key));
    } catch (error) {
      console.warn(`Failed to remove item from sessionStorage: ${key}`, error);
    }
  }

  clear(): void {
    try {
      const keys = this.getAllKeys();
      keys.forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear sessionStorage', error);
    }
  }

  has(key: string): boolean {
    return sessionStorage.getItem(this.getKey(key)) !== null;
  }

  getAllKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(this.prefix + ':')) {
        keys.push(key);
      }
    }
    return keys;
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }
}

/**
 * Memory Storage Adapter (for testing or fallback)
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private storage: Map<string, any> = new Map();

  get<T>(key: string): T | null {
    return this.storage.get(key) || null;
  }

  set<T>(key: string, value: T): void {
    this.storage.set(key, value);
  }

  remove(key: string): void {
    this.storage.delete(key);
  }

  clear(): void {
    this.storage.clear();
  }

  has(key: string): boolean {
    return this.storage.has(key);
  }

  getAllKeys(): string[] {
    return Array.from(this.storage.keys());
  }
}

/**
 * Storage Factory
 */
export const createStorageAdapter = (
  type: 'localStorage' | 'sessionStorage' | 'memory' = 'localStorage',
  prefix?: string
): StorageAdapter => {
  switch (type) {
    case 'localStorage':
      return new LocalStorageAdapter(prefix);
    case 'sessionStorage':
      return new SessionStorageAdapter(prefix);
    case 'memory':
      return new MemoryStorageAdapter();
    default:
      return new LocalStorageAdapter(prefix);
  }
};