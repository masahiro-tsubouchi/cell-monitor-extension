/**
 * Web Worker 互換性テストユーティリティ
 * ブラウザ環境でのWorker実行可能性を検証
 */

interface WorkerTestResult {
  supported: boolean;
  error?: string;
  details?: {
    workerCreated: boolean;
    messageReceived: boolean;
    processingTime: number;
    testData?: any;
  };
}

/**
 * Web Worker の基本動作テスト
 */
export const testWorkerCompatibility = async (timeoutMs: number = 5000): Promise<WorkerTestResult> => {
  try {
    // Worker サポート確認
    if (typeof Worker === 'undefined') {
      return {
        supported: false,
        error: 'Web Worker not supported in this environment'
      };
    }

    const startTime = performance.now();
    let workerCreated = false;
    let messageReceived = false;

    // Worker 作成テスト
    const worker = new Worker(
      new URL('../workers/dataProcessor.worker.ts', import.meta.url)
    );
    workerCreated = true;

    // テストデータ
    const testStudents = [
      {
        id: 'test-1',
        emailAddress: 'test1@university.edu',
        userName: 'Test Student 1',
        status: 'active' as const,
        cellExecutions: 5,
        errorCount: 0,
        isRequestingHelp: false,
        teamName: 'Team A'
      },
      {
        id: 'test-2', 
        emailAddress: 'test2@university.edu',
        userName: 'Test Student 2',
        status: 'idle' as const,
        cellExecutions: 2,
        errorCount: 1,
        isRequestingHelp: true,
        teamName: 'Team B'
      }
    ];

    // Worker 通信テスト
    const testResult = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Worker test timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      worker.onmessage = (e) => {
        clearTimeout(timeout);
        messageReceived = true;
        resolve(e.data);
      };

      worker.onerror = (error) => {
        clearTimeout(timeout);
        reject(new Error(`Worker error: ${error.message}`));
      };

      // テストメッセージ送信
      worker.postMessage({
        type: 'FILTER_STUDENTS',
        data: {
          students: testStudents,
          filters: { statusFilter: 'all' }
        },
        taskId: 'compatibility-test'
      });
    });

    // Worker 終了
    worker.terminate();

    const processingTime = performance.now() - startTime;

    return {
      supported: true,
      details: {
        workerCreated,
        messageReceived,
        processingTime,
        testData: testResult
      }
    };

  } catch (error: any) {
    return {
      supported: false,
      error: error.message || 'Unknown worker test error',
      details: {
        workerCreated: false,
        messageReceived: false,
        processingTime: 0
      }
    };
  }
};

/**
 * より詳細なWorker性能テスト
 */
export const testWorkerPerformance = async (): Promise<{
  basicTest: WorkerTestResult;
  performanceTest?: {
    smallDataset: number;
    largeDataset: number;
    multipleOperations: number;
  };
}> => {
  // 基本テスト
  const basicTest = await testWorkerCompatibility();
  
  if (!basicTest.supported) {
    return { basicTest };
  }

  try {
    // 性能テスト用データ生成
    const generateTestData = (count: number) => {
      return Array.from({ length: count }, (_, i) => ({
        id: `test-${i}`,
        emailAddress: `test${i}@university.edu`,
        userName: `Test Student ${i}`,
        status: i % 2 === 0 ? 'active' as const : 'idle' as const,
        cellExecutions: Math.floor(Math.random() * 20),
        errorCount: Math.floor(Math.random() * 3),
        isRequestingHelp: Math.random() > 0.8,
        teamName: `Team ${String.fromCharCode(65 + (i % 5))}`
      }));
    };

    // 小データセットテスト（100件）
    const smallStart = performance.now();
    await testWorkerWithData(generateTestData(100));
    const smallDataset = performance.now() - smallStart;

    // 大データセットテスト（1000件）
    const largeStart = performance.now();
    await testWorkerWithData(generateTestData(1000));
    const largeDataset = performance.now() - largeStart;

    // 複数操作テスト
    const multiStart = performance.now();
    await Promise.all([
      testWorkerWithData(generateTestData(200)),
      testWorkerWithData(generateTestData(200)),
      testWorkerWithData(generateTestData(200))
    ]);
    const multipleOperations = performance.now() - multiStart;

    return {
      basicTest,
      performanceTest: {
        smallDataset,
        largeDataset,
        multipleOperations
      }
    };

  } catch (error) {
    return {
      basicTest: {
        ...basicTest,
        error: `Performance test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    };
  }
};

/**
 * 指定データでWorkerテスト実行
 */
const testWorkerWithData = async (students: any[]): Promise<any> => {
  const worker = new Worker(
    new URL('../workers/dataProcessor.worker.ts', import.meta.url)
  );

  try {
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker performance test timeout'));
      }, 10000);

      worker.onmessage = (e) => {
        clearTimeout(timeout);
        resolve(e.data);
      };

      worker.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };

      worker.postMessage({
        type: 'CALCULATE_STATISTICS',
        data: { students },
        taskId: `perf-test-${Date.now()}`
      });
    });
  } finally {
    worker.terminate();
  }
};

/**
 * Worker互換性情報の表示用フォーマット
 */
export const formatWorkerTestResults = (result: WorkerTestResult): string => {
  if (!result.supported) {
    return `❌ Web Worker非対応: ${result.error}`;
  }

  const { details } = result;
  if (!details) {
    return '✅ Web Worker基本対応';
  }

  return `✅ Web Worker対応確認済み
- Worker作成: ${details.workerCreated ? '✅' : '❌'}
- メッセージ通信: ${details.messageReceived ? '✅' : '❌'}
- 処理時間: ${details.processingTime.toFixed(2)}ms
- テストデータ処理: ${details.testData ? '✅' : '❌'}`;
};