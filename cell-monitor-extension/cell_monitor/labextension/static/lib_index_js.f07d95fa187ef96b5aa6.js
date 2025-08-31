"use strict";
(self["webpackChunkcell_monitor"] = self["webpackChunkcell_monitor"] || []).push([["lib_index_js"],{

/***/ "./lib/core/EventManager.js":
/*!**********************************!*\
  !*** ./lib/core/EventManager.js ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   EventManager: () => (/* binding */ EventManager)
/* harmony export */ });
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @jupyterlab/notebook */ "webpack/sharing/consume/default/@jupyterlab/notebook");
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @jupyterlab/apputils */ "webpack/sharing/consume/default/@jupyterlab/apputils");
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils */ "./lib/utils/logger.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils */ "./lib/utils/uuid.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils */ "./lib/utils/errorHandler.js");
/**
 * イベント管理クラス
 * JupyterLabのノートブックイベントを監視し、学習進捗データを収集・送信
 */



class EventManager {
    constructor(notebookTracker, settingsManager, dataTransmissionService) {
        this.executionHandlerRegistered = false;
        this.helpSession = new Map();
        this.helpIntervals = new Map(); // Phase 2.3: 継続HELP送信
        this.helpSessionTimestamps = new Map(); // Phase 2.3: タイムスタンプ管理
        this.processedCells = new Map();
        this.logger = (0,_utils__WEBPACK_IMPORTED_MODULE_2__.createLogger)('EventManager');
        this.notebookTracker = notebookTracker;
        this.settingsManager = settingsManager;
        this.dataTransmissionService = dataTransmissionService;
        this.sessionId = (0,_utils__WEBPACK_IMPORTED_MODULE_3__.generateUUID)();
    }
    /**
     * イベントハンドラを初期化
     */
    initialize() {
        this.setupNotebookTracking();
        this.setupExecutionTracking();
    }
    /**
     * ノートブック関連イベントの追跡設定
     */
    setupNotebookTracking() {
        this.notebookTracker.widgetAdded.connect((sender, widget) => {
            const notebookPath = widget.context.path || 'unknown';
            this.sendNotebookEvent('notebook_opened', notebookPath);
            // 元のコードと同じように各ノートブックのツールバーにヘルプボタンを追加
            this.addHelpButtonToNotebook(widget);
        });
    }
    /**
     * セル実行イベントの追跡設定（元のコードと同じ方式）
     */
    setupExecutionTracking() {
        if (this.executionHandlerRegistered) {
            return;
        }
        // 元のコードと同じ方式でNotebookActions.executed.connectを使用
        _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_0__.NotebookActions.executed.connect((_, args) => {
            const { cell } = args;
            this.processCellExecution(cell);
        });
        this.executionHandlerRegistered = true;
        this.logger.info('Cell execution handler registered (once)');
    }
    /**
     * セル実行を処理（元のコードと完全に同じロジック）
     */
    processCellExecution(cell) {
        var _a, _b;
        try {
            if (!cell || !cell.model)
                return;
            // 処理開始時間（パフォーマンス計測用）
            const startTime = performance.now();
            const cellId = cell.model.id;
            // 重複処理防止機構（元のコードと同じ）
            const currentTime = Date.now();
            const lastTime = this.processedCells.get(cellId) || 0;
            const rawTimeDiff = currentTime - lastTime;
            const timeDiff = Math.max(0, Math.min(rawTimeDiff, 300000)); // 5分上限
            // 異常値検出とログ出力
            if (rawTimeDiff > 300000) {
                this.logger.warn('Abnormal timestamp detected', {
                    currentTime,
                    lastTime,
                    rawDiff: rawTimeDiff
                });
            }
            this.logger.perfDebug('Cell execution processing', {
                cellId,
                timeSinceLastProcessing: timeDiff,
                alreadyProcessed: this.processedCells.has(cellId),
                memoryUsage: `${this.processedCells.size} / 50 max`
            });
            // 500ms以内の重複処理を防止（デバウンス）
            if (timeDiff < 500 && this.processedCells.has(cellId)) {
                this.logger.debug('Skipping duplicate cell execution processing', { cellId, timeDiff });
                return;
            }
            // 処理済みマークを更新
            this.processedCells.set(cellId, currentTime);
            // 軽量メモリ管理（受講生PCの負荷最小化）
            if (this.processedCells.size >= 50) { // 100→50に削減
                // 重いソート処理を避け、最初のエントリを削除（FIFO方式）
                const firstKey = this.processedCells.keys().next().value;
                if (firstKey) {
                    this.processedCells.delete(firstKey);
                    this.logger.debug('Memory cleanup: removed oldest cell entry', {
                        removedKey: firstKey,
                        currentSize: this.processedCells.size
                    });
                }
            }
            // 安全にセルのコードを取得する方法
            let code = '';
            try {
                if (cell.model.sharedModel && cell.model.sharedModel.source) {
                    code = cell.model.sharedModel.source;
                }
                else if (cell.model.value && cell.model.value.text) {
                    code = cell.model.value.text;
                }
                else if (cell.editor && cell.editor.model && cell.editor.model.value) {
                    code = cell.editor.model.value.text;
                }
            }
            catch (error) {
                this.logger.warn('Failed to get cell code:', error);
            }
            // Get notebook widget from cell
            const notebookWidget = this.notebookTracker.currentWidget;
            if (!notebookWidget)
                return;
            // Get notebook path
            const notebookPath = ((_a = notebookWidget.context) === null || _a === void 0 ? void 0 : _a.path) || '';
            // Get cell index and type
            let cellIndex = undefined;
            let cellType = undefined;
            try {
                // セルのインデックスを取得
                const cells = notebookWidget.content.widgets;
                for (let i = 0; i < cells.length; i++) {
                    if (cells[i].model.id === cellId) {
                        cellIndex = i;
                        break;
                    }
                }
                // セルのタイプを取得
                if (cell.model.type) {
                    cellType = cell.model.type;
                }
            }
            catch (error) {
                this.logger.warn('Failed to get cell index or type:', error);
            }
            // Get execution results
            let hasError = false;
            let resultText = '';
            let errorMessage = '';
            let executionCount = undefined;
            if (cell.outputArea) {
                // 実行カウントを取得
                try {
                    executionCount = cell.model.executionCount || undefined;
                }
                catch (error) {
                    this.logger.warn('Failed to get execution count:', error);
                }
                const outputs = cell.outputArea.model.toJSON();
                for (const output of outputs) {
                    if (output.output_type === 'error') {
                        hasError = true;
                        errorMessage = `${output.ename}: ${output.evalue}`;
                        resultText = errorMessage;
                        break;
                    }
                    else if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
                        if (output.data) {
                            if (output.data['text/plain']) {
                                resultText = output.data['text/plain'];
                            }
                        }
                    }
                }
            }
            // 実行時間の計測
            const endTime = performance.now();
            const executionDurationMs = Math.round(endTime - startTime);
            // ユーザー情報を取得
            const { emailAddress, userName, teamName } = this.settingsManager.getUserInfo();
            // 新しいデータモデル
            const progressData = {
                eventId: (0,_utils__WEBPACK_IMPORTED_MODULE_3__.generateUUID)(),
                eventType: 'cell_executed',
                eventTime: new Date().toISOString(),
                emailAddress,
                teamName,
                userName,
                sessionId: this.sessionId,
                notebookPath,
                cellId,
                cellIndex,
                cellType: cellType,
                code,
                executionCount,
                hasError,
                errorMessage: hasError ? errorMessage : undefined,
                result: resultText,
                executionDurationMs
            };
            // データを送信
            this.dataTransmissionService.sendProgressData([progressData]);
        }
        catch (error) {
            (0,_utils__WEBPACK_IMPORTED_MODULE_4__.handleCellProcessingError)(error instanceof Error ? error : new Error(String(error)), 'Cell execution processing', { cellId: (_b = cell === null || cell === void 0 ? void 0 : cell.model) === null || _b === void 0 ? void 0 : _b.id });
        }
    }
    /**
     * ノートブックイベントを送信
     */
    async sendNotebookEvent(eventType, notebookPath) {
        try {
            const { emailAddress, userName, teamName } = this.settingsManager.getUserInfo();
            const progressData = {
                eventId: (0,_utils__WEBPACK_IMPORTED_MODULE_3__.generateUUID)(),
                eventType,
                eventTime: new Date().toISOString(),
                emailAddress,
                teamName,
                userName,
                sessionId: this.sessionId,
                notebookPath
            };
            await this.dataTransmissionService.sendProgressData([progressData]);
        }
        catch (error) {
            (0,_utils__WEBPACK_IMPORTED_MODULE_4__.handleCellProcessingError)(error instanceof Error ? error : new Error(String(error)), 'Notebook event transmission', { eventType, notebookPath });
        }
    }
    /**
     * ヘルプセッションを開始（Phase 2.3: 継続HELP送信対応）
     */
    startHelpSession() {
        const currentWidget = this.notebookTracker.currentWidget;
        if (!currentWidget) {
            this.logger.warn('No notebook widget available for help session start');
            return;
        }
        const notebookPath = currentWidget.context.path || 'unknown';
        // 既に継続送信中の場合は何もしない
        if (this.helpIntervals.has(notebookPath)) {
            this.logger.debug('Help session already active', {
                notebookPath: notebookPath.substring(0, 20) + '...'
            });
            return;
        }
        // 即座に最初のHELPを送信
        this.sendHelpEvent(notebookPath);
        // 10秒間隔での継続送信を開始
        const interval = setInterval(() => {
            this.sendHelpEvent(notebookPath);
        }, 10000);
        this.helpIntervals.set(notebookPath, interval);
        this.helpSession.set(notebookPath, true);
        this.helpSessionTimestamps.set(notebookPath, Date.now());
        this.logger.info('Continuous help session started', {
            notebookPath: notebookPath.substring(0, 20) + '...',
            intervalId: 'set'
        });
        // UI通知
        const { showNotifications } = this.settingsManager.getNotificationSettings();
        if (showNotifications) {
            _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__.Notification.info('継続ヘルプセッションを開始しました', { autoClose: 2000 });
        }
    }
    /**
     * ヘルプセッションを停止（Phase 2.3: バルククリーンアップ対応）
     */
    stopHelpSession() {
        const currentWidget = this.notebookTracker.currentWidget;
        if (!currentWidget) {
            this.logger.warn('No notebook widget available for help session stop');
            return;
        }
        const notebookPath = currentWidget.context.path || 'unknown';
        // 継続送信を停止
        const interval = this.helpIntervals.get(notebookPath);
        if (interval) {
            clearInterval(interval);
            this.helpIntervals.delete(notebookPath);
            this.logger.debug('Continuous help sending stopped', {
                notebookPath: notebookPath.substring(0, 20) + '...'
            });
        }
        // 最終のhelp_stopイベントを送信
        this.sendHelpStopEvent(notebookPath);
        // Phase 2.3: バルククリーンアップ実行（大幅メモリ削減）
        this.bulkCleanupOldSessions();
        this.helpSession.set(notebookPath, false);
        // UI通知
        const { showNotifications } = this.settingsManager.getNotificationSettings();
        if (showNotifications) {
            _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__.Notification.success('ヘルプセッション停止（メモリクリーンアップ実行）', { autoClose: 2000 });
        }
        this.logger.info('Help session stopped with bulk cleanup', {
            notebookPath: notebookPath.substring(0, 20) + '...',
            remainingSessions: this.helpSession.size
        });
    }
    /**
     * ノートブックのツールバーにヘルプボタンを追加（元のコードと同じ方式）
     */
    addHelpButtonToNotebook(widget) {
        if (widget.toolbar) {
            try {
                // 既存のヘルプボタンを削除（重複防止）
                const existingHelpButton = widget.toolbar.node.querySelector('.jp-help-button');
                if (existingHelpButton) {
                    this.logger.debug('Removing existing help button to prevent duplicates');
                    existingHelpButton.remove();
                }
                const helpButton = this.createHelpButton();
                widget.toolbar.addItem('help-button', helpButton);
                this.logger.info('Help button added to notebook toolbar');
            }
            catch (error) {
                (0,_utils__WEBPACK_IMPORTED_MODULE_4__.handleUIError)(error instanceof Error ? error : new Error(String(error)), 'Help button creation', 'ヘルプボタンの作成に失敗しました。');
            }
        }
    }
    /**
     * ヘルプボタンを作成する（DOM安全版）
     */
    createHelpButton() {
        this.logger.debug('Creating help button with DOM-safe implementation...');
        const helpButton = new _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__.ToolbarButton({
            className: 'jp-help-button jp-ToolbarButton',
            onClick: () => {
                this.logger.debug('Help button clicked!');
                this.toggleHelpState(helpButton);
            },
            tooltip: 'ヘルプ要請ボタン - クリックでON/OFF切替',
            label: '🆘 講師に助けを求める',
            iconClass: 'jp-help-button__icon',
            enabled: true
        });
        this.logger.debug('ToolbarButton created with persistent onClick handler');
        return helpButton;
    }
    /**
     * ヘルプ状態を切り替え（シンプルトグル）
     */
    toggleHelpState(button) {
        const currentWidget = this.notebookTracker.currentWidget;
        if (!currentWidget) {
            _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__.Notification.warning('ノートブックが開かれていません');
            return;
        }
        // UI状態で判定（シンプルで確実）
        const isCurrentlyActive = button.node.classList.contains('jp-help-button--active');
        this.logger.debug('toggleHelpState called, currently active:', isCurrentlyActive);
        if (!isCurrentlyActive) {
            // OFF → ON: 即座にUI切替 + 背景でサーバー通信
            this.activateHelpButton(button);
            this.startHelpSession(); // await削除、エラーは内部処理
        }
        else {
            // ON → OFF: 即座にUI切替 + 背景でサーバー通信
            this.deactivateHelpButton(button);
            this.stopHelpSession(); // await削除、エラーは内部処理
        }
    }
    /**
     * ヘルプボタンをアクティブ状態に切り替え（DOM安全版）
     */
    activateHelpButton(button) {
        // CSS状態変更（イベントハンドラー保持）
        button.node.classList.add('jp-help-button--active');
        // テキストコンテンツのみ変更（DOM構造保持）
        const textElement = button.node.querySelector('.jp-ToolbarButtonComponent-label');
        if (textElement) {
            textElement.textContent = '🆘 ヘルプ要請中...';
        }
        // タイトル属性でツールチップ更新
        button.node.setAttribute('title', 'ヘルプ要請中 - クリックで停止');
        // 内部状態も更新
        const currentWidget = this.notebookTracker.currentWidget;
        if (currentWidget) {
            const notebookPath = currentWidget.context.path || 'unknown';
            this.helpSession.set(notebookPath, true);
        }
        this.logger.debug('Help button activated with DOM-safe method');
    }
    /**
     * ヘルプボタンを非アクティブ状態に切り替え（DOM安全版）
     */
    deactivateHelpButton(button) {
        // CSS状態変更（イベントハンドラー保持）
        button.node.classList.remove('jp-help-button--active');
        // テキストコンテンツのみ変更（DOM構造保持）
        const textElement = button.node.querySelector('.jp-ToolbarButtonComponent-label');
        if (textElement) {
            textElement.textContent = '🆘 講師に助けを求める';
        }
        // タイトル属性でツールチップ更新
        button.node.setAttribute('title', 'ヘルプ要請ボタン - クリックでON/OFF切替');
        // 内部状態も更新
        const currentWidget = this.notebookTracker.currentWidget;
        if (currentWidget) {
            const notebookPath = currentWidget.context.path || 'unknown';
            this.helpSession.set(notebookPath, false);
        }
        this.logger.debug('Help button deactivated with DOM-safe method');
    }
    /**
     * Phase 2.3: 単一HELP送信（継続送信用）
     */
    sendHelpEvent(notebookPath) {
        const { emailAddress, userName, teamName } = this.settingsManager.getUserInfo();
        const progressData = {
            eventId: (0,_utils__WEBPACK_IMPORTED_MODULE_3__.generateUUID)(),
            eventType: 'help',
            eventTime: new Date().toISOString(),
            emailAddress,
            teamName,
            userName,
            sessionId: this.sessionId,
            notebookPath
        };
        // 背景でサーバー通信（エラーは内部処理のみ）
        this.dataTransmissionService.sendProgressData([progressData])
            .then(() => {
            this.logger.debug('Continuous help event sent', {
                notebookPath: notebookPath.substring(0, 20) + '...'
            });
        })
            .catch((error) => {
            this.logger.error('Failed to send continuous help event:', error);
        });
    }
    /**
     * Phase 2.3: HELP停止イベント送信
     */
    sendHelpStopEvent(notebookPath) {
        const { emailAddress, userName, teamName } = this.settingsManager.getUserInfo();
        const progressData = {
            eventId: (0,_utils__WEBPACK_IMPORTED_MODULE_3__.generateUUID)(),
            eventType: 'help_stop',
            eventTime: new Date().toISOString(),
            emailAddress,
            teamName,
            userName,
            sessionId: this.sessionId,
            notebookPath
        };
        // 背景でサーバー通信
        this.dataTransmissionService.sendProgressData([progressData])
            .then(() => {
            this.logger.debug('Help stop event sent', {
                notebookPath: notebookPath.substring(0, 20) + '...'
            });
        })
            .catch((error) => {
            this.logger.error('Failed to send help stop event:', error);
        });
    }
    /**
     * Phase 2.3: バルククリーンアップ（大幅メモリ削減）
     */
    bulkCleanupOldSessions() {
        const now = Date.now();
        const cutoffTime = now - (30 * 60 * 1000); // 30分前
        let removedCount = 0;
        this.logger.debug('Starting bulk cleanup', {
            totalSessions: this.helpSession.size,
            cutoffTime: new Date(cutoffTime).toISOString()
        });
        // 30分以上前のセッションを全て削除
        for (const [key, timestamp] of this.helpSessionTimestamps.entries()) {
            if (timestamp < cutoffTime) {
                this.helpSession.delete(key);
                this.helpSessionTimestamps.delete(key);
                // 対応するintervalも確認・削除
                const interval = this.helpIntervals.get(key);
                if (interval) {
                    clearInterval(interval);
                    this.helpIntervals.delete(key);
                }
                removedCount++;
            }
        }
        // 緊急時のFIFO制限も併用（フェイルセーフ）
        this.emergencyFIFOCleanup();
        this.logger.info('Bulk cleanup completed', {
            removedSessions: removedCount,
            remainingSessions: this.helpSession.size,
            memoryReduction: `${removedCount * 0.4}MB estimated`
        });
    }
    /**
     * Phase 2.3: 緊急時FIFO制限（フェイルセーフ機能）
     */
    emergencyFIFOCleanup() {
        if (this.helpSession.size >= EventManager.MAX_HELP_SESSIONS) {
            const firstKey = this.helpSession.keys().next().value;
            if (firstKey) {
                this.helpSession.delete(firstKey);
                this.helpSessionTimestamps.delete(firstKey);
                const interval = this.helpIntervals.get(firstKey);
                if (interval) {
                    clearInterval(interval);
                    this.helpIntervals.delete(firstKey);
                }
                this.logger.debug('Emergency FIFO cleanup executed', {
                    removedKey: firstKey.substring(0, 10) + '***',
                    currentSize: this.helpSession.size
                });
            }
        }
    }
    /**
     * 新しいセッションを開始（Phase 2.3: 全クリーンアップ強化）
     */
    startNewSession() {
        // 全ての継続送信を停止
        for (const [, interval] of this.helpIntervals.entries()) {
            clearInterval(interval);
        }
        this.helpIntervals.clear();
        this.sessionId = (0,_utils__WEBPACK_IMPORTED_MODULE_3__.generateUUID)();
        this.helpSession.clear();
        this.helpSessionTimestamps.clear();
        this.processedCells.clear();
        // this.lastProcessedTime = 0;
        this.logger.info('New session started with full cleanup:', {
            sessionId: this.sessionId,
            memoryCleanup: 'complete'
        });
    }
}
// private lastProcessedTime: number = 0; // 将来の実装用に残しておく
EventManager.MAX_HELP_SESSIONS = 20; // Phase 2.3: 緊急時FIFO制限


