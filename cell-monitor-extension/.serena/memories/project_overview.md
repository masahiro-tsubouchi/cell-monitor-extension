# Cell Monitor Extension - Project Overview

## Purpose
JupyterLab extension for cell execution monitoring in educational environments. Tracks student progress, cell execution data, and provides real-time monitoring capabilities for instructors.

## Technology Stack
- **Frontend**: TypeScript, JupyterLab Extension API
- **Build Tools**: TypeScript compiler, Jupyter Lab Builder, Webpack
- **Testing**: Jest, ts-jest
- **Code Quality**: ESLint, Prettier
- **Packaging**: Python setuptools, npm/yarn

## Project Structure
```
cell-monitor-extension/
├── src/                    # TypeScript source code
│   ├── types/             # Type definitions
│   ├── core/              # Core business logic classes
│   ├── services/          # External service integrations
│   └── utils/             # Utility functions
├── lib/                   # Compiled JavaScript
├── tests/                 # Test files
├── docs/                  # Documentation
├── cell_monitor/          # Python package
└── schema/                # JupyterLab plugin schema
```

## Key Components
1. **EventManager**: Handles cell execution events and help requests
2. **SettingsManager**: Manages JupyterLab settings integration
3. **DataTransmissionService**: Handles API communication with backend
4. **Memory Management**: Lightweight FIFO-based cell tracking system (50-item limit)

## Current Status
- Recently refactored from 938-line monolithic file to modular architecture
- Memory leak issues resolved with minimal-impact approach
- Event handler duplication issues fixed
- All core functionality restored and tested
