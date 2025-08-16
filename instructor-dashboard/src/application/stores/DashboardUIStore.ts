/**
 * Dashboard UI Store
 * UI状態管理専用ストア
 * SOLID原則のSingle Responsibilityに基づき、UI状態のみを管理
 */

import { StudentID } from '../../domain/entities/Student';
import { StorageAdapter } from '../../infrastructure/storage/BrowserStorageAdapter';

export type ViewMode = 'grid' | 'team';
export type SortField = 'userName' | 'teamName' | 'lastActivity' | 'cellExecutions' | 'errorCount';
export type SortDirection = 'asc' | 'desc';
export type FilterStatus = 'all' | 'active' | 'idle' | 'error' | 'help';

export interface DashboardUIState {
  // View Configuration
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;
  
  // Filters
  filterStatus: FilterStatus;
  filterTeam: string | null;
  searchQuery: string;
  showOnlyErrors: boolean;
  showOnlyHelp: boolean;
  
  // UI State
  sidebarOpen: boolean;
  selectedStudentId: StudentID | null;
  expandedTeams: Set<string>;
  
  // Modal State
  studentDetailModalOpen: boolean;
  settingsModalOpen: boolean;
  helpModalOpen: boolean;
  
  // Layout
  gridColumns: number;
  refreshInterval: number;
  autoRefresh: boolean;
  
  // Preferences
  theme: 'light' | 'dark';
  compactMode: boolean;
  showMetrics: boolean;
  showActivityChart: boolean;
  enableNotifications: boolean;
  enableSounds: boolean;
}

export interface UIStoreConfig {
  enablePersistence: boolean;
  storageKey: string;
}

/**
 * DashboardUIStore
 * UIの状態管理のみに特化
 */
export class DashboardUIStore {
  private state: DashboardUIState = {
    // View Configuration
    viewMode: 'team',
    sortField: 'lastActivity',
    sortDirection: 'desc',
    
    // Filters
    filterStatus: 'all',
    filterTeam: null,
    searchQuery: '',
    showOnlyErrors: false,
    showOnlyHelp: false,
    
    // UI State
    sidebarOpen: true,
    selectedStudentId: null,
    expandedTeams: new Set(['チームA', 'チームB', 'チームC']),
    
    // Modal State
    studentDetailModalOpen: false,
    settingsModalOpen: false,
    helpModalOpen: false,
    
    // Layout
    gridColumns: 4,
    refreshInterval: 15000, // 15秒
    autoRefresh: true,
    
    // Preferences
    theme: 'light',
    compactMode: false,
    showMetrics: true,
    showActivityChart: true,
    enableNotifications: true,
    enableSounds: false
  };

  private subscribers: Set<(state: DashboardUIState) => void> = new Set();

  constructor(
    private readonly storage: StorageAdapter,
    private readonly config: UIStoreConfig = {
      enablePersistence: true,
      storageKey: 'dashboard-ui-settings'
    }
  ) {
    this.loadFromStorage();
  }

  // State Access
  getState(): Readonly<DashboardUIState> {
    return { ...this.state, expandedTeams: new Set(this.state.expandedTeams) };
  }

  // View Configuration
  getViewMode(): ViewMode {
    return this.state.viewMode;
  }

  setViewMode(viewMode: ViewMode): void {
    this.updateState({ viewMode });
  }

  getSortField(): SortField {
    return this.state.sortField;
  }

  getSortDirection(): SortDirection {
    return this.state.sortDirection;
  }

  setSorting(field: SortField, direction?: SortDirection): void {
    const newDirection = direction || (
      this.state.sortField === field && this.state.sortDirection === 'asc' 
        ? 'desc' 
        : 'asc'
    );
    
    this.updateState({
      sortField: field,
      sortDirection: newDirection
    });
  }

  // Filters
  getFilterStatus(): FilterStatus {
    return this.state.filterStatus;
  }

  setFilterStatus(status: FilterStatus): void {
    this.updateState({ filterStatus: status });
  }

  getFilterTeam(): string | null {
    return this.state.filterTeam;
  }

  setFilterTeam(team: string | null): void {
    this.updateState({ filterTeam: team });
  }

  getSearchQuery(): string {
    return this.state.searchQuery;
  }

