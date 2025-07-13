import { INotebookTracker, NotebookActions } from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import axios from 'axios';
/**
 * Initialization data for the cell-monitor extension
 */
const plugin = {
    id: 'cell-monitor:plugin',
    autoStart: true,
    requires: [INotebookTracker],
    optional: [ISettingRegistry],
    activate: (app, notebookTracker, settingRegistry) => {
        console.log('JupyterLab extension cell-monitor is activated!');
        // Default settings
        let settings = {
            serverUrl: 'http://localhost:8000/cell-monitor',
            batchSize: 1,
            retryAttempts: 3
        };
        // Cell execution buffer
        const executionBuffer = [];
        // Load settings
        if (settingRegistry) {
            settingRegistry
                .load(plugin.id)
                .then(data => {
                settings = {
                    serverUrl: data.get('serverUrl').composite,
                    batchSize: data.get('batchSize').composite,
                    retryAttempts: data.get('retryAttempts').composite
                };
                console.log('cell-monitor settings loaded:', settings);
            })
                .catch(reason => {
                console.error('Failed to load cell-monitor settings', reason);
            });
        }
        // Send data to server function
        const sendData = async (data) => {
            if (data.length === 0)
                return;
            let retries = 0;
            while (retries <= settings.retryAttempts) {
                try {
                    await axios.post(settings.serverUrl, data);
                    console.log('Cell execution data sent successfully:', data.length, 'items');
                    break;
                }
                catch (error) {
                    console.error('Failed to send cell execution data:', error);
                    retries++;
                    if (retries > settings.retryAttempts) {
                        console.error('Max retry attempts reached. Data will be lost.');
                        break;
                    }
                    // Wait before retrying (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
                }
            }
        };
        // Process cell execution
        const processCellExecution = (cell) => {
            var _a;
            try {
                if (!cell || !cell.model)
                    return;
                const cellId = cell.model.id;
                const code = cell.model.value.text;
                const notebookPath = ((_a = notebookTracker.currentWidget) === null || _a === void 0 ? void 0 : _a.context.path) || '';
                // Get output content/error status
                const outputs = cell.model.outputs;
                let hasError = false;
                let resultText = '';
                if (outputs.length > 0) {
                    // Check for error output
                    for (let i = 0; i < outputs.length; i++) {
                        const output = outputs.get(i);
                        if (output.type === 'error') {
                            hasError = true;
                            resultText = output.evalue || 'Error occurred';
                            break;
                        }
                        if (output.type === 'execute_result' || output.type === 'display_data') {
                            if (output.data['text/plain']) {
                                resultText = output.data['text/plain'];
                            }
                        }
                    }
                }
                // Create execution data object
                const executionData = {
                    cellId,
                    code,
                    executionTime: new Date().toISOString(),
                    result: resultText,
                    hasError,
                    notebookPath
                };
                // Add to buffer
                executionBuffer.push(executionData);
                // Send data if buffer reaches batch size
                if (executionBuffer.length >= settings.batchSize) {
                    const dataToSend = [...executionBuffer];
                    executionBuffer.length = 0;
                    sendData(dataToSend);
                }
            }
            catch (error) {
                console.error('Error processing cell execution:', error);
            }
        };
        // Listen to cell executed signal
        notebookTracker.currentChanged.connect(() => {
            const notebook = notebookTracker.currentWidget;
            if (notebook) {
                NotebookActions.executed.connect((_, args) => {
                    processCellExecution(args.cell);
                });
            }
        });
    }
};
export default plugin;
