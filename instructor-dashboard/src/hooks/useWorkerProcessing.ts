/**
 * Web Worker Processing Hook
 * メインスレッドから Worker への処理委譲
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { StudentActivity } from '../services/dashboardAPI';

interface ProcessingTask {
  type: 'FILTER_STUDENTS' | 'CALCULATE_STATISTICS' | 'GENERATE_ANALYTICS' | 'SORT_STUDENTS';
  data: any;
  taskId: string;
}

interface ProcessingResult {
  type: string;
  taskId: string;
  result: any;
  error?: string;
  duration: number;
}

interface WorkerState {
  isProcessing: boolean;
  lastProcessingTime: number;
  totalTasks: number;
  completedTasks: number;
  averageProcessingTime: number;
}

/**
 * Web Worker 処理フック
 */
export const useWorkerProcessing = () => {
  const workerRef = useRef<Worker | null>(null);
  const pendingTasks = useRef<Map<string, (result: any) => void>>(new Map());
  const [state, setState] = useState<WorkerState>({
    isProcessing: false,
    lastProcessingTime: 0,
    totalTasks: 0,
    completedTasks: 0,
    averageProcessingTime: 0
  });

  // Worker 初期化
  useEffect(() => {
    // Worker を動的に作成
    const createWorker = () => {
      try {
        // Webpack の Worker ローダーを使用
        workerRef.current = new Worker(
          new URL('../workers/dataProcessor.worker.ts', import.meta.url),
          { type: 'module' }
        );
        
        // メッセージハンドラー設定
        workerRef.current.onmessage = handleWorkerMessage;
        workerRef.current.onerror = handleWorkerError;
        
        console.log('🔧 Worker initialized successfully');
      } catch (error) {
        console.error('🔧 Failed to initialize worker:', error);
        // Worker が使用できない場合のフォールバック
        workerRef.current = null;
      }
    };

    createWorker();

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const handleWorkerMessage = useCallback((e: MessageEvent<ProcessingResult>) => {
    const { taskId, result, error, duration } = e.data;
    
    // 統計更新
    setState(prev => ({
      ...prev,
      isProcessing: false,
      lastProcessingTime: duration,
      completedTasks: prev.completedTasks + 1,
      averageProcessingTime: (prev.averageProcessingTime * prev.completedTasks + duration) / (prev.completedTasks + 1)
    }));

    // タスク完了コールバック実行
    const callback = pendingTasks.current.get(taskId);
    if (callback) {
      pendingTasks.current.delete(taskId);
      
      if (error) {
        console.error(`🔧 Worker task ${taskId} failed:`, error);
        callback(null);
      } else {
        console.log(`🔧 Worker task ${taskId} completed in ${duration.toFixed(2)}ms`);
        callback(result);
      }
    }
  }, []);

  const handleWorkerError = useCallback((error: ErrorEvent) => {
    console.error('🔧 Worker error:', error);
    setState(prev => ({ ...prev, isProcessing: false }));
  }, []);

  // タスク実行ヘルパー
  const executeTask = useCallback(async <T>(
    type: ProcessingTask['type'],
    data: any
  ): Promise<T | null> => {
    return new Promise((resolve) => {
      // Worker が使用できない場合のフォールバック
      if (!workerRef.current) {
        console.warn('🔧 Worker not available, using fallback processing');
        resolve(executeTaskFallback(type, data));
        return;
      }

      const taskId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // コールバック登録
      pendingTasks.current.set(taskId, resolve);
      
      // 統計更新
      setState(prev => ({
        ...prev,
        isProcessing: true,
        totalTasks: prev.totalTasks + 1
      }));

      // Worker にタスク送信
      const task: ProcessingTask = { type, data, taskId };
      workerRef.current.postMessage(task);
    });
  }, []);

  // フォールバック処理（Worker が使用できない場合）
  const executeTaskFallback = useCallback(<T>(
    type: ProcessingTask['type'],
    data: any
  ): T | null => {
    const startTime = performance.now();
    
    try {
      let result: any = null;

      switch (type) {
        case 'FILTER_STUDENTS':
          result = filterStudentsFallback(data.students, data.filters);
          break;
        case 'CALCULATE_STATISTICS':
          result = calculateStatisticsFallback(data.students);
          break;
        case 'SORT_STUDENTS':
          result = sortStudentsFallback(data.students, data.sortBy, data.sortOrder);
          break;
        default:
          console.warn(`🔧 Fallback not implemented for task type: ${type}`);
      }

      const duration = performance.now() - startTime;
      console.log(`🔧 Fallback processing for ${type} completed in ${duration.toFixed(2)}ms`);
      
      return result;
    } catch (error) {
      console.error(`🔧 Fallback processing failed for ${type}:`, error);
      return null;
    }
  }, []);

  // 学生フィルタリング処理
  const filterStudents = useCallback(async (
    students: StudentActivity[],
    filters: any
  ): Promise<StudentActivity[] | null> => {
    return executeTask<StudentActivity[]>('FILTER_STUDENTS', { students, filters });
  }, [executeTask]);

  // 統計計算処理
  const calculateStatistics = useCallback(async (
    students: StudentActivity[]
  ): Promise<any | null> => {
    return executeTask('CALCULATE_STATISTICS', { students });
  }, [executeTask]);

  // 高度な分析処理
  const generateAnalytics = useCallback(async (
    students: StudentActivity[]
  ): Promise<any | null> => {
    return executeTask('GENERATE_ANALYTICS', { students });
  }, [executeTask]);

  // ソート処理
  const sortStudents = useCallback(async (
    students: StudentActivity[],
    sortBy: string,
    sortOrder: 'asc' | 'desc'
  ): Promise<StudentActivity[] | null> => {
    return executeTask<StudentActivity[]>('SORT_STUDENTS', { students, sortBy, sortOrder });
  }, [executeTask]);

  // バッチ処理
  const processBatch = useCallback(async (tasks: Array<{
    type: ProcessingTask['type'];
    data: any;
    key: string;
  }>) => {
    const results = await Promise.all(
      tasks.map(task => executeTask(task.type, task.data))
    );
    
    return tasks.reduce((acc, task, index) => {
      acc[task.key] = results[index];
      return acc;
    }, {} as Record<string, any>);
  }, [executeTask]);

  return {
    // 処理関数
    filterStudents,
    calculateStatistics,
    generateAnalytics,
    sortStudents,
    processBatch,
    
    // 状態
    ...state,
    
    // ユーティリティ
    isWorkerAvailable: !!workerRef.current,
    clearPendingTasks: () => {
      pendingTasks.current.clear();
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };
};

// フォールバック処理の実装
function filterStudentsFallback(students: StudentActivity[], filters: any): StudentActivity[] {
  return students.filter(student => {
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matches = 
        student.userName.toLowerCase().includes(query) ||
        student.emailAddress.toLowerCase().includes(query) ||
        (student.teamName && student.teamName.toLowerCase().includes(query));
      if (!matches) return false;
    }

    if (filters.statusFilter && filters.statusFilter !== 'all') {
      if (filters.statusFilter === 'help' && !student.isRequestingHelp) return false;
      if (filters.statusFilter === 'active' && student.status !== 'active') return false;
      if (filters.statusFilter === 'inactive' && student.status === 'active') return false;
    }

    return true;
  });
}

function calculateStatisticsFallback(students: StudentActivity[]) {
  return {
    total: students.length,
    active: students.filter(s => s.status === 'active').length,
    helpRequesting: students.filter(s => s.isRequestingHelp).length,
    averageExecutions: students.reduce((sum, s) => sum + (s.cellExecutions || 0), 0) / students.length || 0
  };
}

function sortStudentsFallback(
  students: StudentActivity[],
  sortBy: string,
  sortOrder: 'asc' | 'desc'
): StudentActivity[] {
  return [...students].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.userName.localeCompare(b.userName);
        break;
      case 'executions':
        comparison = (a.cellExecutions || 0) - (b.cellExecutions || 0);
        break;
      default:
        comparison = 0;
    }
    
    return sortOrder === 'desc' ? -comparison : comparison;
  });
}

export default useWorkerProcessing;