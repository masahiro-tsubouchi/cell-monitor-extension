# Code Style and Conventions

## Python (FastAPI Server)
- **Formatter**: Black (24.4.2)
- **Linter**: Flake8 (7.0.0)
  - Ignores: E501 (line too long), W503 (line break before binary operator)
- **Type Checker**: MyPy with `ignore_missing_imports = True`
- **Security**: Bandit for security analysis
- **Style**: PEP 8 compliant via Black formatting

## TypeScript (JupyterLab Extension)
- **Compiler**: TypeScript ~5.0.2
- **Target**: ES2018
- **Linter**: ESLint with TypeScript parser
- **Formatter**: Prettier (2.8.7)
- **Strict mode**: Enabled
  - `noImplicitAny: true`
  - `strictNullChecks: true`
  - `noImplicitReturns: true`
  - `noUnusedLocals: true`

## React (Instructor Dashboard)
- **Style**: React 19.1.0 with functional components
- **Linter**: ESLint with react-app configuration
- **Type Safety**: Full TypeScript integration
- **Testing**: Testing Library for React components

## General Conventions
- **Naming**:
  - Python: snake_case for variables/functions, PascalCase for classes
  - TypeScript: camelCase for variables/functions, PascalCase for components/classes
- **File Organization**: Feature-based directory structure
- **Import Style**: Absolute imports preferred where possible
- **Error Handling**: Proper exception handling with meaningful messages