/***/ }),

/***/ "./lib/core/SettingsManager.js":
/*!*************************************!*\
  !*** ./lib/core/SettingsManager.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SettingsManager: () => (/* binding */ SettingsManager)
/* harmony export */ });
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils */ "./lib/utils/logger.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils */ "./lib/utils/errorHandler.js");

/**
 * チーム名バリデーション
 */
function validateTeamName(teamName) {
    const pattern = /^チーム([A-Z]|[1-9][0-9]?)$/;
    if (!teamName) {
        return { isValid: false, error: 'チーム名は必須です' };
    }
    if (!pattern.test(teamName)) {
        return {
            isValid: false,
            error: 'チーム名は「チームA-Z」または「チーム1-99」の形式で入力してください（例: チームA, チーム1, チーム10）'
        };
    }
    return { isValid: true };
}
/**
 * 設定管理クラス
 * JupyterLabの設定レジストリと連携してCell Monitor拡張機能の設定を管理
 */
class SettingsManager {
    constructor() {
        this.settings = null;
        this.logger = (0,_utils__WEBPACK_IMPORTED_MODULE_0__.createLogger)('SettingsManager');
        // コンストラクタは空
    }
    /**
     * 設定を初期化
     */
    async initialize(settingRegistry, pluginId) {
        try {
            this.settings = await settingRegistry.load(pluginId);
            // 設定変更の監視とリアルタイムバリデーション
            this.settings.changed.connect(() => {
                this.validateAndUpdateSettings();
            });
            // リアルタイムバリデーション設定
            this.setupRealtimeValidation(settingRegistry, pluginId);
            // 初回設定読み込み
            this.updateSettingsFromRegistry();
            this.logger.info('Settings initialized successfully');
        }
        catch (error) {
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.handleSettingsError)(error instanceof Error ? error : new Error(String(error)), 'Settings initialization', '設定の初期化に失敗しました。デフォルト設定で継続します。');
        }
    }
    /**
     * 設定レジストリから設定を更新
     */
    updateSettingsFromRegistry() {
        if (!this.settings)
            return;
        try {
            // 設定値を取得して内部状態を更新
            const serverUrl = this.settings.get('serverUrl').composite;
            const emailAddress = this.settings.get('emailAddress').composite;
            const userName = this.settings.get('userName').composite;
            const teamName = this.settings.get('teamName').composite;
            const retryAttempts = this.settings.get('retryAttempts').composite;
            const showNotifications = this.settings.get('showNotifications').composite;
            // チーム名のバリデーション
            if (teamName) {
                const validation = validateTeamName(teamName);
                if (!validation.isValid) {
                    this.logger.warn('Invalid team name detected:', validation.error);
                    // 警告を表示（UI側で処理）
                }
            }
            this.logger.debug('Settings updated from registry', {
                serverUrl: serverUrl || 'default',
                emailAddress: emailAddress || 'student001@example.com',
                userName: userName || 'Anonymous',
                teamName: teamName || 'チームA',
                retryAttempts,
                showNotifications
            });
        }
        catch (error) {
            this.logger.warn('Failed to update settings from registry:', error);
        }
    }
    /**
     * 現在の設定を取得
     */
    getSettings() {
        return this.settings;
    }
    /**
     * ユーザー情報を取得（バリデーション付き）
     */
    getUserInfo() {
        if (!this.settings) {
            return {
                emailAddress: 'student001@example.com',
                userName: 'Anonymous',
                teamName: 'チームA'
            };
        }
        const settingEmailAddress = this.settings.get('emailAddress').composite;
        const settingUserName = this.settings.get('userName').composite;
        const settingTeamName = this.settings.get('teamName').composite;
        // チーム名のバリデーション
        let validatedTeamName = settingTeamName || 'チームA';
        if (settingTeamName) {
            const validation = validateTeamName(settingTeamName);
            if (!validation.isValid) {
                this.logger.warn('Invalid team name, using default:', validation.error);
                validatedTeamName = 'チームA'; // デフォルトにフォールバック
            }
        }
        return {
            emailAddress: settingEmailAddress || 'student001@example.com',
            userName: settingUserName || 'Anonymous',
            teamName: validatedTeamName
        };
    }
    /**
     * リアルタイムバリデーション設定
     */
    setupRealtimeValidation(_settingRegistry, _pluginId) {
        // 設定エディタのDOMが変更された時の監視
        // JupyterLabの設定UIが表示されたときに入力フィールドを監視
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    this.enhanceTeamNameInput();
                }
            });
        });
        // DOM全体を監視（設定UIが動的に生成されるため）
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    /**
     * チーム名入力フィールドを強化
     */
    enhanceTeamNameInput() {
        // JupyterLabの設定UIでチーム名フィールドを探す
        const teamNameInputs = document.querySelectorAll('input[data-setting-path*="teamName"]');
        teamNameInputs.forEach((input) => {
            if (input instanceof HTMLInputElement && !input.dataset.enhanced) {
                input.dataset.enhanced = 'true';
                // リアルタイム入力監視
                input.addEventListener('input', (event) => {
                    const target = event.target;
                    const value = target.value;
                    if (value) {
                        const validation = validateTeamName(value);
                        if (validation.isValid) {
                            // 有効な入力の場合
                            target.style.borderColor = '#4caf50';
                            target.style.backgroundColor = '#f0f8f0';
                            this.clearValidationMessage(target);
                        }
                        else {
                            // 無効な入力の場合
                            target.style.borderColor = '#f44336';
                            target.style.backgroundColor = '#fdf0f0';
                            this.showValidationMessage(target, validation.error || '');
                        }
                    }
                    else {
                        // 空の場合はリセット
                        target.style.borderColor = '';
                        target.style.backgroundColor = '';
                        this.clearValidationMessage(target);
                    }
                });
                // フォーカス時のヘルプメッセージ
                input.addEventListener('focus', (event) => {
                    const target = event.target;
                    this.showHelpMessage(target);
                });
                // フォーカス外れ時のクリーンアップ
                input.addEventListener('blur', (event) => {
                    const target = event.target;
                    this.clearHelpMessage(target);
                });
            }
        });
    }
    /**
     * バリデーションメッセージを表示
     */
    showValidationMessage(input, message) {
        var _a;
        this.clearValidationMessage(input);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'team-name-validation-error';
        errorDiv.style.cssText = `
      color: #f44336;
      font-size: 12px;
      margin-top: 4px;
      padding: 4px;
      background-color: #ffebee;
      border-radius: 4px;
      border-left: 3px solid #f44336;
    `;
        errorDiv.textContent = message;
        (_a = input.parentNode) === null || _a === void 0 ? void 0 : _a.insertBefore(errorDiv, input.nextSibling);
    }
    /**
     * バリデーションメッセージをクリア
     */
    clearValidationMessage(input) {
        var _a;
        const existingError = (_a = input.parentNode) === null || _a === void 0 ? void 0 : _a.querySelector('.team-name-validation-error');
        if (existingError) {
            existingError.remove();
        }
    }
    /**
     * ヘルプメッセージを表示
     */
    showHelpMessage(input) {
        var _a;
        this.clearHelpMessage(input);
        const helpDiv = document.createElement('div');
        helpDiv.className = 'team-name-help-message';
        helpDiv.style.cssText = `
      color: #1976d2;
      font-size: 12px;
      margin-top: 4px;
      padding: 4px;
      background-color: #e3f2fd;
      border-radius: 4px;
      border-left: 3px solid #1976d2;
    `;
        helpDiv.innerHTML = `
      <strong>チーム名の形式:</strong><br>
      • チームA〜Z (例: チームA, チームB)<br>
      • チーム1〜99 (例: チーム1, チーム10)
    `;
        (_a = input.parentNode) === null || _a === void 0 ? void 0 : _a.insertBefore(helpDiv, input.nextSibling);
    }
    /**
     * ヘルプメッセージをクリア
     */
    clearHelpMessage(input) {
        var _a;
        const existingHelp = (_a = input.parentNode) === null || _a === void 0 ? void 0 : _a.querySelector('.team-name-help-message');
        if (existingHelp) {
            existingHelp.remove();
        }
    }
    /**
     * 設定変更時のバリデーションと更新
     */
    validateAndUpdateSettings() {
        this.updateSettingsFromRegistry();
        // 設定UI更新のための少し遅延した処理
        setTimeout(() => {
            this.enhanceTeamNameInput();
        }, 100);
    }
    /**
     * チーム名バリデーションメソッド（外部からアクセス可能）
     */
    validateTeamName(teamName) {
        return validateTeamName(teamName);
    }
    /**
     * サーバーURLを取得
     */
    getServerUrl() {
        if (!this.settings) {
            return 'http://localhost:8000/api/v1/events';
        }
        return this.settings.get('serverUrl').composite || 'http://localhost:8000/api/v1/events';
    }
    /**
     * リトライ回数を取得
     */
    getRetryAttempts() {
        if (!this.settings) {
            return 3;
        }
        return this.settings.get('retryAttempts').composite || 3;
    }
    /**
     * 通知設定を取得
     */
    getNotificationSettings() {
        var _a;
        if (!this.settings) {
            return {
                showNotifications: false,
                animationEnabled: false
            };
        }
        const showNotifications = this.settings.get('showNotifications').composite;
        const animationEnabled = (_a = this.settings.get('animationEnabled')) === null || _a === void 0 ? void 0 : _a.composite;
        return {
            showNotifications: showNotifications !== undefined ? showNotifications : false,
            animationEnabled: animationEnabled !== undefined ? animationEnabled : false
        };
    }
}