  setSearchQuery(query: string): void {
    this.updateState({ searchQuery: query });
  }

  getShowOnlyErrors(): boolean {
    return this.state.showOnlyErrors;
  }

  setShowOnlyErrors(show: boolean): void {
    this.updateState({ showOnlyErrors: show });
  }

  getShowOnlyHelp(): boolean {
    return this.state.showOnlyHelp;
  }

  setShowOnlyHelp(show: boolean): void {
    this.updateState({ showOnlyHelp: show });
  }

  clearFilters(): void {
    this.updateState({
      filterStatus: 'all',
      filterTeam: null,
      searchQuery: '',
      showOnlyErrors: false,
      showOnlyHelp: false
    });
  }

  // UI State
  isSidebarOpen(): boolean {
    return this.state.sidebarOpen;
  }

  setSidebarOpen(open: boolean): void {
    this.updateState({ sidebarOpen: open });
  }

  toggleSidebar(): void {
    this.setSidebarOpen(!this.state.sidebarOpen);
  }

  getSelectedStudentId(): StudentID | null {
    return this.state.selectedStudentId;
  }

  setSelectedStudentId(studentId: StudentID | null): void {
    this.updateState({ selectedStudentId: studentId });
  }

  getExpandedTeams(): Set<string> {
    return new Set(this.state.expandedTeams);
  }

  isTeamExpanded(teamName: string): boolean {
    return this.state.expandedTeams.has(teamName);
  }

  toggleTeamExpanded(teamName: string): void {
    const newExpandedTeams = new Set(this.state.expandedTeams);
    if (newExpandedTeams.has(teamName)) {
      newExpandedTeams.delete(teamName);
    } else {
      newExpandedTeams.add(teamName);
    }
    this.updateState({ expandedTeams: newExpandedTeams });
  }

  expandAllTeams(teamNames: string[]): void {
    this.updateState({ expandedTeams: new Set(teamNames) });
  }

  collapseAllTeams(): void {
    this.updateState({ expandedTeams: new Set() });
  }

  // Modal State
  isStudentDetailModalOpen(): boolean {
    return this.state.studentDetailModalOpen;
  }

  setStudentDetailModalOpen(open: boolean): void {
    this.updateState({ studentDetailModalOpen: open });
  }

  isSettingsModalOpen(): boolean {
    return this.state.settingsModalOpen;
  }

  setSettingsModalOpen(open: boolean): void {
    this.updateState({ settingsModalOpen: open });
  }

  isHelpModalOpen(): boolean {
    return this.state.helpModalOpen;
  }

  setHelpModalOpen(open: boolean): void {
    this.updateState({ helpModalOpen: open });
  }

  closeAllModals(): void {
    this.updateState({
      studentDetailModalOpen: false,
      settingsModalOpen: false,
      helpModalOpen: false
    });
  }

  // Layout
  getGridColumns(): number {
    return this.state.gridColumns;
  }

  setGridColumns(columns: number): void {
    const clampedColumns = Math.max(1, Math.min(6, columns));
    this.updateState({ gridColumns: clampedColumns });
  }

  getRefreshInterval(): number {
    return this.state.refreshInterval;
  }

  setRefreshInterval(interval: number): void {
    const clampedInterval = Math.max(5000, Math.min(300000, interval)); // 5秒-5分
    this.updateState({ refreshInterval: clampedInterval });
  }

  isAutoRefresh(): boolean {
    return this.state.autoRefresh;
  }

  setAutoRefresh(enabled: boolean): void {
    this.updateState({ autoRefresh: enabled });
  }

  // Preferences
  getTheme(): 'light' | 'dark' {
    return this.state.theme;
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.updateState({ theme });
  }

  toggleTheme(): void {
    this.setTheme(this.state.theme === 'light' ? 'dark' : 'light');
  }

  isCompactMode(): boolean {
    return this.state.compactMode;
  }

  setCompactMode(compact: boolean): void {
    this.updateState({ compactMode: compact });
  }

  toggleCompactMode(): void {
    this.setCompactMode(!this.state.compactMode);
  }

  shouldShowMetrics(): boolean {
    return this.state.showMetrics;
  }

  setShowMetrics(show: boolean): void {
    this.updateState({ showMetrics: show });
  }

