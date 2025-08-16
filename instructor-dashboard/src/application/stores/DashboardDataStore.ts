/**
 * Dashboard Data Store
 * Application層のデータストレージ管理
 * Clean Architectureに基づく状態管理
 */

import { Student, StudentID } from '../../domain/entities/Student';
import { Team } from '../../domain/entities/Team';
import { DashboardMetrics, ActivityTimePoint } from '../../domain/entities/Metrics';
import { DashboardOverview } from '../../domain/repositories/DashboardRepository';
import { StorageAdapter } from '../../infrastructure/storage/BrowserStorageAdapter';

export interface DashboardDataState {
  students: Student[];
  selectedStudentId: StudentID | null;
  teams: Team[];
  metrics: DashboardMetrics | null;
  activityHistory: ActivityTimePoint[];
  overview: DashboardOverview | null;
  loading: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

export interface DataStoreConfig {
  enablePersistence: boolean;
  cacheMaxAge: number;
  maxActivityPoints: number;
}

/**
 * DashboardDataStore
 * SOLID原則のSingle Responsibilityに基づき、データ状態管理のみを担当
 */
export class DashboardDataStore {
  private state: DashboardDataState = {
    students: [],
    selectedStudentId: null,
    teams: [],
    metrics: null,
    activityHistory: [],
    overview: null,
    loading: false,
    lastUpdated: null,
    error: null
  };

  private subscribers: Set<(state: DashboardDataState) => void> = new Set();
  private readonly storageKey = 'dashboard-data';

  constructor(
    private readonly storage: StorageAdapter,
    private readonly config: DataStoreConfig = {
      enablePersistence: true,
      cacheMaxAge: 5 * 60 * 1000, // 5分
      maxActivityPoints: 288 // 24時間分（5分間隔）
    }
  ) {
    this.loadFromStorage();
  }

  // State Access
  getState(): Readonly<DashboardDataState> {
    return { ...this.state };
  }

  getStudents(): readonly Student[] {
    return this.state.students;
  }

  getSelectedStudentId(): StudentID | null {
    return this.state.selectedStudentId;
  }

  getSelectedStudent(): Student | null {
    if (!this.state.selectedStudentId) return null;
    return this.state.students.find(s => s.id === this.state.selectedStudentId) || null;
  }

  getTeams(): readonly Team[] {
    return this.state.teams;
  }

  getMetrics(): DashboardMetrics | null {
    return this.state.metrics;
  }

  getActivityHistory(): readonly ActivityTimePoint[] {
    return this.state.activityHistory;
  }

  getOverview(): DashboardOverview | null {
    return this.state.overview;
  }

  isLoading(): boolean {
    return this.state.loading;
  }

  getLastUpdated(): Date | null {
    return this.state.lastUpdated;
  }

  getError(): string | null {
    return this.state.error;
  }

  // State Updates
  setStudents(students: Student[]): void {
    this.updateState({ 
      students,
      lastUpdated: new Date(),
      error: null
    });
  }

  setSelectedStudentId(studentId: StudentID | null): void {
    this.updateState({ selectedStudentId: studentId });
  }

  setTeams(teams: Team[]): void {
    this.updateState({ 
      teams,
      lastUpdated: new Date()
    });
  }

  setMetrics(metrics: DashboardMetrics): void {
    this.updateState({ 
      metrics,
      lastUpdated: new Date()
    });
  }

  setActivityHistory(activityHistory: ActivityTimePoint[]): void {
    // 最大ポイント数制限
    const limitedHistory = activityHistory.slice(-this.config.maxActivityPoints);
    this.updateState({ activityHistory: limitedHistory });
  }

  addActivityPoint(point: ActivityTimePoint): void {
    const newHistory = [...this.state.activityHistory, point];
    this.setActivityHistory(newHistory);
  }

  setOverview(overview: DashboardOverview): void {
    this.updateState({
      overview,
      metrics: overview.metrics,
      teams: overview.teams,
      activityHistory: overview.activityHistory,
      lastUpdated: new Date(),
      error: null
    });
  }

  setLoading(loading: boolean): void {
    this.updateState({ loading });
  }

  setError(error: string | null): void {
    this.updateState({ error, loading: false });
  }

  // Batch Updates
  updateAll(updates: {
    students?: Student[];
    teams?: Team[];
    metrics?: DashboardMetrics;
    activityHistory?: ActivityTimePoint[];
    overview?: DashboardOverview;
  }): void {
    this.updateState({
      ...updates,
      lastUpdated: new Date(),
      error: null
    });
  }

