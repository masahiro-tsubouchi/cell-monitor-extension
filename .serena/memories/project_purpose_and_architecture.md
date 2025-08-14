# Project Purpose and Architecture

## Purpose
JupyterLab Cell Monitor Extension - A system for real-time tracking and analysis of student learning progress through Jupyter notebooks. It collects, processes, and visualizes educational data through multiple collaborating components.

## Architecture
The system uses a microservices architecture with the following components:

### Core Components
1. **JupyterLab Extension** (`cell-monitor-extension/`)
   - TypeScript-based frontend extension for JupyterLab
   - Monitors cell execution in Jupyter notebooks
   - Captures and sends execution events to backend

2. **FastAPI Server** (`fastapi_server/`)
   - Python backend using FastAPI framework
   - Processes events and manages data
   - Provides WebSocket communication for real-time updates
   - Main entry point: `main.py`

3. **Instructor Dashboard** (`instructor-dashboard/`)
   - React-based frontend dashboard
   - Real-time monitoring and visualization
   - Uses Material-UI components and Chart.js for visualization

### Data Storage
- **PostgreSQL**: Relational data (users, notebooks, assignments)
- **InfluxDB**: Time-series execution metrics
- **Redis**: Pub/sub messaging and session data

### Key Technologies
- **Frontend**: TypeScript, React, JupyterLab 4.x, Material-UI
- **Backend**: Python, FastAPI, SQLAlchemy, Alembic, WebSockets
- **Testing**: Jest (TS), Pytest (Python), Playwright (E2E)
- **Containerization**: Docker Compose for orchestration
