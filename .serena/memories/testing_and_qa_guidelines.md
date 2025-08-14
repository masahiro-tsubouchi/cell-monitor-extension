# Testing and Quality Assurance Guidelines

## Testing Frameworks and Approach
- **Python**: Pytest with asyncio support
- **TypeScript**: Jest with TypeScript support
- **React**: Testing Library (@testing-library/react)
- **E2E**: Playwright for end-to-end testing

## Test Markers and Configuration
### Pytest Markers
- `@pytest.mark.asyncio`: Async test functions
- `@pytest.mark.integration`: Tests requiring external services
- Use `pytest -m integration` to run integration tests only

### Test Configuration
- **Python**: `pytest.ini` with asyncio_mode = auto
- **TypeScript**: Jest configuration in package.json
- **Coverage**: Available for both Python and TypeScript

## Testing Strategy
1. **Unit Tests**: Individual component testing
2. **Integration Tests**: Multi-service interaction testing
3. **E2E Tests**: Full workflow testing with Playwright
4. **Load Tests**: 100+ mock students for performance testing

## Code Quality Tools
### Pre-commit Hooks (Automatic)
- Trailing whitespace removal
- End-of-file fixer
- YAML validation
- Large file detection
- Black formatting (Python)
- Flake8 linting (Python)
- MyPy type checking (Python)
- Bandit security analysis (Python)

### Manual Quality Checks
```bash
# Python
black .
flake8
mypy .
bandit -r fastapi_server/

# TypeScript
npm run eslint:check
npm run test:coverage
```

## Testing Database
- Uses separate test database configuration
- Docker-based testing environment
- Test data generation scripts available in `fastapi_server/scripts/`