  // Data Operations
  updateStudent(updatedStudent: Student): void {
    const updatedStudents = this.state.students.map(student =>
      student.equals(updatedStudent) ? updatedStudent : student
    );
    this.setStudents(updatedStudents);
  }

  removeStudent(studentId: StudentID): void {
    const filteredStudents = this.state.students.filter(s => s.id !== studentId);
    this.setStudents(filteredStudents);
    
    // 選択中の学生も削除対象なら選択解除
    if (this.state.selectedStudentId === studentId) {
      this.setSelectedStudentId(null);
    }
  }

  updateTeam(updatedTeam: Team): void {
    const updatedTeams = this.state.teams.map(team =>
      team.equals(updatedTeam) ? updatedTeam : team
    );
    this.setTeams(updatedTeams);
  }

  // Filtering and Searching
  filterStudents(predicate: (student: Student) => boolean): Student[] {
    return this.state.students.filter(predicate);
  }

  findStudent(predicate: (student: Student) => boolean): Student | null {
    return this.state.students.find(predicate) || null;
  }

  findTeam(predicate: (team: Team) => boolean): Team | null {
    return this.state.teams.find(predicate) || null;
  }

  // Cache Management
  isCacheValid(): boolean {
    if (!this.state.lastUpdated) return false;
    const age = Date.now() - this.state.lastUpdated.getTime();
    return age < this.config.cacheMaxAge;
  }

  invalidateCache(): void {
    this.updateState({ lastUpdated: null });
    if (this.config.enablePersistence) {
      this.storage.remove(this.storageKey);
    }
  }

  // Subscription Management
  subscribe(callback: (state: DashboardDataState) => void): () => void {
    this.subscribers.add(callback);
    
    // 初回コールバック
    callback(this.state);
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // Reset
  reset(): void {
    this.state = {
      students: [],
      selectedStudentId: null,
      teams: [],
      metrics: null,
      activityHistory: [],
      overview: null,
      loading: false,
      lastUpdated: null,
      error: null
    };
    
    if (this.config.enablePersistence) {
      this.storage.remove(this.storageKey);
    }
    
    this.notifySubscribers();
  }

  // Private Methods
  private updateState(updates: Partial<DashboardDataState>): void {
    this.state = { ...this.state, ...updates };
    
    if (this.config.enablePersistence) {
      this.saveToStorage();
    }
    
    this.notifySubscribers();
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback(this.state);
      } catch (error) {
        console.error('Error in data store subscription:', error);
      }
    });
  }

  private saveToStorage(): void {
    try {
      const serializedState = this.serializeState();
      this.storage.set(this.storageKey, serializedState);
    } catch (error) {
      console.warn('Failed to save dashboard data to storage:', error);
    }
  }

  private loadFromStorage(): void {
    if (!this.config.enablePersistence) return;

    try {
      const serializedState = this.storage.get<any>(this.storageKey);
      if (serializedState) {
        const deserializedState = this.deserializeState(serializedState);
        if (deserializedState) {
          this.state = { ...this.state, ...deserializedState };
        }
      }
    } catch (error) {
      console.warn('Failed to load dashboard data from storage:', error);
    }
  }

  private serializeState(): any {
    return {
      students: this.state.students.map(s => s.toJSON()),
      selectedStudentId: this.state.selectedStudentId,
      teams: this.state.teams.map(t => t.toJSON()),
      metrics: this.state.metrics ? this.state.metrics.toJSON() : null,
      activityHistory: this.state.activityHistory.map(point => ({
        time: point.time.toISOString(),
        executionCount: point.executionCount,
        errorCount: point.errorCount,
        helpCount: point.helpCount
      })),
      lastUpdated: this.state.lastUpdated ? this.state.lastUpdated.toISOString() : null,
      // overview, loading, error は永続化しない
    };
  }

  private deserializeState(serialized: any): Partial<DashboardDataState> | null {
    try {
      return {
        // 実際のエンティティ復元は複雑なので、基本データのみ復元
        selectedStudentId: serialized.selectedStudentId,
        lastUpdated: serialized.lastUpdated ? new Date(serialized.lastUpdated) : null,
        // 他のデータは次回フェッチ時に再構築
      };
    } catch (error) {
      console.warn('Failed to deserialize dashboard state:', error);
      return null;
    }
  }
}

/**
 * Factory function
 */
export const createDashboardDataStore = (
  storage: StorageAdapter,
  config?: Partial<DataStoreConfig>
): DashboardDataStore => {
  const finalConfig: DataStoreConfig = {
    enablePersistence: true,
    cacheMaxAge: 5 * 60 * 1000,
    maxActivityPoints: 288,
    ...config
  };
  
  return new DashboardDataStore(storage, finalConfig);
};