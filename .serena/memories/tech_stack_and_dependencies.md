# Tech Stack and Dependencies

## JupyterLab Extension (`cell-monitor-extension/`)
- **Language**: TypeScript (v5.0.2)
- **Framework**: JupyterLab 4.2.4
- **Key Libraries**:
  - `@jupyterlab/application`: Core JupyterLab functionality
  - `@jupyterlab/notebook`: Notebook interaction APIs
  - `@jupyterlab/services`: Service communication
  - `axios`: HTTP client for API communication

## FastAPI Server (`fastapi_server/`)
- **Language**: Python
- **Framework**: FastAPI 0.109.2
- **Key Libraries**:
  - `uvicorn`: ASGI server
  - `sqlalchemy`: ORM for database operations
  - `alembic`: Databarse migrations
  - `psycopg2-binary`: PostgreSQL adapter
  - `influxdb-client`: InfluxDB integration
  - `redis`: Redis client
  - `python-socketio`: WebSocket support
  - `pydantic`: Data validation
  - `pytest`: Testing framework

## Instructor Dashboard (`instructor-dashboard/`)
- **Language**: TypeScript
- **Framework**: React 19.1.0
- **Key Libraries**:
  - `@mui/material`: Material-UI components
  - `@mui/x-data-grid`: Data grid component
  - `chart.js` & `react-chartjs-2`: Charting
  - `axios`: HTTP client
  - `socket.io-client`: WebSocket client
  - `zustand`: State management
  - `react-router-dom`: Routing

## Development Tools
- **Containerization**: Docker & Docker Compose
- **Code Quality**: ESLint, Prettier (TS), Black, Flake8 (Python)
- **Type Checking**: MyPy (Python), TypeScript compiler
- **Pre-commit hooks**: Automated code quality checks
