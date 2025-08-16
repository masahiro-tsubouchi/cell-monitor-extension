import { create } from 'zustand';
import { dashboardAPI, StudentActivity, DashboardMetrics, ActivityTimePoint } from '../services/dashboardAPI';
import { getInstructorSettings } from '../utils/instructorStorage';
import { deltaCalculator, deltaApplicator, DeltaPackage, DeltaUpdate } from '../utils/deltaCalculator';
import { performanceMonitor, LoadComparison, withPerformanceTracking, withSyncPerformanceTracking } from '../utils/performanceMonitor';

interface ProgressDashboardState {
  // Data
  students: StudentActivity[];
  metrics: DashboardMetrics;
  activityChart: ActivityTimePoint[];

  // UI State
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  autoRefresh: boolean;
  selectedStudent: StudentActivity | null;

  // 新機能: UI状態保持
  preserveUIState: boolean;           // UI状態保持フラグ
  lastUserInteraction: number;        // 最後のユーザー操作時刻
  updateQueue: StudentActivity[];     // 保留中の更新キュー
  deferredUpdatesEnabled: boolean;    // 遅延更新モード

  // Step 2A: 差分更新システム
  deltaMode: boolean;                 // 差分更新モード有効/無効
  lastDeltaUpdate: DeltaPackage | null; // 最後の差分パッケージ
  compressionStats: {                 // 圧縮統計
    totalSaved: number;
    averageCompression: number;
    updateCount: number;
  };

  // パフォーマンス監視
  performanceMonitoring: boolean;     // パフォーマンス測定ON/OFF
  loadComparison: LoadComparison | null; // Before/After比較結果
  realTimePerformance: any;           // リアルタイム性能統計

  // Actions
  refreshData: () => Promise<void>;
  updateStudentsIncremental: (updates: StudentActivity[]) => void;
  setAutoRefresh: (enabled: boolean) => void;
  selectStudent: (student: StudentActivity | null) => void;
  updateStudentStatus: (emailAddress: string, updates: Partial<StudentActivity>) => void;
  clearError: () => void;

  // 新しいアクション
  markUserActive: () => void;                    // ユーザーアクティビティ記録
  updateStudentsPreservingState: (updates: StudentActivity[]) => void; // 状態保持更新
  flushQueuedUpdates: () => void;               // キューの更新実行
  setDeferredUpdates: (enabled: boolean) => void; // 遅延更新制御

  // Step 2A: 差分更新アクション
  applyDeltaUpdate: (deltaPackage: DeltaPackage) => void; // 差分パッケージ適用
  calculateCurrentDeltas: () => DeltaPackage;             // 現在状態の差分計算
  enableDeltaMode: (enabled: boolean) => void;            // 差分モード制御
  getCompressionStats: () => any;                         // 圧縮統計取得

  // パフォーマンス監視アクション
  startPerformanceMonitoring: () => void;                 // 監視開始
  stopPerformanceMonitoring: () => void;                  // 監視停止
  getLoadComparison: () => LoadComparison | null;         // 負荷比較取得
  generatePerformanceReport: () => string;                // レポート生成
}

