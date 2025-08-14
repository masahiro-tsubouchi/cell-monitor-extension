# Task Completion Checklist

When completing any development task in this project, ensure the following steps are performed:

## Code Quality Checks
### For Python Code (FastAPI Server)
```bash
# Format code
black .

# Lint code
flake8

# Type checking
mypy .

# Security analysis
bandit -r fastapi_server/
```

### For TypeScript Code (JupyterLab Extension)
```bash
# Lint and fix
npm run eslint

# Type checking (implicit in build)
npm run build

# Run tests
npm test
```

### For React Code (Instructor Dashboard)
```bash
# Run tests
npm test

# Build check
npm run build
```

## Testing Requirements
### Minimum Testing
- Run relevant unit tests: `pytest` (Python) or `npm test` (TypeScript/React)
- For integration changes: `pytest -m integration`
- For significant changes: Consider E2E testing

### Test Coverage
- Python: Use `pytest --cov` for coverage reports
- TypeScript: Use `npm run test:coverage`

## Pre-commit Validation
The project uses pre-commit hooks that automatically run:
- Code formatting (Black for Python)
- Linting (Flake8 for Python, ESLint for TypeScript)
- Type checking (MyPy for Python)
- Security analysis (Bandit for Python)

## Build Verification
### For JupyterLab Extension
- Ensure `npm run build` succeeds
- Test extension loading in JupyterLab environment

### For FastAPI Server
- Verify server starts: `uvicorn main:app --reload`
- Check database migrations: `alembic upgrade head`

### For Complete System
- Run `docker compose up --build` to verify all services start correctly
- Test basic functionality through the web interfaces

## Documentation
- Update relevant documentation if API or functionality changes
- Update CLAUDE.md if development processes change
- Ensure code comments are accurate and helpful
