#!/bin/bash
# Setup script for cell-monitor JupyterLab extension

# Ensure we're in the project directory
cd "$(dirname "$0")"
mkdir -p cell-monitor-extension
cd cell-monitor-extension

# Set environment variables for macOS optimization as specified in the docs
export NODE_OPTIONS="--max-old-space-size=8192"
export JUPYTER_CONFIG_DIR="$PWD/.jupyter"
export CHOKIDAR_USEPOLLING=false  # macOS native FSEvents

# Initialize npm package
npm init -y

# Update package.json with extension details
cat > package.json << EOF
{
  "name": "cell-monitor",
  "version": "0.1.0",
  "description": "JupyterLab extension for cell execution monitoring",
  "keywords": [
    "jupyter",
    "jupyterlab",
    "jupyterlab-extension"
  ],
  "homepage": "https://github.com/company/cell-monitor-extension",
  "bugs": {
    "url": "https://github.com/company/cell-monitor-extension/issues"
  },
  "license": "MIT",
  "author": {
    "name": "Developer"
  },
  "files": [
    "lib/**/*.{d.ts,eot,gif,html,jpg,js,js.map,json,png,svg,woff2,ttf}",
    "style/**/*.{css,js,eot,gif,html,jpg,json,png,svg,woff2,ttf}"
  ],
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "style": "style/index.css",
  "repository": {
    "type": "git",
    "url": "https://github.com/company/cell-monitor-extension.git"
  },
  "scripts": {
    "build": "jlpm build:lib && jlpm build:labextension:dev",
    "build:prod": "jlpm clean && jlpm build:lib && jlpm build:labextension",
    "build:labextension": "jupyter labextension build .",
    "build:labextension:dev": "jupyter labextension build --development True .",
    "build:lib": "tsc",
    "clean": "jlpm clean:lib && jlpm clean:labextension",
    "clean:lib": "rimraf lib tsconfig.tsbuildinfo",
    "clean:labextension": "rimraf cell-monitor/labextension",
    "eslint": "eslint . --ext .ts,.tsx --fix",
    "eslint:check": "eslint . --ext .ts,.tsx",
    "install:extension": "jlpm build",
    "watch": "run-p watch:src watch:labextension",
    "watch:src": "tsc -w",
    "watch:labextension": "jupyter labextension watch ."
  },
  "dependencies": {
    "@jupyterlab/application": "^4.2.4",
    "@jupyterlab/notebook": "^4.2.4",
    "@jupyterlab/services": "^7.2.4",
    "@jupyterlab/settingregistry": "^4.2.4",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@jupyterlab/builder": "^4.2.4",
    "@typescript-eslint/eslint-plugin": "^5.55.0",
    "@typescript-eslint/parser": "^5.55.0",
    "eslint": "^8.36.0",
    "eslint-config-prettier": "^8.8.0",
    "eslint-plugin-prettier": "^4.2.1",
    "npm-run-all": "^4.1.5",
    "prettier": "^2.8.7",
    "rimraf": "^4.4.1",
    "typescript": "~5.0.2"
  },
  "sideEffects": [
    "style/*.css",
    "style/index.js"
  ],
  "jupyterlab": {
    "extension": true,
    "outputDir": "cell-monitor/labextension",
    "schemaDir": "schema"
  },
  "styleModule": "style/index.js"
}
EOF

# Create TypeScript configuration
cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "allowSyntheticDefaultImports": true,
    "composite": true,
    "declaration": true,
    "esModuleInterop": true,
    "jsx": "react",
    "module": "esnext",
    "moduleResolution": "node",
    "noEmitOnError": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "preserveWatchOutput": true,
    "resolveJsonModule": true,
    "outDir": "lib",
    "rootDir": "src",
    "strict": true,
    "strictNullChecks": true,
    "target": "es2017",
    "types": []
  },
  "include": ["src/*"]
}
EOF

# Create directories
mkdir -p src style schema