export const useProgressDashboardStore = create<ProgressDashboardState>((set, get) => ({
  // Initial state
  students: [],
  metrics: {
    totalStudents: 0,
    totalActive: 0,
    errorCount: 0,
    totalExecutions: 0,
    helpCount: 0
  },
  activityChart: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  autoRefresh: (() => {
    try {
      const settings = getInstructorSettings();
      return settings.autoRefresh;
    } catch {
      return true;
    }
  })(),
  selectedStudent: null,

  // 新機能の初期状態
  preserveUIState: true,              // デフォルトで状態保持を有効
  lastUserInteraction: Date.now(),    // 現在時刻で初期化
  updateQueue: [],                    // 空のキューで開始
  deferredUpdatesEnabled: true,       // 遅延更新を有効

  // Step 2A: 差分更新の初期状態
  deltaMode: true,                    // デフォルトで差分モードを有効
  lastDeltaUpdate: null,              // 差分パッケージなし
  compressionStats: {                 // 圧縮統計の初期値
    totalSaved: 0,
    averageCompression: 0,
    updateCount: 0
  },

  // パフォーマンス監視の初期状態
  performanceMonitoring: false,       // デフォルトでOFF
  loadComparison: null,               // 比較結果なし
  realTimePerformance: null,          // リアルタイム統計なし

  // Refresh dashboard data
  refreshData: async () => {
    const currentState = get();
    if (currentState.isLoading) return; // Prevent concurrent requests

    // 最後の更新から5秒以内なら重複リクエストを防止
    const now = new Date();
    if (currentState.lastUpdated) {
      const timeSinceLastUpdate = now.getTime() - currentState.lastUpdated.getTime();
      if (timeSinceLastUpdate < 5000) {
        console.log('Recent update detected, skipping refresh');
        return;
      }
    }

    try {
      set({ isLoading: true, error: null });

      const data = await withPerformanceTracking(
        () => dashboardAPI.getDashboardOverview(),
        'Full Data Fetch'
      );

      // パフォーマンス監視中の場合、フル更新を記録
      if (currentState.performanceMonitoring) {
        performanceMonitor.recordFullUpdate(data.students);
      }

      set({
        students: data.students,
        metrics: data.metrics,
        activityChart: data.activityChart,
        isLoading: false,
        lastUpdated: new Date(),
        error: null
      });

      console.log('Progress dashboard data refreshed:', data);
    } catch (error) {
      console.error('Failed to refresh progress dashboard data:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'データの取得に失敗しました'
      });
    }
  },

  // Incremental update for students (preserves UI state)
  updateStudentsIncremental: (updates: StudentActivity[]) => {
    const currentState = get();
    const updatedStudents = [...currentState.students];

    // Apply updates by merging with existing student data
    updates.forEach(update => {
      const index = updatedStudents.findIndex(s => s.emailAddress === update.emailAddress);
      if (index >= 0) {
        // Update existing student
        updatedStudents[index] = { ...updatedStudents[index], ...update };
      } else {
        // Add new student
        updatedStudents.push(update);
      }
    });

    // Recalculate metrics
    const newMetrics: DashboardMetrics = {
      totalStudents: updatedStudents.length,
      totalActive: updatedStudents.filter(s => s.status === 'active').length,
      errorCount: updatedStudents.filter(s => s.status === 'error').length,
      totalExecutions: updatedStudents.reduce((sum, s) => sum + (s.cellExecutions || 0), 0),
      helpCount: updatedStudents.filter(s => s.isRequestingHelp).length
    };

    set({
      students: updatedStudents,
      metrics: newMetrics,
      lastUpdated: new Date()
    });

    console.log(`差分更新完了: ${updates.length}名の学生データを更新`);
  },

  // Toggle auto refresh
  setAutoRefresh: (enabled: boolean) => {
    set({ autoRefresh: enabled });
  },

  // Select student for detailed view
  selectStudent: (student: StudentActivity | null) => {
    set({ selectedStudent: student });
  },

  // Update specific student status (for WebSocket updates)
  updateStudentStatus: (emailAddress: string, updates: Partial<StudentActivity>) => {
    const currentState = get();
    const updatedStudents = currentState.students.map(student =>
      student.emailAddress === emailAddress
        ? { ...student, ...updates }
        : student
    );

    // Recalculate metrics (keep original helpCount from server)
    const currentMetrics = get().metrics;
    const newMetrics: DashboardMetrics = {
      totalStudents: updatedStudents.length,
      totalActive: updatedStudents.filter(s => s.status === 'active').length,
      errorCount: updatedStudents.filter(s => s.status === 'error').length,
      totalExecutions: updatedStudents.reduce((sum, s) => sum + s.cellExecutions, 0),
      helpCount: currentMetrics.helpCount // Preserve help count from server
    };

    set({
      students: updatedStudents,
      metrics: newMetrics,
      lastUpdated: new Date()
    });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // 新機能: ユーザーアクティビティ記録
  markUserActive: () => {
    set({ 
      lastUserInteraction: Date.now(),
      preserveUIState: true 
    });
  },

  // 新機能: 状態保持更新
  updateStudentsPreservingState: (updates: StudentActivity[]) => {
    const currentState = get();
    
    // ユーザーが最近操作した場合は更新を遅延
    const timeSinceLastInteraction = Date.now() - currentState.lastUserInteraction;
    const shouldDelay = timeSinceLastInteraction < 10000 && currentState.preserveUIState; // 10秒以内
    
    if (shouldDelay && currentState.deferredUpdatesEnabled) {
      // キューに追加して遅延実行
      const newQueue = [...currentState.updateQueue];
      updates.forEach(update => {
        const existingIndex = newQueue.findIndex(q => q.emailAddress === update.emailAddress);
        if (existingIndex >= 0) {
          newQueue[existingIndex] = { ...newQueue[existingIndex], ...update };
        } else {
          newQueue.push(update);
        }
      });
      
      set({ updateQueue: newQueue });
      
      // 5秒後に自動フラッシュ
      setTimeout(() => {
        const state = get();
        if (state.updateQueue.length > 0) {
          get().flushQueuedUpdates();
        }
      }, 5000);
      
      console.log(`更新を遅延: ${updates.length}件をキューに追加`);
    } else {
      // 即座に更新
      get().updateStudentsIncremental(updates);
    }
  },

  // 新機能: キューの更新実行
  flushQueuedUpdates: () => {
    const currentState = get();
    if (currentState.updateQueue.length > 0) {
      get().updateStudentsIncremental(currentState.updateQueue);
      set({ updateQueue: [] });
      console.log(`キューをフラッシュ: ${currentState.updateQueue.length}件の更新を実行`);
    }
  },

  // 新機能: 遅延更新制御
  setDeferredUpdates: (enabled: boolean) => {
    set({ deferredUpdatesEnabled: enabled });
    
    // 無効にする場合は即座にキューをフラッシュ
    if (!enabled) {
      setTimeout(() => get().flushQueuedUpdates(), 0);
    }
  },

  // Step 2A: 差分更新システムアクション
  applyDeltaUpdate: (deltaPackage: DeltaPackage) => {
    const currentState = get();
    
    try {
      // パフォーマンス監視中の場合、差分更新を記録
      if (currentState.performanceMonitoring) {
        performanceMonitor.recordDeltaUpdate([deltaPackage]);
      }

      // 差分を現在のデータに適用
      const updatedStudents = withSyncPerformanceTracking(
        () => deltaApplicator.applyDeltas(currentState.students, deltaPackage),
        'Delta Application'
      );
      
      // メトリクス再計算
      const newMetrics: DashboardMetrics = {
        totalStudents: updatedStudents.length,
        totalActive: updatedStudents.filter(s => s.status === 'active').length,
        errorCount: updatedStudents.filter(s => s.status === 'error').length,
        totalExecutions: updatedStudents.reduce((sum, s) => sum + (s.cellExecutions || 0), 0),
        helpCount: updatedStudents.filter(s => s.isRequestingHelp).length
      };

      // 圧縮統計更新
      const compressionRatio = deltaPackage.metadata.compressionRatio;
      const newCompressionStats = {
        totalSaved: currentState.compressionStats.totalSaved + compressionRatio,
        averageCompression: 
          (currentState.compressionStats.averageCompression * currentState.compressionStats.updateCount + compressionRatio) /
          (currentState.compressionStats.updateCount + 1),
        updateCount: currentState.compressionStats.updateCount + 1
      };

      set({
        students: updatedStudents,
        metrics: newMetrics,
        lastUpdated: new Date(),
        lastDeltaUpdate: deltaPackage,
        compressionStats: newCompressionStats
      });

      console.log(`🚀 差分更新適用: ${deltaPackage.changes.length}件の変更, 圧縮率: ${Math.round(compressionRatio * 100)}%`);
      
    } catch (error) {
      console.error('差分更新の適用に失敗:', error);
      // フォールバック: 完全な再取得
      get().refreshData();
    }
  },

  calculateCurrentDeltas: () => {
    const currentState = get();
    return deltaCalculator.calculateDeltas(currentState.students);
  },

  enableDeltaMode: (enabled: boolean) => {
    set({ deltaMode: enabled });
    
    if (enabled) {
      console.log('🎯 差分更新モードを有効化 - データ転送量90%削減');
    } else {
      console.log('📊 フル更新モードに切り替え');
      deltaCalculator.reset(); // 差分履歴をリセット
    }
  },

  getCompressionStats: () => {
    const currentState = get();
    const deltaStats = deltaCalculator.getStats();
    
    return {
      ...currentState.compressionStats,
      ...deltaStats,
      mode: currentState.deltaMode ? 'delta' : 'full',
      lastUpdate: currentState.lastDeltaUpdate?.metadata
    };
  },

  // パフォーマンス監視アクション
  startPerformanceMonitoring: () => {
    performanceMonitor.startRecording();
    set({ 
      performanceMonitoring: true,
      loadComparison: null,
      realTimePerformance: null
    });
    console.log('📊 パフォーマンス監視を開始しました');
  },

  stopPerformanceMonitoring: () => {
    performanceMonitor.stopRecording();
    
    // 最終比較結果を計算
    const comparison = performanceMonitor.analyzePerfomanceComparison();
    
    set({ 
      performanceMonitoring: false,
      loadComparison: comparison
    });
    
    console.log('📊 パフォーマンス監視を停止しました');
    if (comparison) {
      console.log('負荷削減効果:', comparison.improvements);
    }
  },

  getLoadComparison: () => {
    const currentState = get();
    return currentState.loadComparison || performanceMonitor.analyzePerfomanceComparison();
  },

  generatePerformanceReport: () => {
    const comparison = get().getLoadComparison();
    const realTimeStats = performanceMonitor.getRealTimeStats();
    const csvData = performanceMonitor.exportToCSV();
    
    const report = `
# パフォーマンス監視レポート
生成日時: ${new Date().toISOString()}

## リアルタイム統計
${realTimeStats ? `
- セッション時間: ${Math.round(realTimeStats.sessionDuration / 1000)}秒
- 総更新回数: ${realTimeStats.totalUpdates}
- 差分更新率: ${realTimeStats.deltaUpdateRatio.toFixed(1)}%
- 転送データ量: ${(realTimeStats.totalDataTransferred / 1024).toFixed(2)}KB
- 平均処理時間: ${realTimeStats.averageProcessingTime.toFixed(2)}ms
- 推定帯域幅削減: ${(realTimeStats.estimatedBandwidthSaved / 1024).toFixed(2)}KB
` : '統計データなし'}

## Before/After比較
${comparison ? `
### 負荷軽減効果
- データサイズ削減: ${comparison.improvements?.dataSizeReduction?.toFixed(1) || 0}%
- 処理速度向上: ${comparison.improvements?.processingSpeedup?.toFixed(1) || 0}%
- メモリ使用量削減: ${comparison.improvements?.memoryReduction?.toFixed(1) || 0}%
- 帯域幅削減量: ${((comparison.improvements?.bandwidthSavings || 0) / 1024).toFixed(2)}KB/分

### フル更新 (Before)
- 平均データサイズ: ${((comparison.fullUpdateMetrics?.dataSize || 0) / 1024).toFixed(2)}KB
- 平均処理時間: ${comparison.fullUpdateMetrics?.processingTime?.toFixed(2) || 0}ms
- メモリ使用量: ${((comparison.fullUpdateMetrics?.memoryUsage || 0) / 1024).toFixed(2)}KB

### 差分更新 (After) 
- 平均データサイズ: ${((comparison.deltaUpdateMetrics?.dataSize || 0) / 1024).toFixed(2)}KB
- 平均処理時間: ${comparison.deltaUpdateMetrics?.processingTime?.toFixed(2) || 0}ms
- メモリ使用量: ${((comparison.deltaUpdateMetrics?.memoryUsage || 0) / 1024).toFixed(2)}KB
- 圧縮率: ${((comparison.deltaUpdateMetrics?.compressionRatio || 0) * 100).toFixed(1)}%
` : '比較データなし'}

## CSV生データ
${csvData}
    `;
    
    return report.trim();
  }
}));
