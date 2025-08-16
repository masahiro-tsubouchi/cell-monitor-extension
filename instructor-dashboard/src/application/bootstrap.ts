/**
 * Application Bootstrap
 * Phase 1: Clean Architecture の初期化とセットアップ
 */

import { initializeGlobalContainer, validateContainer } from './di/containerConfig';
import { DashboardConfig } from './di/tokens';

/**
 * Phase 1 Clean Architecture の初期化
 */
export async function bootstrapCleanArchitecture(config?: Partial<DashboardConfig>): Promise<{
  success: boolean;
  container?: any;
  errors: string[];
}> {
  try {
    console.log('🚀 Initializing Clean Architecture Phase 1...');
    
    // 1. DI Container の初期化
    const container = initializeGlobalContainer(config);
    
    // 2. Container の検証
    const validation = validateContainer(container);
    
    if (!validation.isValid) {
      console.error('❌ Container validation failed:', validation);
      return {
        success: false,
        errors: [
          ...validation.missingDependencies.map(dep => `Missing dependency: ${dep}`),
          ...validation.errors
        ]
      };
    }
    
    // 3. 基本的なサービスの初期化確認
    try {
      const dashboardService = container.get({ name: 'DashboardService' });
      const dataStore = container.get({ name: 'DashboardDataStore' });
      const uiStore = container.get({ name: 'DashboardUIStore' });
      
      console.log('✅ Core services initialized successfully');
      console.log('📊 Dashboard Service:', !!dashboardService);
      console.log('💾 Data Store:', !!dataStore);
      console.log('🎨 UI Store:', !!uiStore);
    } catch (error) {
      console.error('❌ Failed to initialize core services:', error);
      return {
        success: false,
        errors: [`Service initialization failed: ${(error as Error).message}`]
      };
    }
    
    // 4. 成功ログ
    console.log('🎉 Clean Architecture Phase 1 initialized successfully!');
    console.log('📦 Registered dependencies:', container.getRegisteredTokens());
    
    return {
      success: true,
      container,
      errors: []
    };
    
  } catch (error) {
    console.error('💥 Bootstrap failed:', error);
    return {
      success: false,
      errors: [`Bootstrap failed: ${(error as Error).message}`]
    };
  }
}

/**
 * 開発モード用の初期化
 */
export async function bootstrapDevelopment(): Promise<ReturnType<typeof bootstrapCleanArchitecture>> {
  console.log('🔧 Initializing in Development Mode...');
  
  return bootstrapCleanArchitecture({
    features: {
      enableMockData: true,
      enableWebSocket: true,
      enableAnalytics: false
    },
    storage: {
      enablePersistence: true,
      cacheMaxAge: 30000 // 30秒（開発用に短く）
    },
    ui: {
      refreshInterval: 10000, // 10秒
      enableNotifications: true,
      theme: 'light'
    }
  });
}

/**
 * 本番モード用の初期化
 */
export async function bootstrapProduction(): Promise<ReturnType<typeof bootstrapCleanArchitecture>> {
  console.log('🏭 Initializing in Production Mode...');
  
  return bootstrapCleanArchitecture({
    features: {
      enableMockData: false,
      enableWebSocket: true,
      enableAnalytics: true
    },
    storage: {
      enablePersistence: true,
      cacheMaxAge: 5 * 60 * 1000 // 5分
    },
    ui: {
      refreshInterval: 15000, // 15秒
      enableNotifications: true,
      theme: 'light'
    }
  });
}

/**
 * テスト用の初期化
 */
export async function bootstrapTest(): Promise<ReturnType<typeof bootstrapCleanArchitecture>> {
  console.log('🧪 Initializing in Test Mode...');
  
  return bootstrapCleanArchitecture({
    features: {
      enableMockData: true,
      enableWebSocket: false,
      enableAnalytics: false
    },
    storage: {
      enablePersistence: false,
      cacheMaxAge: 1000 // 1秒
    },
    ui: {
      refreshInterval: 1000, // 1秒
      enableNotifications: false,
      theme: 'light'
    }
  });
}

/**
 * 環境に応じた自動初期化
 */
export async function autoBootstrap(): Promise<ReturnType<typeof bootstrapCleanArchitecture>> {
  const nodeEnv = process.env.NODE_ENV;
  const isTest = process.env.JEST_WORKER_ID !== undefined;
  
  if (isTest) {
    return bootstrapTest();
  } else if (nodeEnv === 'production') {
    return bootstrapProduction();
  } else {
    return bootstrapDevelopment();
  }
}

/**
 * 段階的移行のためのフィーチャーフラグ
 */
export interface MigrationFlags {
  useNewArchitecture: boolean;
  useNewHooks: boolean;
  useNewServices: boolean;
  enableDualMode: boolean; // 新旧両方のアーキテクチャを並行実行
}

const DEFAULT_MIGRATION_FLAGS: MigrationFlags = {
  useNewArchitecture: true,
  useNewHooks: false, // まだ既存hookを使用
  useNewServices: true,
  enableDualMode: true // Phase1では並行実行
};

/**
 * 段階的移行の設定
 */
export function configureMigration(flags: Partial<MigrationFlags> = {}): MigrationFlags {
  const finalFlags = { ...DEFAULT_MIGRATION_FLAGS, ...flags };
  
  // グローバルに設定を保存（window objectに）
  if (typeof window !== 'undefined') {
    (window as any).__CLEAN_ARCHITECTURE_MIGRATION__ = finalFlags;
  }
  
  console.log('🔄 Migration flags configured:', finalFlags);
  return finalFlags;
}

/**
 * 移行フラグの取得
 */
export function getMigrationFlags(): MigrationFlags {
  if (typeof window !== 'undefined' && (window as any).__CLEAN_ARCHITECTURE_MIGRATION__) {
    return (window as any).__CLEAN_ARCHITECTURE_MIGRATION__;
  }
  return DEFAULT_MIGRATION_FLAGS;
}

/**
 * ヘルスチェック
 */
export function healthCheck(): {
  isHealthy: boolean;
  services: Record<string, boolean>;
  errors: string[];
} {
  const errors: string[] = [];
  const services: Record<string, boolean> = {};
  
  try {
    const container = require('./di/DIContainer').getGlobalContainer();
    
    // 重要なサービスのチェック
    const criticalServices = [
      'DashboardService',
      'DashboardDataStore',
      'DashboardUIStore',
      'StudentRepository',
      'DashboardRepository'
    ];
    
    criticalServices.forEach(serviceName => {
      try {
        const service = container.tryGet({ name: serviceName });
        services[serviceName] = !!service;
        if (!service) {
          errors.push(`Service not available: ${serviceName}`);
        }
      } catch (error) {
        services[serviceName] = false;
        errors.push(`Service error: ${serviceName} - ${(error as Error).message}`);
      }
    });
    
  } catch (error) {
    errors.push(`Container not available: ${(error as Error).message}`);
  }
  
  const isHealthy = errors.length === 0;
  
  if (isHealthy) {
    console.log('✅ Health check passed');
  } else {
    console.warn('⚠️ Health check failed:', errors);
  }
  
  return {
    isHealthy,
    services,
    errors
  };
}