/***/ }),

/***/ "./lib/index.js":
/*!**********************!*\
  !*** ./lib/index.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _jupyterlab_application__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @jupyterlab/application */ "webpack/sharing/consume/default/@jupyterlab/application");
/* harmony import */ var _jupyterlab_application__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_application__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @jupyterlab/apputils */ "webpack/sharing/consume/default/@jupyterlab/apputils");
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @jupyterlab/notebook */ "webpack/sharing/consume/default/@jupyterlab/notebook");
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @jupyterlab/settingregistry */ "webpack/sharing/consume/default/@jupyterlab/settingregistry");
/* harmony import */ var _jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _core_SettingsManager__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./core/SettingsManager */ "./lib/core/SettingsManager.js");
/* harmony import */ var _core_EventManager__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./core/EventManager */ "./lib/core/EventManager.js");
/* harmony import */ var _services_DataTransmissionService__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./services/DataTransmissionService */ "./lib/services/DataTransmissionService.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./utils */ "./lib/utils/logger.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./utils */ "./lib/utils/errorHandler.js");
/**
 * Cell Monitor JupyterLab Extension
 * リファクタリング版 - モジュール化されたアーキテクチャ
 */




// 新しいモジュール化されたインポート




// プラグインの識別子
const PLUGIN_ID = 'cell-monitor:plugin';
// プラグインのメイン機能を管理するクラス
class CellMonitorPlugin {
    constructor(app, notebookTracker, settingRegistry, labShell) {
        this.logger = (0,_utils__WEBPACK_IMPORTED_MODULE_4__.createLogger)('CellMonitorPlugin');
        this.app = app;
        // 依存関係を注入してインスタンスを作成
        this.settingsManager = new _core_SettingsManager__WEBPACK_IMPORTED_MODULE_5__.SettingsManager();
        this.dataTransmissionService = new _services_DataTransmissionService__WEBPACK_IMPORTED_MODULE_6__.DataTransmissionService(this.settingsManager);
        this.eventManager = new _core_EventManager__WEBPACK_IMPORTED_MODULE_7__.EventManager(notebookTracker, this.settingsManager, this.dataTransmissionService);
        this.initialize(settingRegistry, labShell);
    }
    /**
     * プラグインの初期化
     */
    async initialize(settingRegistry, labShell) {
        try {
            this.logger.info('Initializing Cell Monitor extension...');
            // 設定管理の初期化
            await this.settingsManager.initialize(settingRegistry, PLUGIN_ID);
            // 設定変更の監視（チーム名バリデーション）
            this.setupSettingsValidation();
            // エラーハンドラーの設定を更新
            const { showNotifications } = this.settingsManager.getNotificationSettings();
            _utils__WEBPACK_IMPORTED_MODULE_8__.errorHandler.configure({ showNotifications });
            // イベント管理の初期化
            this.eventManager.initialize();
            // UIコンポーネントの初期化
            this.setupToolbarButtons(labShell);
            // 成功通知
            if (showNotifications) {
                _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__.Notification.success('Cell Monitor Extension Activated', { autoClose: 2000 });
            }
            this.logger.info('Cell Monitor extension activated successfully');
        }
        catch (error) {
            (0,_utils__WEBPACK_IMPORTED_MODULE_8__.handleInitializationError)(error instanceof Error ? error : new Error(String(error)), 'Plugin initialization');
            throw error; // JupyterLabに拡張機能の初期化失敗を知らせる
        }
    }
    /**
     * ツールバーボタンの設定
     */
    setupToolbarButtons(labShell) {
        // 新しいセッション開始ボタンのみを作成（ヘルプボタンは各ノートブックに個別追加）
        const newSessionButton = new _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__.ToolbarButton({
            label: '新セッション',
            tooltip: '新しい学習セッションを開始します',
            onClick: () => this.startNewSession(),
            className: 'jp-new-session-button'
        });
        // ツールバーに追加
        this.app.shell.add(newSessionButton, 'top', { rank: 1001 });
        this.logger.debug('New session button added to toolbar');
    }
    /**
     * 設定バリデーションの監視設定
     */
    setupSettingsValidation() {
        const settings = this.settingsManager.getSettings();
        if (!settings)
            return;
        // 設定変更を監視
        settings.changed.connect(() => {
            const userInfo = this.settingsManager.getUserInfo();
            const validation = this.settingsManager.validateTeamName(userInfo.teamName);
            if (!validation.isValid) {
                // バリデーションエラーの通知
                _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__.Notification.error(`チーム名設定エラー: ${validation.error}`, { autoClose: 5000 });
                this.logger.error('Team name validation failed:', validation.error);
            }
        });
    }
    /**
     * 新しいセッションの開始
     */
    startNewSession() {
        this.logger.info('Starting new learning session');
        // セッション開始前にチーム名をバリデーション
        const userInfo = this.settingsManager.getUserInfo();
        const validation = this.settingsManager.validateTeamName(userInfo.teamName);
        if (!validation.isValid) {
            _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__.Notification.error(`セッション開始失敗: ${validation.error}`, { autoClose: 5000 });
            return;
        }
        this.eventManager.startNewSession();
        const { showNotifications: showSessionNotifications } = this.settingsManager.getNotificationSettings();
        if (showSessionNotifications) {
            _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__.Notification.success(`新しい学習セッションを開始しました (${userInfo.teamName})`, { autoClose: 2000 });
        }
    }
}
/**
 * JupyterLab拡張機能の定義
 */
