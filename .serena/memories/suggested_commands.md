# Essential Development Commands

## Docker Environment (Primary Development Method)
```bash
# Start all services
docker compose up --build

# Start specific services
docker compose up jupyterlab
docker compose up fastapi
docker compose up instructor-dashboard

# Stop all services
docker compose down
```

## JupyterLab Extension (`cell-monitor-extension/`)
```bash
# Development build
npm run build

# Production build
npm run build:prod

# Watch mode for development
npm run watch

# Testing
npm test
npm run test:coverage

# Code quality
npm run eslint:check
npm run eslint  # with auto-fix

# Clean build artifacts
npm run clean
```

## FastAPI Server (`fastapi_server/`)
```bash
# Run tests
pytest
pytest -m integration  # Integration tests only

# Code quality
black .         # Format code
flake8          # Lint code
mypy .          # Type check

# Database migrations
alembic upgrade head
alembic revision --autogenerate -m "description"

# Local server (alternative to Docker)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Instructor Dashboard (`instructor-dashboard/`)
```bash
# Development server
npm start

# Testing
npm test

# Production build
npm run build
```

## Build Extension Distribution
```bash
# Create .whl package for distribution
./build-extension.sh
```

## URLs (when running via Docker)
- JupyterLab: http://localhost:8888 (token: easy)
- FastAPI Server: http://localhost:8000
- Instructor Dashboard: http://localhost:3000
