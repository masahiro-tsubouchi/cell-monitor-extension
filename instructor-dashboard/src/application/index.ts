/**
 * Application Layer Index
 * Clean Architecture Phase 1 エクスポート
 * 
 * このファイルは段階的移行のためのエントリーポイント
 * 既存コードから新しいアーキテクチャへの橋渡しを提供
 */

// Domain Layer Exports
export * from '../domain/entities/Student';
export * from '../domain/entities/Team';
export * from '../domain/entities/Metrics';

export * from '../domain/repositories/StudentRepository';
export * from '../domain/repositories/DashboardRepository';

export * from '../domain/use-cases/student/FetchStudentsUseCase';
export * from '../domain/use-cases/student/SelectStudentUseCase';
export * from '../domain/use-cases/dashboard/RefreshDashboardUseCase';

// Infrastructure Layer Exports
export * from '../infrastructure/api/APIStudentRepository';
export * from '../infrastructure/api/APIDashboardRepository';
export * from '../infrastructure/storage/BrowserStorageAdapter';

// Application Layer Exports
export * from './services/DashboardService';
export * from './stores/DashboardDataStore';
export * from './stores/DashboardUIStore';

// DI Container
export * from './di/DIContainer';
export * from './di/tokens';
export * from './di/containerConfig';

// Adapters
export * from './adapters/LegacyAdapter';
export * from './adapters/HookAdapter';

// Re-export legacy types for compatibility
export type {
  StudentActivity,
  DashboardMetrics,
  ActivityTimePoint,
  DashboardOverview,
  StudentDetailData,
  TeamStats,
  InstructorSettings,
  StudentStatus,
  StudentHelpStatus,
  TeamPriority,
  ViewMode,
  TimeRange
} from '../types/domain';

export {
  DEFAULT_TEAM_NAME,
  DEFAULT_REFRESH_INTERVAL,
  DEFAULT_INSTRUCTOR_SETTINGS,
  createStudentActivity,
  calculateTeamStats,
  isValidStudentStatus,
  isValidHelpStatus,
  isValidViewMode
} from '../types/domain';