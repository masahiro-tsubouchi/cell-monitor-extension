/**
 * Phase 2実装の自動テストスクリプト
 * JupyterLab環境で実行するブラウザコンソール用スクリプト
 */

class Phase2AutomatedTests {
    constructor() {
        this.results = {
            connectionPool: [],
            deduplication: [],
            memory: [],
            performance: []
        };
        this.startTime = Date.now();
    }

    /**
     * メモリ使用量を記録
     */
    recordMemoryUsage(label) {
        if (!performance.memory) {
            console.warn('performance.memory not available');
            return null;
        }
        
        const memory = {
            label,
            timestamp: Date.now(),
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
        };
        
        this.results.memory.push(memory);
        console.log(`📊 [${label}] Memory: ${memory.used}MB / ${memory.total}MB (${memory.limit}MB limit)`);
        return memory;
    }

    /**
     * HTTP接続プール効果をテスト
     */
    async testConnectionPool() {
        console.log('🔍 Testing HTTP Connection Pool...');
        
        // ネットワーク監視開始
        const networkEntries = [];
        const observer = new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => {
                if (entry.name.includes('events') || entry.name.includes('cell-monitor')) {
                    networkEntries.push({
                        name: entry.name,
                        startTime: entry.startTime,
                        duration: entry.duration,
                        connectStart: entry.connectStart,
                        connectEnd: entry.connectEnd,
                        domainLookupStart: entry.domainLookupStart,
                        domainLookupEnd: entry.domainLookupEnd
                    });
                }
            });
        });
        observer.observe({entryTypes: ['navigation', 'resource']});
        
        this.recordMemoryUsage('ConnectionPool-Start');
        
        // 複数回のセル実行をシミュレート
        for (let i = 0; i < 5; i++) {
            await this.simulateCellExecution(`connection-pool-test-${i}`);
            await this.delay(200);
        }
        
        observer.disconnect();
        this.results.connectionPool = networkEntries;
        this.recordMemoryUsage('ConnectionPool-End');
        
        console.log('✅ Connection Pool Test Completed');
        return networkEntries;
    }

    /**
     * 重複送信防止効果をテスト
     */
    async testDeduplication() {
        console.log('🔍 Testing Request Deduplication...');
        
        this.recordMemoryUsage('Deduplication-Start');
        
        const testCellId = 'dedup-test-cell-' + Date.now();
        const networkRequestCount = this.countNetworkRequests();
        
        // 同じセルを短時間で複数回実行（重複送信シミュレート）
        const promises = [];
        for (let i = 0; i < 5; i++) {
            promises.push(this.simulateCellExecution(testCellId, `duplicate-test-${i}`));
        }
        
        await Promise.all(promises);
        await this.delay(1000); // 送信完了を待つ
        
        const finalNetworkRequestCount = this.countNetworkRequests();
        const actualRequests = finalNetworkRequestCount - networkRequestCount;
        
        this.results.deduplication.push({
            expectedRequests: 5,
            actualRequests: actualRequests,
            deduplicationEffective: actualRequests < 5,
            timestamp: Date.now()
        });
        
        this.recordMemoryUsage('Deduplication-End');
        
        console.log(`📊 Deduplication Test: ${actualRequests} requests sent (expected: 1-2)`);
        console.log('✅ Request Deduplication Test Completed');
        
        return actualRequests;
    }

    /**
     * 長時間稼働メモリリークテスト
     */
    async testMemoryLeak(durationMinutes = 5) {
        console.log(`🔍 Testing Memory Leak for ${durationMinutes} minutes...`);
        
        const startMemory = this.recordMemoryUsage('MemoryLeak-Start');
        const endTime = Date.now() + (durationMinutes * 60 * 1000);
        let iterationCount = 0;
        
        while (Date.now() < endTime) {
            // セル実行をシミュレート
            await this.simulateCellExecution(`memory-test-${iterationCount}`);
            
            iterationCount++;
            
            // 30秒ごとにメモリ記録
            if (iterationCount % 10 === 0) {
                this.recordMemoryUsage(`MemoryLeak-Iteration-${iterationCount}`);
                
                // ガベージコレクションを促進
                if (window.gc) {
                    window.gc();
                }
            }
            
            await this.delay(3000); // 3秒間隔
        }
        
        const endMemory = this.recordMemoryUsage('MemoryLeak-End');
        const memoryIncrease = endMemory.used - startMemory.used;
        
        console.log(`📊 Memory Leak Test: ${memoryIncrease}MB increase over ${durationMinutes} minutes`);
        console.log(`📊 Iterations: ${iterationCount}`);
        
        const leakDetected = memoryIncrease > 50; // 50MB以上の増加をリークと判定
        console.log(leakDetected ? '❌ Memory leak detected!' : '✅ No significant memory leak');
        
        return { memoryIncrease, iterationCount, leakDetected };
    }

    /**
     * パフォーマンス統合テスト
     */
    async testPerformance() {
        console.log('🔍 Testing Overall Performance...');
        
        const startTime = performance.now();
        this.recordMemoryUsage('Performance-Start');
        
        // 接続プールテスト
        await this.testConnectionPool();
        
        // 重複送信防止テスト
        const dedupRequests = await this.testDeduplication();
        
        // 短期メモリテスト（2分）
        const memoryResult = await this.testMemoryLeak(2);
        
        const totalTime = performance.now() - startTime;
        this.recordMemoryUsage('Performance-End');
        
        const report = {
            totalDuration: Math.round(totalTime),
            connectionPoolEffective: this.results.connectionPool.length > 0,
            deduplicationEffective: dedupRequests < 3,
            memoryStable: !memoryResult.leakDetected,
            overallScore: this.calculateOverallScore()
        };
        
        console.log('📊 Performance Test Report:', report);
        return report;
    }

    /**
     * セル実行をシミュレート
     */
    async simulateCellExecution(cellId, code = 'print("test")') {
        // 実際のJupyterLab APIを呼び出す代わりに、
        // DataTransmissionServiceに直接データを送信
        const eventData = {
            eventId: 'test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            eventType: 'cell_executed',
            eventTime: new Date().toISOString(),
            emailAddress: 'test@example.com',
            userName: 'TestUser',
            teamName: 'TestTeam',
            sessionId: 'test-session',
            notebookPath: '/test/notebook.ipynb',
            cellId: cellId,
            cellIndex: 0,
            cellType: 'code',
            code: code,
            executionCount: 1,
            hasError: false,
            result: 'test output',
            executionDurationMs: 100
        };

        // Phase 2実装されたDataTransmissionServiceを呼び出し
        if (window.cellMonitorService && window.cellMonitorService.dataTransmissionService) {
            try {
                await window.cellMonitorService.dataTransmissionService.sendProgressData([eventData]);
            } catch (error) {
                console.warn('Failed to send simulated data:', error);
            }
        }
    }

    /**
     * ネットワークリクエスト数をカウント
     */
    countNetworkRequests() {
        return performance.getEntriesByType('resource')
            .filter(entry => entry.name.includes('events') || entry.name.includes('cell-monitor'))
            .length;
    }

    /**
     * 総合スコアを計算
     */
    calculateOverallScore() {
        let score = 100;
        
        // メモリリークが検出された場合
        if (this.results.memory.length >= 2) {
            const memoryIncrease = this.results.memory[this.results.memory.length - 1].used - 
                                 this.results.memory[0].used;
            if (memoryIncrease > 20) score -= 30; // 20MB以上の増加
            else if (memoryIncrease > 10) score -= 15;
        }
        
        return Math.max(0, score);
    }

    /**
     * 遅延ユーティリティ
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * テスト結果をエクスポート
     */
    exportResults() {
        const report = {
            testTimestamp: new Date().toISOString(),
            duration: Date.now() - this.startTime,
            results: this.results,
            summary: {
                memoryPeakUsage: Math.max(...this.results.memory.map(m => m.used)),
                memoryStable: this.results.memory.length < 2 || 
                    (this.results.memory[this.results.memory.length - 1].used - this.results.memory[0].used) < 20,
                connectionPoolActive: this.results.connectionPool.length > 0,
                deduplicationActive: this.results.deduplication.some(d => d.deduplicationEffective)
            }
        };
        
        console.log('📋 Complete Test Report:', JSON.stringify(report, null, 2));
        return report;
    }
}

// 使用方法
console.log('🚀 Phase 2 Automated Test Suite Ready');
console.log('使用方法:');
console.log('const tester = new Phase2AutomatedTests();');
console.log('await tester.testPerformance(); // 統合テスト実行');
console.log('tester.exportResults(); // 結果エクスポート');

// グローバルに公開
window.Phase2AutomatedTests = Phase2AutomatedTests;