# Create style file
cat > style/index.css << EOF
/* Cell monitor extension styles */
.cell-monitor-notification {
  background-color: rgba(33, 150, 243, 0.1);
  border-left: 3px solid #2196F3;
  padding: 5px 10px;
  margin-bottom: 5px;
  font-size: 0.9em;
}
EOF

# Create style module file
cat > style/index.js << EOF
import './index.css';
EOF

# Create schema for settings
mkdir -p schema/cell-monitor
cat > schema/cell-monitor/plugin.json << EOF
{
  "title": "Cell Monitor",
  "description": "Settings for the Cell Monitor extension",
  "type": "object",
  "properties": {
    "serverUrl": {
      "type": "string",
      "title": "Server URL",
      "description": "URL of the FastAPI server to send cell execution data",
      "default": "http://localhost:8000/cell-monitor"
    },
    "batchSize": {
      "type": "integer",
      "title": "Batch Size",
      "description": "Number of executions to collect before sending to server",
      "default": 1,
      "minimum": 1,
      "maximum": 100
    },
    "retryAttempts": {
      "type": "integer",
      "title": "Retry Attempts",
      "description": "Number of retry attempts when sending data fails",
      "default": 3,
      "minimum": 0,
      "maximum": 10
    }
  }
}
EOF

# Create main extension file
cat > src/index.ts << EOF
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { INotebookTracker, NotebookActions } from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import axios from 'axios';

/**
 * Settings interface for the cell-monitor extension
 */
interface ISettings {
  serverUrl: string;
  batchSize: number;
  retryAttempts: number;
}

/**
 * Cell execution data interface
 */
interface ICellExecutionData {
  cellId: string;
  code: string;
  executionTime: string;
  result: string;
  hasError: boolean;
  notebookPath: string;
}

