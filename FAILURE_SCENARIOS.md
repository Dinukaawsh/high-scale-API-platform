# Failure Scenarios & Solutions

This document addresses the critical failure scenarios that a high-scale API platform must handle.

## 1. What happens if Redis is down?

### Rate Limiting

**Configuration**: `RATE_LIMIT_SKIP_IF_REDIS_DOWN`

- **`true` (Fail Open)**: Requests are allowed when Redis is unavailable
  - Prevents service disruption
  - Risk: Potential abuse during Redis outage
  - Use case: High availability requirements

- **`false` (Fail Closed)**: Requests are denied when Redis is unavailable
  - Prevents abuse but blocks legitimate traffic
  - Use case: Strict security requirements

**Implementation**: `src/rate-limit/rate-limit.service.ts`

```typescript
if (!this.redisService.isHealthy()) {
  if (this.skipIfRedisDown) {
    return { allowed: true, remaining: capacity, resetTime: now + windowMs };
  }
  return { allowed: false, remaining: 0, resetTime: now + windowMs };
}
```

### Caching

**Behavior**: Graceful degradation

- Cache misses are handled silently
- Application continues to function
- Metrics track cache hit/miss rates
- No user-facing errors

**Implementation**: `src/cache/cache.service.ts`

```typescript
if (!this.redisService.isHealthy()) {
  this.logger.warn(`Redis down, cache miss for key: ${cacheKey}`);
  return null; // Cache miss, fetch from database
}
```

### Idempotency

**Behavior**: Fail open with warnings

- Requests are allowed when Redis is down
- Idempotency checks are skipped
- Warnings logged for monitoring
- Risk: Potential duplicate operations

**Implementation**: `src/idempotency/idempotency.service.ts`

```typescript
if (!this.redisService.isHealthy()) {
  this.logger.warn('Redis down, cannot check idempotency - allowing request');
  return { isDuplicate: false, key: idempotencyKey };
}
```

### Recommendations

1. **Monitor Redis health**: Use `/health` endpoint
2. **Set up Redis replication**: Master-slave or cluster
3. **Use Redis Sentinel**: Automatic failover
4. **Circuit breaker**: Stop checking Redis after repeated failures
5. **Fallback to in-memory**: For critical rate limiting (optional)

## 2. How do you prevent request storms?

### Multi-Layer Defense

#### Layer 1: Nginx (Edge)

**Configuration**: `nginx/nginx.conf`

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
limit_req zone=api_limit burst=20 nodelay;
```

- **Rate**: 100 requests per second per IP
- **Burst**: Allow 20 additional requests
- **Location**: Before application layer

#### Layer 2: Application Rate Limiting

**Token Bucket Strategy**:
- Allows bursts up to capacity
- Refills at constant rate
- Better for handling spikes

**Leaky Bucket Strategy**:
- Smooths out traffic
- More predictable rate
- Better for consistent load

**Implementation**: `src/rate-limit/rate-limit.service.ts`

#### Layer 3: Database Connection Pooling

**Configuration**: `src/database/database.module.ts`

```typescript
poolSize: 10,
extra: {
  max: 20,
  connectionTimeoutMillis: 5000,
}
```

- Limits concurrent database connections
- Prevents database overload
- Connection timeout prevents hanging

#### Layer 4: Request Queuing (Future Enhancement)

- Queue requests when rate limit exceeded
- Process in order
- Reject after queue timeout

### Request Storm Prevention Strategies

1. **Exponential Backoff**: Client retries with increasing delays
2. **Circuit Breaker**: Stop processing after threshold failures
3. **Request Deduplication**: Idempotency keys prevent duplicates
4. **Graceful Degradation**: Return cached/stale data when overloaded
5. **Load Shedding**: Reject low-priority requests first

### Monitoring

- Track rate limit hits: `rate_limit_hits_total` metric
- Monitor request queue depth
- Alert on unusual traffic patterns
- Set up dashboards for request rates

## 3. How do you deploy without downtime?

### Deployment Strategies

#### Blue-Green Deployment

1. **Setup**: Two identical environments (blue, green)
2. **Deploy**: Update green environment
3. **Test**: Verify green is healthy
4. **Switch**: Route traffic from blue to green
5. **Rollback**: Switch back if issues detected

**Docker Compose Example**:
```yaml
services:
  api-blue:
    # Current production
  api-green:
    # New version
  nginx:
    # Routes to active environment