const extension = {
    id: PLUGIN_ID,
    description: 'JupyterLab extension for cell execution monitoring',
    autoStart: true,
    requires: [_jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_2__.INotebookTracker, _jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_3__.ISettingRegistry, _jupyterlab_application__WEBPACK_IMPORTED_MODULE_0__.ILabShell],
    activate: async (app, notebookTracker, settingRegistry, labShell) => {
        // プラグインクラスのインスタンス化と初期化
        new CellMonitorPlugin(app, notebookTracker, settingRegistry, labShell);
    }
};
;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (extension);


/***/ }),

/***/ "./lib/services/DataTransmissionService.js":
/*!*************************************************!*\
  !*** ./lib/services/DataTransmissionService.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DataTransmissionService: () => (/* binding */ DataTransmissionService)
/* harmony export */ });
/* harmony import */ var axios__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! axios */ "webpack/sharing/consume/default/axios/axios");
/* harmony import */ var axios__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(axios__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @jupyterlab/apputils */ "webpack/sharing/consume/default/@jupyterlab/apputils");
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils */ "./lib/utils/logger.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils */ "./lib/utils/errorHandler.js");
/* harmony import */ var _LoadDistributionService__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./LoadDistributionService */ "./lib/services/LoadDistributionService.js");
/**
 * データ送信サービス
 * APIへのデータ送信、再試行処理、通知表示を担当
 */




