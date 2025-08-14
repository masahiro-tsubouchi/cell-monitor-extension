# Project Structure Overview

## Root Directory Structure
```
jupyter-extensionver2-claude-code/
├── cell-monitor-extension/     # JupyterLab TypeScript extension
├── fastapi_server/            # Python FastAPI backend
├── instructor-dashboard/      # React frontend dashboard
├── docs/                     # Documentation
├── notebooks/                # Test notebooks
├── tests/                    # Additional test files
├── ui-mock/                  # UI mockups
├── docker-compose.yml        # Service orchestration
├── build-extension.sh        # Distribution build script
└── CLAUDE.md                 # AI assistant instructions
```

## JupyterLab Extension Structure
```
cell-monitor-extension/
├── src/                      # TypeScript source code
├── lib/                      # Compiled JavaScript (build output)
├── cell_monitor/labextension/ # JupyterLab extension files
├── schema/                   # Configuration schema
├── package.json              # NPM configuration
└── tsconfig.json            # TypeScript configuration
```

## FastAPI Server Structure
```
fastapi_server/
├── api/                      # API endpoints and routing
├── core/                     # Core functionality (connection manager)
├── crud/                     # Database operations
├── db/                       # Database models and clients
├── schemas/                  # Pydantic validation schemas
├── tests/                    # Test files
├── worker/                   # Background task processing
├── scripts/                  # Utility scripts
├── migrations/               # Database migration files
├── main.py                   # Application entry point
└── requirements.txt          # Python dependencies
```

## Instructor Dashboard Structure
```
instructor-dashboard/
├── src/
│   ├── components/           # React components
│   ├── pages/               # Page components
│   ├── services/            # API and WebSocket services
│   ├── stores/              # State management (Zustand)
│   └── types/               # TypeScript type definitions
├── public/                   # Static assets
└── package.json             # NPM configuration
```

## Key Configuration Files
- `docker-compose.yml`: Multi-service orchestration
- `.pre-commit-config.yaml`: Automated code quality checks
- `CLAUDE.md`: Project instructions and development guidelines