  shouldShowActivityChart(): boolean {
    return this.state.showActivityChart;
  }

  setShowActivityChart(show: boolean): void {
    this.updateState({ showActivityChart: show });
  }

  areNotificationsEnabled(): boolean {
    return this.state.enableNotifications;
  }

  setNotificationsEnabled(enabled: boolean): void {
    this.updateState({ enableNotifications: enabled });
  }

  areSoundsEnabled(): boolean {
    return this.state.enableSounds;
  }

  setSoundsEnabled(enabled: boolean): void {
    this.updateState({ enableSounds: enabled });
  }

  // Batch Updates
  updatePreferences(preferences: Partial<{
    theme: 'light' | 'dark';
    compactMode: boolean;
    showMetrics: boolean;
    showActivityChart: boolean;
    enableNotifications: boolean;
    enableSounds: boolean;
    refreshInterval: number;
    autoRefresh: boolean;
  }>): void {
    this.updateState(preferences);
  }

  // Subscription Management
  subscribe(callback: (state: DashboardUIState) => void): () => void {
    this.subscribers.add(callback);
    
    // 初回コールバック
    callback(this.getState());
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // Reset
  reset(): void {
    this.state = {
      viewMode: 'team',
      sortField: 'lastActivity',
      sortDirection: 'desc',
      filterStatus: 'all',
      filterTeam: null,
      searchQuery: '',
      showOnlyErrors: false,
      showOnlyHelp: false,
      sidebarOpen: true,
      selectedStudentId: null,
      expandedTeams: new Set(),
      studentDetailModalOpen: false,
      settingsModalOpen: false,
      helpModalOpen: false,
      gridColumns: 4,
      refreshInterval: 15000,
      autoRefresh: true,
      theme: 'light',
      compactMode: false,
      showMetrics: true,
      showActivityChart: true,
      enableNotifications: true,
      enableSounds: false
    };
    
    if (this.config.enablePersistence) {
      this.storage.remove(this.config.storageKey);
    }
    
    this.notifySubscribers();
  }

  // Private Methods
  private updateState(updates: Partial<DashboardUIState>): void {
    this.state = { ...this.state, ...updates };
    
    if (this.config.enablePersistence) {
      this.saveToStorage();
    }
    
    this.notifySubscribers();
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback(this.getState());
      } catch (error) {
        console.error('Error in UI store subscription:', error);
      }
    });
  }

  private saveToStorage(): void {
    try {
      const serializedState = this.serializeState();
      this.storage.set(this.config.storageKey, serializedState);
    } catch (error) {
      console.warn('Failed to save UI settings to storage:', error);
    }
  }

  private loadFromStorage(): void {
    if (!this.config.enablePersistence) return;

    try {
      const serializedState = this.storage.get<any>(this.config.storageKey);
      if (serializedState) {
        const deserializedState = this.deserializeState(serializedState);
        if (deserializedState) {
          this.state = { ...this.state, ...deserializedState };
        }
      }
    } catch (error) {
      console.warn('Failed to load UI settings from storage:', error);
    }
  }

  private serializeState(): any {
    return {
      ...this.state,
      expandedTeams: Array.from(this.state.expandedTeams),
      // モーダル状態などは永続化しない
      studentDetailModalOpen: false,
      settingsModalOpen: false,
      helpModalOpen: false,
      selectedStudentId: null
    };
  }

  private deserializeState(serialized: any): Partial<DashboardUIState> | null {
    try {
      return {
        ...serialized,
        expandedTeams: new Set(serialized.expandedTeams || []),
        // 安全性のためモーダル状態は復元しない
        studentDetailModalOpen: false,
        settingsModalOpen: false,
        helpModalOpen: false,
        selectedStudentId: null
      };
    } catch (error) {
      console.warn('Failed to deserialize UI state:', error);
      return null;
    }
  }
}

/**
 * Factory function
 */
export const createDashboardUIStore = (
  storage: StorageAdapter,
  config?: Partial<UIStoreConfig>
): DashboardUIStore => {
  const finalConfig: UIStoreConfig = {
    enablePersistence: true,
    storageKey: 'dashboard-ui-settings',
    ...config
  };
  
  return new DashboardUIStore(storage, finalConfig);
};