/**
 * データ送信サービス
 * 学習進捗データとレガシーセル実行データをサーバーに送信
 */
class DataTransmissionService {
    constructor(settingsManager) {
        this.logger = (0,_utils__WEBPACK_IMPORTED_MODULE_2__.createLogger)('DataTransmissionService');
        this.connectionPoolCleanupInterval = null;
        // Phase 2.2: HTTP重複送信防止
        this.pendingRequests = new Map();
        this.settingsManager = settingsManager;
        this.loadDistributionService = new _LoadDistributionService__WEBPACK_IMPORTED_MODULE_3__.LoadDistributionService(settingsManager);
        // HTTP接続プール設定（Phase 2.1: 接続プール最適化）
        // ブラウザ環境では Connection ヘッダーは自動管理されるため除外
        this.axiosInstance = axios__WEBPACK_IMPORTED_MODULE_0___default().create({
            timeout: 8000,
            headers: {
                'Content-Type': 'application/json'
            },
            maxRedirects: 3,
            validateStatus: (status) => status < 500
        });
        // レガシー用接続プール
        this.legacyAxiosInstance = axios__WEBPACK_IMPORTED_MODULE_0___default().create({
            timeout: 8000,
            headers: {
                'Content-Type': 'application/json'
            },
            maxRedirects: 3,
            validateStatus: (status) => status < 500
        });
        // 接続プールのクリーンアップ設定
        this.setupConnectionPoolCleanup();
    }
    setupConnectionPoolCleanup() {
        // 30秒ごとに接続プールの状況をログ出力（ブラウザでは自動クリーンアップされる）
        this.connectionPoolCleanupInterval = setInterval(() => {
            this.logger.debug('HTTP connection pool status check - automatic cleanup by browser');
        }, 30000);
    }
    /**
     * クリーンアップメソッド（必要に応じて呼び出し）
     */
    dispose() {
        if (this.connectionPoolCleanupInterval) {
            clearInterval(this.connectionPoolCleanupInterval);
            this.connectionPoolCleanupInterval = null;
        }
        // Phase 2.2: 未完了のリクエストをクリーンアップ
        this.pendingRequests.clear();
        this.logger.debug('DataTransmissionService disposed', {
            pendingRequestsCleared: true
        });
    }
    /**
     * 学習進捗データを送信（負荷分散機能付き + 重複送信防止）
     */
    async sendProgressData(data) {
        if (data.length === 0)
            return;
        // Phase 2.2: 重複送信防止機能を適用
        for (const event of data) {
            await this.sendSingleEventWithDeduplication(event);
        }
    }
    /**
     * Phase 2.2: 重複送信防止付き単一イベント送信
     */
    async sendSingleEventWithDeduplication(event) {
        var _a;
        // 重複チェック用キー（セルID + イベントタイプ + タイムスタンプ分単位）
        const timeKey = Math.floor(Date.now() / 60000); // 1分単位でキー生成
        const requestKey = `${event.cellId || 'unknown'}-${event.eventType}-${timeKey}`;
        // 既に同じリクエストが進行中なら待機
        if (this.pendingRequests.has(requestKey)) {
            this.logger.debug('Duplicate request detected, waiting...', {
                cellId: ((_a = event.cellId) === null || _a === void 0 ? void 0 : _a.substring(0, 8)) + '...',
                eventType: event.eventType,
                requestKey: requestKey.substring(0, 20) + '...'
            });
            await this.pendingRequests.get(requestKey);
            return;
        }
        // 新規リクエストを実行
        const promise = this.sendSingleEventInternal([event]);
        this.pendingRequests.set(requestKey, promise);
        promise.finally(() => {
            this.pendingRequests.delete(requestKey);
        });
        await promise;
    }
    /**
     * Phase 2.2: 単一イベントの内部送信処理（負荷分散考慮）
     */
    async sendSingleEventInternal(data) {
        // 負荷分散設定が有効な場合（デフォルトは有効）
        let useLoadDistribution = true; // デフォルト値
        try {
            const settings = this.settingsManager.getSettings();
            if (settings && settings.get) {
                const loadDistSetting = settings.get('useLoadDistribution');
                if (loadDistSetting && loadDistSetting.composite !== undefined) {
                    useLoadDistribution = loadDistSetting.composite;
                }
            }
        }
        catch (error) {
            this.logger.debug('Failed to get load distribution setting, using default', error);
        }
        if (useLoadDistribution) {
            // 負荷分散付き送信
            await this.loadDistributionService.sendWithLoadDistribution(data, (data) => this.sendProgressDataInternal(data));
        }
        else {
            // 従来通りの送信
            await this.sendProgressDataInternal(data);
        }
    }
    /**
     * 内部送信機能（既存ロジック）
     */
    async sendProgressDataInternal(data) {
        const { showNotifications } = this.settingsManager.getNotificationSettings();
        this.logger.debug('Sending progress data', {
            eventCount: data.length,
            showNotifications,
            events: data.map(d => ({ eventType: d.eventType, eventId: d.eventId }))
        });
        const serverUrl = this.settingsManager.getServerUrl();
        const maxRetries = this.settingsManager.getRetryAttempts();
        let retries = 0;
        while (retries <= maxRetries) {
            try {
                // Phase 2.1: 接続プール付きaxiosインスタンスを使用
                await this.axiosInstance.post(serverUrl, data);
                this.logger.info('Student progress data sent successfully', { eventCount: data.length });
                if (data.length > 0 && showNotifications) {
                    _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__.Notification.info(`Learning data sent (${data.length} events)`, {
                        autoClose: 3000
                    });
                }
                break;
            }
            catch (error) {
                const errorObj = error instanceof Error ? error : new Error(String(error));
                if (retries >= maxRetries) {
                    (0,_utils__WEBPACK_IMPORTED_MODULE_4__.handleDataTransmissionError)(errorObj, 'Progress data transmission - max retries exceeded', { eventCount: data.length, retryAttempt: retries });
                    break;
                }
                else {
                    (0,_utils__WEBPACK_IMPORTED_MODULE_4__.handleNetworkError)(errorObj, `Progress data transmission - retry ${retries}/${maxRetries}`, undefined);
                    // Wait before retrying (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
                }
                retries++;
            }
        }
    }
    /**
     * レガシーセル実行データを送信（後方互換性のため）
     */
    async sendLegacyData(data) {
        if (data.length === 0)
            return;
        const serverUrl = this.settingsManager.getServerUrl();
        const legacyUrl = serverUrl.replace('student-progress', 'cell-monitor');
        const maxRetries = this.settingsManager.getRetryAttempts();
        let retries = 0;
        while (retries <= maxRetries) {
            try {
                // Phase 2.1: レガシー用接続プール付きaxiosインスタンスを使用
                await this.legacyAxiosInstance.post(legacyUrl, data);
                this.logger.info('Legacy cell execution data sent successfully', { itemCount: data.length });
                break;
            }
            catch (error) {
                const errorObj = error instanceof Error ? error : new Error(String(error));
                if (retries >= maxRetries) {
                    (0,_utils__WEBPACK_IMPORTED_MODULE_4__.handleDataTransmissionError)(errorObj, 'Legacy data transmission - max retries exceeded', { itemCount: data.length, retryAttempt: retries });
                    break;
                }
                else {
                    (0,_utils__WEBPACK_IMPORTED_MODULE_4__.handleNetworkError)(errorObj, `Legacy data transmission - retry ${retries}/${maxRetries}`);
                }
                retries++;
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
            }
        }
    }
}


