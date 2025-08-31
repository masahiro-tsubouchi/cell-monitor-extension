# Changelog

All notable changes to this project will be documented in this file.

## [1.1.5] - 2025-08-31

### Security
- **CRITICAL FIX**: Updated form-data from 4.0.3 to 4.0.4
- Resolved CVE-2025-7783: form-data uses unsafe random function for choosing boundary
- Fixed vulnerability in multipart boundary generation that could potentially allow arbitrary requests to internal systems
- Improved cryptographic security of HTTP multipart form data handling

### Fixed  
- Fixed LoadDistributionService export in services/index.ts
- Ensured all service modules are properly exported for consumption

### Dependencies
- Updated form-data: 4.0.3 → 4.0.4 (security fix)
- Removed 28 packages and optimized dependency tree via npm audit fix

## [1.1.4] - 2025-08-30

### Features
- Complete JupyterLab Cell Monitor Extension with real-time progress tracking
- Help request system with continuous 10-second interval sending
- Comprehensive settings management with Japanese localization
- Advanced memory management and performance optimization
- Load distribution system for 200+ concurrent users

### Performance
- Memory usage optimized to stable 80KB for 24-hour operation
- Phase 3 parallel processing system supporting 6,999+ events/second  
- HTTP connection pooling and duplicate request prevention
- Automatic cleanup systems for long-term stability

### Security
- Comprehensive error handling with severity-based categorization
- Input validation and sanitization for all user inputs
- Team name validation with real-time feedback

### Compatibility
- JupyterLab 4.x full compatibility
- Python 3.8+ support
- Modern browser support (Chrome, Firefox, Safari, Edge)