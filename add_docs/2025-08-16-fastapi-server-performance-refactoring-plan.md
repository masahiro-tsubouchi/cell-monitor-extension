# FastAPI Server Performance Refactoring Plan
**Date:** 2025-08-16  
**Target:** 200 JupyterLab clients + 10 instructor dashboard optimization  
**Priority:** High - Performance & Scalability

## 🎯 Objectives

### Primary Goals
- Support 200 concurrent JupyterLab connections without performance degradation
- Optimize 10 instructor dashboard real-time updates
- Reduce Redis connection bottlenecks
- Consolidate WebSocket management architecture

### Success Metrics
- Redis connection pool utilization < 80%
- Event processing latency < 100ms for 200 concurrent users
- WebSocket message delivery success rate > 99.5%
- Memory usage reduction by 30%

## 🔍 Current Architecture Issues

### Critical Problems
1. **Redis Connection Exhaustion**
   - Current: New connection per API call
   - Impact: Connection pool depletion with 200+ users
   - Location: `db/redis_client.py:get_redis_client()`

2. **Fragmented WebSocket Management**
   - Current: 3 separate connection managers
   - Impact: Memory waste, complexity
   - Components: `ConnectionManager`, `InstructorConnectionManager`, `dashboard_manager`

3. **Inefficient Event Processing**
   - Current: Individual event processing
   - Impact: Performance bottleneck under high load
   - Location: `api/endpoints/events.py:receive_events()`

## 📋 Refactoring Tasks

### Phase 1: Redis Connection Optimization (Week 1)
**Priority: 🔴 Critical**

#### Task 1.1: Implement Redis Connection Pool
- **File:** `db/redis_client.py`
- **Changes:**
  ```python
  # Before
  def get_redis_client() -> redis.Redis:
      return redis.Redis(connection_pool=redis_pool)
  
  # After
  class RedisConnectionManager:
      async def get_connection(self):
          # Connection pool with proper lifecycle management
  ```
- **Testing:** Load test with 200 concurrent connections
- **Estimated Time:** 3 days

#### Task 1.2: Update All Redis Usage
- **Files:** 
  - `api/endpoints/events.py`
  - `api/endpoints/progress.py`
  - `worker/main.py`
  - `core/realtime_notifier.py`
- **Changes:** Replace direct `get_redis_client()` calls with connection manager
- **Estimated Time:** 2 days

### Phase 2: WebSocket Management Consolidation (Week 2)
**Priority: 🔴 Critical**

#### Task 2.1: Create Unified Connection Manager
- **New File:** `core/unified_connection_manager.py`
- **Features:**
  - Room-based connection grouping
  - User type awareness (student/instructor)
  - Message filtering capabilities
  - Connection health monitoring
- **Estimated Time:** 4 days

#### Task 2.2: Migrate Existing Managers
- **Files to Update:**
  - `api/endpoints/websocket.py`
  - `api/endpoints/instructor_websocket.py`
  - `api/endpoints/dashboard_websocket.py`
- **Migration Strategy:** Gradual replacement with backward compatibility
- **Estimated Time:** 3 days

### Phase 3: Event Processing Optimization (Week 3)
**Priority: 🟡 High**

#### Task 3.1: Enhanced Batch Processing
- **File:** `api/endpoints/events.py`
- **Improvements:**
  - True transactional batch processing
  - Bulk database operations
  - Error handling with partial failure recovery
- **Estimated Time:** 3 days

#### Task 3.2: Background Worker Optimization
- **File:** `worker/main.py`
- **Changes:**
  - Parallel event processing
  - Queue-based load balancing
  - Worker health monitoring
- **Estimated Time:** 4 days

### Phase 4: Message Filtering & Routing (Week 4)
**Priority: 🟡 High**

#### Task 4.1: Implement Smart Message Routing
- **New File:** `core/message_router.py`
- **Features:**
  - Instructor-specific class filtering
  - Student progress targeting
  - Bandwidth optimization
- **Estimated Time:** 3 days

#### Task 4.2: Dashboard Update Optimization
- **Files:**
  - `api/endpoints/dashboard.py`
  - `core/realtime_progress_manager.py`
- **Changes:** Selective data push based on instructor permissions
- **Estimated Time:** 2 days

## 🧪 Testing Strategy

### Load Testing Plan
1. **Baseline Performance Test**
   - Current system with 50/100/150/200 concurrent users
   - Measure Redis connections, memory usage, response times

2. **Progressive Testing**
   - Test each phase implementation
   - Compare before/after metrics
   - Rollback plan for regressions

3. **Stress Testing**
   - 250+ concurrent connections
   - Failure scenario testing
   - Recovery time measurement

### Test Files to Update
- `tests/integration/test_100_students_data_persistence.py`
- `tests/load/test_100_students_base.py`
- New: `tests/performance/test_200_concurrent_users.py`

## 📊 Monitoring & Metrics

### Key Performance Indicators
- **Redis Metrics:**
  - Active connections count
  - Connection pool utilization
  - Command execution time

- **WebSocket Metrics:**
  - Connected clients count by type
  - Message delivery success rate
  - Connection lifetime

- **Event Processing Metrics:**
  - Queue depth
  - Processing latency
  - Error rate

### Monitoring Implementation
- **File:** `core/performance_monitor.py`
- **Integration:** InfluxDB metrics collection
- **Dashboard:** Real-time performance visualization

## 🚀 Deployment Strategy

### Rolling Deployment Plan
1. **Phase 1:** Deploy Redis optimization with feature flags
2. **Phase 2:** Gradual WebSocket manager migration
3. **Phase 3:** Event processing with A/B testing
4. **Phase 4:** Message filtering rollout

### Rollback Strategy
- Feature flags for quick disabling
- Database migration reversibility
- Connection manager fallback mechanisms

## 📅 Timeline

| Phase | Duration | Start Date | End Date | Dependencies |
|-------|----------|------------|----------|--------------|
| Phase 1 | 5 days | 2025-08-16 | 2025-08-20 | - |
| Phase 2 | 7 days | 2025-08-21 | 2025-08-27 | Phase 1 |
| Phase 3 | 7 days | 2025-08-28 | 2025-09-03 | Phase 1,2 |
| Phase 4 | 5 days | 2025-09-04 | 2025-09-08 | Phase 1,2,3 |

**Total Duration:** 4 weeks  
**Target Completion:** 2025-09-08

## 🔧 Technical Debt Cleanup

### Secondary Improvements
- Consolidate error handling patterns
- Standardize logging format
- Update documentation
- Optimize health check endpoints

### Code Quality
- Add type hints to legacy code
- Improve test coverage to 85%+
- Refactor complex functions
- Update dependency versions

## 📝 Documentation Updates

### Files to Update
- `CLAUDE.md` - Development commands and architecture
- `README.md` - Installation and setup instructions
- API documentation - New endpoints and WebSocket protocols
- Performance tuning guide - New file

## ✅ Success Criteria

### Performance Targets
- [ ] Support 200 concurrent JupyterLab connections
- [ ] < 100ms average response time under load
- [ ] < 80% Redis connection pool utilization
- [ ] 99.5%+ WebSocket message delivery
- [ ] 30% reduction in memory usage

### Code Quality Targets
- [ ] Single unified connection manager
- [ ] Consolidated Redis connection handling
- [ ] Comprehensive load testing suite
- [ ] Performance monitoring dashboard
- [ ] Complete documentation update

---

**Review Date:** 2025-09-15  
**Next Assessment:** Q4 2025 for further optimizations