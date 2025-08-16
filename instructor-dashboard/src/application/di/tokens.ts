/**
 * DI Tokens
 * 型安全なDependency Injectionのためのトークン定義
 */

import { createToken } from './DIContainer';

// Domain Entities
import { Student } from '../../domain/entities/Student';
import { Team } from '../../domain/entities/Team';
import { DashboardMetrics } from '../../domain/entities/Metrics';

// Domain Repositories
import { StudentRepository } from '../../domain/repositories/StudentRepository';
import { DashboardRepository } from '../../domain/repositories/DashboardRepository';

// Domain Use Cases
import { FetchStudentsUseCase } from '../../domain/use-cases/student/FetchStudentsUseCase';
import { SelectStudentUseCase } from '../../domain/use-cases/student/SelectStudentUseCase';
import { RefreshDashboardUseCase } from '../../domain/use-cases/dashboard/RefreshDashboardUseCase';

// Application Services
import { DashboardService } from '../services/DashboardService';

// Application Stores
import { DashboardDataStore } from '../stores/DashboardDataStore';
import { DashboardUIStore } from '../stores/DashboardUIStore';

// Infrastructure
import { StorageAdapter } from '../../infrastructure/storage/BrowserStorageAdapter';

/**
 * Repository Tokens
 */
export const TOKENS = {
  // Infrastructure
  STORAGE_ADAPTER: createToken<StorageAdapter>('StorageAdapter'),
  API_BASE_URL: createToken<string>('ApiBaseUrl'),
  API_TIMEOUT: createToken<number>('ApiTimeout'),

  // Repositories
  STUDENT_REPOSITORY: createToken<StudentRepository>('StudentRepository'),
  DASHBOARD_REPOSITORY: createToken<DashboardRepository>('DashboardRepository'),

  // Use Cases
  FETCH_STUDENTS_USE_CASE: createToken<FetchStudentsUseCase>('FetchStudentsUseCase'),
  SELECT_STUDENT_USE_CASE: createToken<SelectStudentUseCase>('SelectStudentUseCase'),
  REFRESH_DASHBOARD_USE_CASE: createToken<RefreshDashboardUseCase>('RefreshDashboardUseCase'),

  // Application Services
  DASHBOARD_SERVICE: createToken<DashboardService>('DashboardService'),

  // Application Stores
  DASHBOARD_DATA_STORE: createToken<DashboardDataStore>('DashboardDataStore'),
  DASHBOARD_UI_STORE: createToken<DashboardUIStore>('DashboardUIStore'),

  // Configuration
  CONFIG: createToken<DashboardConfig>('Config'),
} as const;

/**
 * Configuration Types
 */
export interface DashboardConfig {
  api: {
    baseUrl: string;
    timeout: number;
  };
  storage: {
    enablePersistence: boolean;
    cacheMaxAge: number;
  };
  ui: {
    refreshInterval: number;
    enableNotifications: boolean;
    theme: 'light' | 'dark';
  };
  features: {
    enableMockData: boolean;
    enableWebSocket: boolean;
    enableAnalytics: boolean;
  };
}

/**
 * Default Configuration
 */
export const DEFAULT_CONFIG: DashboardConfig = {
  api: {
    baseUrl: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1',
    timeout: 10000
  },
  storage: {
    enablePersistence: true,
    cacheMaxAge: 5 * 60 * 1000 // 5分
  },
  ui: {
    refreshInterval: 15000, // 15秒
    enableNotifications: true,
    theme: 'light'
  },
  features: {
    enableMockData: process.env.NODE_ENV === 'development',
    enableWebSocket: true,
    enableAnalytics: process.env.NODE_ENV === 'production'
  }
};

/**
 * Token Type Helpers
 */
export type TokenType<T> = T extends { __type?: infer U } ? U : never;

/**
 * Token Registry for debugging
 */
export const TOKEN_REGISTRY = Object.values(TOKENS).reduce((registry, token) => {
  registry[token.name] = token;
  return registry;
}, {} as Record<string, any>);