/***/ }),

/***/ "./lib/services/LoadDistributionService.js":
/*!*************************************************!*\
  !*** ./lib/services/LoadDistributionService.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LoadDistributionService: () => (/* binding */ LoadDistributionService)
/* harmony export */ });
/* harmony import */ var _utils_logger__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/logger */ "./lib/utils/logger.js");
/**
 * 負荷分散サービス
 * 学生IDベースの一意な遅延により、サーバー負荷を分散
 */

class LoadDistributionService {
    constructor(_settingsManager) {
        this.logger = (0,_utils_logger__WEBPACK_IMPORTED_MODULE_0__.createLogger)('LoadDistributionService');
        // settingsManagerは将来の拡張で使用予定
    }
    /**
     * 負荷分散付きデータ送信
     */
    async sendWithLoadDistribution(data, originalSendFunction) {
        var _a, _b;
        if (data.length === 0)
            return;
        // 動的遅延計算（セルID + タイムスタンプベース）
        const userEmail = ((_a = data[0]) === null || _a === void 0 ? void 0 : _a.emailAddress) || '';
        const cellId = ((_b = data[0]) === null || _b === void 0 ? void 0 : _b.cellId) || '';
        const timestamp = Date.now();
        const combinedSeed = `${userEmail}-${cellId}-${Math.floor(timestamp / 1000)}`;
        const dynamicHash = this.hashString(combinedSeed);
        const baseDelay = (dynamicHash % 2000) + 200; // 0.2-2.2秒で動的変動
        this.logger.debug('Load distribution delay calculated', {
            userEmail: userEmail.substring(0, 5) + '***', // プライバシー保護
            delay: baseDelay,
            eventCount: data.length
        });
        // 遅延実行
        await new Promise(resolve => setTimeout(resolve, baseDelay));
        // 既存の送信機能を実行（指数バックオフ付き）
        await originalSendFunction(data);
    }
    /**
     * 文字列ハッシュ関数（一意性確保）
     */
    hashString(str) {
        if (!str)
            return 0;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32bit整数に変換
        }
        return Math.abs(hash);
    }
}