/**
 * Initialization data for the cell-monitor extension
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'cell-monitor:plugin',
  autoStart: true,
  requires: [INotebookTracker],
  optional: [ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry | null
  ) => {
    console.log('JupyterLab extension cell-monitor is activated!');
    
    // Default settings
    let settings: ISettings = {
      serverUrl: 'http://localhost:8000/cell-monitor',
      batchSize: 1,
      retryAttempts: 3
    };

    // Cell execution buffer
    const executionBuffer: ICellExecutionData[] = [];

    // Load settings
    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(data => {
          settings = {
            serverUrl: data.get('serverUrl').composite as string,
            batchSize: data.get('batchSize').composite as number,
            retryAttempts: data.get('retryAttempts').composite as number
          };
          console.log('cell-monitor settings loaded:', settings);
        })
        .catch(reason => {
          console.error('Failed to load cell-monitor settings', reason);
        });
    }

    // Send data to server function
    const sendData = async (data: ICellExecutionData[]): Promise<void> => {
      if (data.length === 0) return;
      
      let retries = 0;
      while (retries <= settings.retryAttempts) {
        try {
          await axios.post(settings.serverUrl, data);
          console.log('Cell execution data sent successfully:', data.length, 'items');
          break;
        } catch (error) {
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
    const processCellExecution = (cell: any): void => {
      try {
        if (!cell || !cell.model) return;
        
        const cellId = cell.model.id;
        const code = cell.model.value.text;
        const notebookPath = notebookTracker.currentWidget?.context.path || '';
        
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
        const executionData: ICellExecutionData = {
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
      } catch (error) {
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
EOF

# Create README
cat > README.md << EOF
# cell-monitor

[![Github Actions Status](https://github.com/company/cell-monitor-extension/workflows/Build/badge.svg)](https://github.com/company/cell-monitor-extension/actions/workflows/build.yml)

JupyterLab extension for cell execution monitoring

## Requirements

- JupyterLab >= 4.2.4

## Install

To install the extension, execute:

\`\`\`bash
pip install cell-monitor
\`\`\`

## Development

### Development installation

Create a dev environment:

\`\`\`bash
conda create -n cell-monitor-dev -c conda-forge nodejs jupyterlab
conda activate cell-monitor-dev
\`\`\`

Install the package in development mode:

\`\`\`bash
# Install package in development mode
pip install -e .
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Rebuild extension Typescript source after making changes
jlpm run build
\`\`\`

You can watch the source directory and run JupyterLab at the same time:

\`\`\`bash
# Watch the source directory in another terminal tab
jlpm run watch
# Run JupyterLab
jupyter lab
\`\`\`

### Backend FastAPI server

This extension sends cell execution data to a FastAPI server. Make sure the server is running at the URL specified in the settings.

### Configuration

This extension can be configured through the JupyterLab Settings menu:
- **Server URL**: The URL where the FastAPI server is running
- **Batch Size**: Number of cell executions to collect before sending to the server
- **Retry Attempts**: Number of retry attempts when sending data fails
EOF

# Create Python package files
cat > pyproject.toml << EOF
[build-system]
requires = ["hatchling>=1.5.0", "jupyterlab>=4.0.0,<5", "hatch-nodejs-version>=0.3.2"]
build-backend = "hatchling.build"

[project]
name = "cell_monitor"
description = "JupyterLab extension for cell execution monitoring"
readme = "README.md"
license = { file = "LICENSE" }
requires-python = ">=3.8"
authors = [
    { name = "Developer", email = "developer@example.com" },
]
keywords = [
    "Jupyter",
    "JupyterLab",
    "JupyterLab4",
]
classifiers = [
    "Framework :: Jupyter",
    "Framework :: Jupyter :: JupyterLab",
    "Framework :: Jupyter :: JupyterLab :: 4",
    "Framework :: Jupyter :: JupyterLab :: Extensions",
    "Framework :: Jupyter :: JupyterLab :: Extensions :: Prebuilt",
    "License :: OSI Approved :: MIT License",
    "Programming Language :: Python",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.8",
    "Programming Language :: Python :: 3.9",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
]
dependencies = [
]
dynamic = ["version"]

[project.urls]
Homepage = "https://github.com/company/cell-monitor-extension"
Bug = "https://github.com/company/cell-monitor-extension/issues"
Changelog = "https://github.com/company/cell-monitor-extension/blob/main/CHANGELOG.md"

[tool.hatch.version]
source = "nodejs"

[tool.hatch.build.targets.wheel.shared-data]
"cell-monitor/labextension" = "share/jupyter/labextensions/cell-monitor"
"install.json" = "share/jupyter/labextensions/cell-monitor/install.json"
"jupyter-config/jupyter_server_config.d" = "etc/jupyter/jupyter_server_config.d"
"jupyter-config/jupyter_server_config.json" = "etc/jupyter/jupyter_server_config.d/cell-monitor.json"

[tool.hatch.build.targets.wheel]
artifacts = ["cell-monitor/labextension"]

[tool.hatch.build.hooks.version]
path = "cell-monitor/_version.py"

[tool.hatch.build.hooks.jupyter-builder]
dependencies = ["hatch-jupyter-builder>=0.5"]
build-function = "hatch_jupyter_builder.npm_builder"
ensured-targets = [
    "cell-monitor/labextension/static/style.js",
    "cell-monitor/labextension/package.json",
]
skip-if-exists = ["cell-monitor/labextension/static/style.js"]

[tool.hatch.build.hooks.jupyter-builder.build-kwargs]
build_cmd = "build:prod"
npm = ["jlpm"]

[tool.hatch.build.hooks.jupyter-builder.editable-build-kwargs]
build_cmd = "install:extension"
npm = ["jlpm"]
source_dir = "src"
build_dir = "cell-monitor/labextension"

[tool.jupyter-releaser.options]
version_cmd = "hatch version"
EOF

# Create license file
cat > LICENSE << EOF
MIT License

Copyright (c) 2025 cell-monitor contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF

echo "JupyterLab cell-monitor extension project setup completed successfully!"