```

#### Rolling Updates

1. **Deploy**: Update instances one at a time
2. **Health Check**: Verify each instance is healthy
3. **Traffic Shift**: Gradually route traffic to new instances
4. **Complete**: All instances updated

**Kubernetes Example**:
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

### Health Checks

**Implementation**: `src/observability/health.controller.ts`

```typescript
@Get('health')
@HealthCheck()
check() {
  return this.health.check([
    () => this.db.pingCheck('database'),
    () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
    async () => {
      const isHealthy = await this.redisService.ping();
      return { redis: { status: isHealthy ? 'up' : 'down' } };
    },
  ]);
}
```

**Docker Health Check**:
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

### Graceful Shutdown

**Implementation**: `src/main.ts` (NestJS handles this)

1. **Stop accepting new requests**: Close HTTP server
2. **Wait for in-flight requests**: Allow completion
3. **Close connections**: Database, Redis, etc.
4. **Exit process**: Clean shutdown

**Fastify Graceful Shutdown**:
```typescript
process.on('SIGTERM', async () => {
  await app.close();
  process.exit(0);
});
```

### Deployment Checklist

- [ ] Health checks passing
- [ ] Database migrations completed
- [ ] Environment variables configured
- [ ] Secrets rotated (if needed)
- [ ] Monitoring dashboards updated
- [ ] Rollback plan prepared
- [ ] Traffic routing verified
- [ ] Load testing completed

### Zero-Downtime Deployment Steps

1. **Pre-deployment**:
   - Backup database
   - Document current version
   - Prepare rollback plan

2. **Deployment**:
   - Deploy new version to staging
   - Run health checks
   - Run smoke tests
   - Deploy to production (blue-green or rolling)

3. **Post-deployment**:
   - Monitor metrics
   - Check error rates
   - Verify functionality
   - Keep old version ready for rollback

4. **Rollback** (if needed):
   - Route traffic back to old version
   - Investigate issues
   - Fix and redeploy

## Additional Failure Scenarios

### Database Connection Loss

**Handling**:
- Connection pooling with retries
- Health checks detect failures
- Graceful error responses
- Circuit breaker pattern

### High Memory Usage

**Handling**:
- Memory health checks
- Request size limits
- Connection limits
- Garbage collection tuning

### Network Partitions

**Handling**:
- Timeout configurations
- Retry strategies
- Fallback mechanisms
- Health check intervals

### Cache Stampede

**Handling**:
- Cache warming
- Stale-while-revalidate
- Probabilistic early expiration
- Lock-based deduplication

## Monitoring & Alerting

### Key Metrics

- **Availability**: Uptime percentage
- **Error Rate**: 4xx/5xx responses
- **Latency**: P50, P95, P99
- **Throughput**: Requests per second
- **Resource Usage**: CPU, memory, connections

### Alert Thresholds

- **Redis Down**: Immediate alert
- **Database Down**: Immediate alert
- **Error Rate > 1%**: Warning
- **Error Rate > 5%**: Critical
- **P95 Latency > 1s**: Warning
- **P95 Latency > 5s**: Critical

### Dashboards

- **System Health**: All components status
- **Request Metrics**: Rate, latency, errors
- **Resource Usage**: CPU, memory, connections
- **Business Metrics**: API usage by version

---

**Remember**: Failure is inevitable. The goal is to fail gracefully and recover quickly.

