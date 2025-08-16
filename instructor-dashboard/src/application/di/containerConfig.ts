/**
 * DI Container Configuration
 * 全ての依存関係の登録と設定
 */

import { DIContainer } from './DIContainer';
import { TOKENS, DEFAULT_CONFIG, type DashboardConfig } from './tokens';

// Infrastructure
import { createStorageAdapter } from '../../infrastructure/storage/BrowserStorageAdapter';
import { 
  createLegacyStudentRepository,
  createLegacyDashboardRepository 
} from '../../infrastructure/api/LegacyRepositoryWrapper';

// Domain Use Cases
import { createFetchStudentsUseCase } from '../../domain/use-cases/student/FetchStudentsUseCase';
import { createSelectStudentUseCase } from '../../domain/use-cases/student/SelectStudentUseCase';
import { createRefreshDashboardUseCase } from '../../domain/use-cases/dashboard/RefreshDashboardUseCase';

// Application Services and Stores
import { createDashboardService } from '../services/DashboardService';
import { createDashboardDataStore } from '../stores/DashboardDataStore';
import { createDashboardUIStore } from '../stores/DashboardUIStore';

/**
 * Configure and build DI container
 */
export function configureDIContainer(config: Partial<DashboardConfig> = {}): DIContainer {
  const finalConfig: DashboardConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    api: { ...DEFAULT_CONFIG.api, ...config.api },
    storage: { ...DEFAULT_CONFIG.storage, ...config.storage },
    ui: { ...DEFAULT_CONFIG.ui, ...config.ui },
    features: { ...DEFAULT_CONFIG.features, ...config.features }
  };

  const container = new DIContainer();

  // Configuration
  container.registerInstance(TOKENS.CONFIG, finalConfig);
  container.registerInstance(TOKENS.API_BASE_URL, finalConfig.api.baseUrl);
  container.registerInstance(TOKENS.API_TIMEOUT, finalConfig.api.timeout);

  // Infrastructure - Storage
  container.registerSingleton(TOKENS.STORAGE_ADAPTER, () => 
    createStorageAdapter('localStorage', 'instructor-dashboard')
  );

  // Infrastructure - Repositories  
  container.registerSingleton(TOKENS.STUDENT_REPOSITORY, () => 
    createLegacyStudentRepository(
      finalConfig.api.baseUrl,
      finalConfig.api.timeout
    )
  );
  
  container.registerSingleton(TOKENS.DASHBOARD_REPOSITORY, () => 
    createLegacyDashboardRepository(
      finalConfig.api.baseUrl,
      finalConfig.storage.cacheMaxAge,
      finalConfig.api.timeout
    )
  );

  // Domain - Use Cases
  container.registerSingleton(TOKENS.FETCH_STUDENTS_USE_CASE, () =>
    createFetchStudentsUseCase(
      container.get(TOKENS.STUDENT_REPOSITORY)
    )
  );

  container.registerSingleton(TOKENS.SELECT_STUDENT_USE_CASE, () =>
    createSelectStudentUseCase(
      container.get(TOKENS.STUDENT_REPOSITORY)
    )
  );

  container.registerSingleton(TOKENS.REFRESH_DASHBOARD_USE_CASE, () =>
    createRefreshDashboardUseCase(
      container.get(TOKENS.STUDENT_REPOSITORY),
      container.get(TOKENS.DASHBOARD_REPOSITORY)
    )
  );

  // Application - Services
  container.registerSingleton(TOKENS.DASHBOARD_SERVICE, () =>
    createDashboardService(
      container.get(TOKENS.FETCH_STUDENTS_USE_CASE),
      container.get(TOKENS.SELECT_STUDENT_USE_CASE),
      container.get(TOKENS.REFRESH_DASHBOARD_USE_CASE)
    )
  );

  // Application - Stores
  container.registerSingleton(TOKENS.DASHBOARD_DATA_STORE, () =>
    createDashboardDataStore(
      container.get(TOKENS.STORAGE_ADAPTER),
      {
        enablePersistence: finalConfig.storage.enablePersistence,
        cacheMaxAge: finalConfig.storage.cacheMaxAge,
        maxActivityPoints: 288 // 24時間分
      }
    )
  );

  container.registerSingleton(TOKENS.DASHBOARD_UI_STORE, () =>
    createDashboardUIStore(
      container.get(TOKENS.STORAGE_ADAPTER),
      {
        enablePersistence: finalConfig.storage.enablePersistence,
        storageKey: 'dashboard-ui-settings'
      }
    )
  );

  return container;
}

/**
 * Initialize global DI container
 */
export function initializeGlobalContainer(config?: Partial<DashboardConfig>): DIContainer {
  const container = configureDIContainer(config);
  
  // グローバルコンテナとして設定
  DIContainer.getInstance().clear();
  
  // 登録をコピー
  container.getRegisteredTokens().forEach(tokenName => {
    const token = { name: tokenName };
    const instance = container.tryGet(token);
    if (instance) {
      DIContainer.getInstance().registerInstance(token, instance);
    }
  });

  return DIContainer.getInstance();
}

/**
 * Container validation and health check
 */
export function validateContainer(container: DIContainer): {
  isValid: boolean;
  missingDependencies: string[];
  errors: string[];
} {
  const missingDependencies: string[] = [];
  const errors: string[] = [];

  // 必須依存関係のチェック
  const requiredTokens = [
    TOKENS.STUDENT_REPOSITORY,
    TOKENS.DASHBOARD_REPOSITORY,
    TOKENS.DASHBOARD_SERVICE,
    TOKENS.DASHBOARD_DATA_STORE,
    TOKENS.DASHBOARD_UI_STORE
  ];

  requiredTokens.forEach(token => {
    if (!container.isRegistered(token as any)) {
      missingDependencies.push(token.name);
    } else {
      try {
        container.get(token as any);
      } catch (error) {
        errors.push(`Failed to resolve ${token.name}: ${(error as Error).message}`);
      }
    }
  });

  return {
    isValid: missingDependencies.length === 0 && errors.length === 0,
    missingDependencies,
    errors
  };
}

/**
 * Development helpers
 */
export function createMockContainer(): DIContainer {
  return configureDIContainer({
    features: {
      enableMockData: true,
      enableWebSocket: false,
      enableAnalytics: false
    },
    api: {
      baseUrl: 'http://localhost:3001', // Mock server
      timeout: 5000
    }
  });
}

export function createTestContainer(): DIContainer {
  return configureDIContainer({
    storage: {
      enablePersistence: false,
      cacheMaxAge: 1000 // 1秒（テスト用に短く）
    },
    features: {
      enableMockData: true,
      enableWebSocket: false,
      enableAnalytics: false
    }
  });
}