/***/ }),

/***/ "./lib/utils/errorHandler.js":
/*!***********************************!*\
  !*** ./lib/utils/errorHandler.js ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ErrorCategory: () => (/* binding */ ErrorCategory),
/* harmony export */   ErrorSeverity: () => (/* binding */ ErrorSeverity),
/* harmony export */   errorHandler: () => (/* binding */ errorHandler),
/* harmony export */   handleCellProcessingError: () => (/* binding */ handleCellProcessingError),
/* harmony export */   handleDataTransmissionError: () => (/* binding */ handleDataTransmissionError),
/* harmony export */   handleInitializationError: () => (/* binding */ handleInitializationError),
/* harmony export */   handleNetworkError: () => (/* binding */ handleNetworkError),
/* harmony export */   handleSettingsError: () => (/* binding */ handleSettingsError),
/* harmony export */   handleUIError: () => (/* binding */ handleUIError),
/* harmony export */   withErrorHandling: () => (/* binding */ withErrorHandling),
/* harmony export */   withSyncErrorHandling: () => (/* binding */ withSyncErrorHandling)
/* harmony export */ });
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @jupyterlab/apputils */ "webpack/sharing/consume/default/@jupyterlab/apputils");
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _logger__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./logger */ "./lib/utils/logger.js");
/**
 * Error Handling Utilities for Cell Monitor Extension
 * Provides centralized error handling, reporting, and user-friendly messages
 */


const logger = (0,_logger__WEBPACK_IMPORTED_MODULE_1__.createLogger)('ErrorHandler');
/**
 * Error severity levels
 */
var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["LOW"] = "low";
    ErrorSeverity["MEDIUM"] = "medium";
    ErrorSeverity["HIGH"] = "high";
    ErrorSeverity["CRITICAL"] = "critical";
})(ErrorSeverity || (ErrorSeverity = {}));
/**
 * Error categories for better classification
 */
var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["NETWORK"] = "network";
    ErrorCategory["SETTINGS"] = "settings";
    ErrorCategory["CELL_PROCESSING"] = "cell_processing";
    ErrorCategory["UI"] = "ui";
    ErrorCategory["DATA_TRANSMISSION"] = "data_transmission";
    ErrorCategory["INITIALIZATION"] = "initialization";
})(ErrorCategory || (ErrorCategory = {}));
class ErrorHandler {
    constructor() {
        this.config = {
            showNotifications: true,
            logToConsole: true,
            reportToServer: false
        };
    }
    /**
     * Update error handler configuration
     */
    configure(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Main error handling method
     */
    handle(errorInfo) {
        const { error, category, severity, context, userMessage, shouldNotifyUser, metadata } = errorInfo;
        // Log the error with appropriate level based on severity
        this.logError(error, category, severity, context, metadata);
        // Show user notification if needed
        if (shouldNotifyUser && this.config.showNotifications) {
            this.showUserNotification(userMessage || this.getDefaultUserMessage(category, severity), severity);
        }
        // Report to server if configured (future implementation)
        if (this.config.reportToServer) {
            this.reportError(errorInfo);
        }
    }
    /**
     * Log error with appropriate level
     */
    logError(error, category, severity, context, metadata) {
        const logMessage = `[${category.toUpperCase()}] ${context ? `${context}: ` : ''}${error.message}`;
        const logData = {
            error: error.stack || error.message,
            category,
            severity,
            context,
            ...metadata
        };
        switch (severity) {
            case ErrorSeverity.CRITICAL:
            case ErrorSeverity.HIGH:
                logger.error(logMessage, logData);
                break;
            case ErrorSeverity.MEDIUM:
                logger.warn(logMessage, logData);
                break;
            case ErrorSeverity.LOW:
                logger.info(logMessage, logData);
                break;
        }
    }
    /**
     * Show user-friendly notifications
     */
    showUserNotification(message, severity) {
        const options = { autoClose: this.getNotificationAutoClose(severity) };
        switch (severity) {
            case ErrorSeverity.CRITICAL:
            case ErrorSeverity.HIGH:
                _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__.Notification.error(message, options);
                break;
            case ErrorSeverity.MEDIUM:
                _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__.Notification.warning(message, options);
                break;
            case ErrorSeverity.LOW:
                _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__.Notification.info(message, options);
                break;
        }
    }
    /**
     * Get auto-close duration based on severity
     */
    getNotificationAutoClose(severity) {
        switch (severity) {
            case ErrorSeverity.CRITICAL:
                return 0; // Don't auto-close critical errors
            case ErrorSeverity.HIGH:
                return 10000; // 10 seconds
            case ErrorSeverity.MEDIUM:
                return 5000; // 5 seconds
            case ErrorSeverity.LOW:
                return 3000; // 3 seconds
        }
    }
    /**
     * Get default user message based on category and severity
     */
    getDefaultUserMessage(category, severity) {
        const severityPrefix = severity === ErrorSeverity.CRITICAL || severity === ErrorSeverity.HIGH
            ? '重要: ' : '';
        switch (category) {
            case ErrorCategory.NETWORK:
                return `${severityPrefix}ネットワーク接続に問題があります。インターネット接続を確認してください。`;
            case ErrorCategory.SETTINGS:
                return `${severityPrefix}設定に問題があります。拡張機能の設定を確認してください。`;
            case ErrorCategory.CELL_PROCESSING:
                return `${severityPrefix}セル処理中にエラーが発生しました。しばらく待ってから再試行してください。`;
            case ErrorCategory.UI:
                return `${severityPrefix}画面表示でエラーが発生しました。画面を再読み込みしてください。`;
            case ErrorCategory.DATA_TRANSMISSION:
                return `${severityPrefix}データ送信でエラーが発生しました。自動的に再試行します。`;
            case ErrorCategory.INITIALIZATION:
                return `${severityPrefix}拡張機能の初期化でエラーが発生しました。JupyterLabを再起動してください。`;
            default:
                return `${severityPrefix}予期しないエラーが発生しました。`;
        }
    }
    /**
     * Report error to server (future implementation)
     */
    reportError(errorInfo) {
        // TODO: Implement server error reporting
        logger.debug('Error reporting to server not yet implemented', { errorInfo });
    }
}
// Export singleton instance
const errorHandler = new ErrorHandler();
/**
 * Convenience functions for common error handling patterns
 */
/**
 * Handle network errors
 */
const handleNetworkError = (error, context, userMessage) => {
    errorHandler.handle({
        error,
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        context,
        userMessage,
        shouldNotifyUser: true
    });
};
/**
 * Handle settings errors
 */
const handleSettingsError = (error, context, userMessage) => {
    errorHandler.handle({
        error,
        category: ErrorCategory.SETTINGS,
        severity: ErrorSeverity.HIGH,
        context,
        userMessage,
        shouldNotifyUser: true
    });
};
/**
 * Handle cell processing errors
 */
const handleCellProcessingError = (error, context, metadata) => {
    errorHandler.handle({
        error,
        category: ErrorCategory.CELL_PROCESSING,
        severity: ErrorSeverity.LOW,
        context,
        shouldNotifyUser: false, // Don't spam users for cell processing errors
        metadata
    });
};
/**
 * Handle critical initialization errors
 */
const handleInitializationError = (error, context) => {
    errorHandler.handle({
        error,
        category: ErrorCategory.INITIALIZATION,
        severity: ErrorSeverity.CRITICAL,
        context,
        shouldNotifyUser: true
    });
};
/**
 * Handle UI errors
 */
const handleUIError = (error, context, userMessage) => {
    errorHandler.handle({
        error,
        category: ErrorCategory.UI,
        severity: ErrorSeverity.MEDIUM,
        context,
        userMessage,
        shouldNotifyUser: true
    });
};
/**
 * Handle data transmission errors
 */
const handleDataTransmissionError = (error, context, metadata) => {
    errorHandler.handle({
        error,
        category: ErrorCategory.DATA_TRANSMISSION,
        severity: ErrorSeverity.MEDIUM,
        context,
        shouldNotifyUser: true,
        metadata
    });
};
/**
 * Async error wrapper for promises
 */
const withErrorHandling = (promise, category, severity = ErrorSeverity.MEDIUM, context) => {
    return promise.catch(error => {
        errorHandler.handle({
            error: error instanceof Error ? error : new Error(String(error)),
            category,
            severity,
            context,
            shouldNotifyUser: severity >= ErrorSeverity.MEDIUM
        });
        throw error; // Re-throw to maintain promise chain behavior
    });
};
/**
 * Sync error wrapper for functions
 */
const withSyncErrorHandling = (fn, category, severity = ErrorSeverity.MEDIUM, context) => {
    try {
        return fn();
    }
    catch (error) {
        errorHandler.handle({
            error: error instanceof Error ? error : new Error(String(error)),
            category,
            severity,
            context,
            shouldNotifyUser: severity >= ErrorSeverity.MEDIUM
        });
        return undefined;
    }
};


/***/ }),

/***/ "./lib/utils/logger.js":
/*!*****************************!*\
  !*** ./lib/utils/logger.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LogLevel: () => (/* binding */ LogLevel),
/* harmony export */   createLogger: () => (/* binding */ createLogger),
/* harmony export */   logger: () => (/* binding */ logger)
/* harmony export */ });
/**
 * Logger utility for Cell Monitor Extension
 * Provides environment-based log level control and consistent logging interface
 */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(LogLevel || (LogLevel = {}));
class Logger {
    constructor(config = {}) {
        // Detect development mode (JupyterLab extension context)
        this.isDevelopment = this.detectDevelopmentMode();
        this.config = {
            level: this.isDevelopment ? LogLevel.DEBUG : LogLevel.ERROR,
            prefix: '[CellMonitor]',
            enabledInProduction: false,
            ...config
        };
    }
    detectDevelopmentMode() {
        // Check for development indicators
        try {
            // JupyterLab development mode usually has certain debug flags
            if (typeof window !== 'undefined') {
                // Check for development mode indicators
                return (window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    document.querySelector('[data-jupyter-widgets-version]') !== null);
            }
            // For browser environments, assume development if on localhost
            return false;
        }
        catch (_a) {
            // Fallback to production mode if detection fails
            return false;
        }
    }
    shouldLog(level) {
        if (!this.isDevelopment && !this.config.enabledInProduction) {
            // In production, only allow ERROR level unless explicitly enabled
            return level === LogLevel.ERROR;
        }
        return level <= this.config.level;
    }
    formatMessage(level, message, ...args) {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const prefix = `${this.config.prefix}[${level}][${timestamp}]`;
        return [prefix, message, ...args];
    }
    error(message, ...args) {
        if (this.shouldLog(LogLevel.ERROR)) {
            console.error(...this.formatMessage('ERROR', message, ...args));
        }
    }
    warn(message, ...args) {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(...this.formatMessage('WARN', message, ...args));
        }
    }
    info(message, ...args) {
        if (this.shouldLog(LogLevel.INFO)) {
            console.info(...this.formatMessage('INFO', message, ...args));
        }
    }
    debug(message, ...args) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.log(...this.formatMessage('DEBUG', message, ...args));
        }
    }
    /**
     * Special method for performance-sensitive debug logs
     * These are completely removed in production builds
     */
    perfDebug(message, ...args) {
        if (this.isDevelopment && this.shouldLog(LogLevel.DEBUG)) {
            console.log(...this.formatMessage('PERF', message, ...args));
        }
    }
    /**
     * Group logging for complex debug scenarios
     */
    group(title, callback) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.group(this.formatMessage('GROUP', title)[0]);
            try {
                callback();
            }
            finally {
                console.groupEnd();
            }
        }
    }
    /**
     * Create a child logger with additional context
     */
    child(context) {
        return new Logger({
            ...this.config,
            prefix: `${this.config.prefix}[${context}]`
        });
    }
}
// Export singleton instance
const logger = new Logger();
// Export factory function for component-specific loggers
const createLogger = (context) => {
    return logger.child(context);
};


/***/ }),

/***/ "./lib/utils/uuid.js":
/*!***************************!*\
  !*** ./lib/utils/uuid.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   generateUUID: () => (/* binding */ generateUUID)
/* harmony export */ });
/**
 * UUID生成ユーティリティ
 * RFC 4122準拠のUUID v4を生成する
 */
/**
 * ユーティリティ関数: UUIDを生成する
 * @returns RFC 4122準拠のUUID v4文字列
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}


/***/ })

}]);
//# sourceMappingURL=lib_index_js.f07d95fa187ef96b5aa6.js.map