<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
# High-Scale API Platform

A production-ready, high-performance API platform built with NestJS and Fastify, designed to handle millions of requests per day.

## 🏗️ Architecture

### Core Features

- **Authentication & Authorization**: JWT-based auth with refresh tokens
- **Rate Limiting**: Token bucket and leaky bucket algorithms with Redis
- **Caching**: Redis-based caching with tag-based invalidation
- **API Versioning**: Header and URL-based versioning support
- **Idempotency**: Request deduplication for safe retries
- **Observability**: Structured logging, Prometheus metrics, health checks
- **Failure Resilience**: Graceful degradation when Redis is down

### Tech Stack

- **Framework**: NestJS 11 with Fastify
- **Database**: PostgreSQL with TypeORM
- **Cache**: Redis (ioredis)
- **Reverse Proxy**: Nginx
- **Containerization**: Docker & Docker Compose
- **Monitoring**: Prometheus metrics, Winston logging

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm (or npm/yarn)
- Docker & Docker Compose (for full stack)
- PostgreSQL 16+
- Redis 7+

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd api-test
```

2. Install dependencies:

```bash
pnpm install
```

3. Copy environment file:

```bash
cp .env.example .env
```

4. Update `.env` with your configuration:

```env
DATABASE_HOST=localhost
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=api_db
REDIS_HOST=localhost
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

5. Start services with Docker Compose:

```bash
docker-compose up -d
```

6. Run database migrations (if using TypeORM migrations):

```bash
pnpm run migration:run
```

7. Start the application:

```bash
# Development
pnpm run start:dev

# Production
pnpm run build
pnpm run start:prod
```

## 📚 Key Features Explained

### 1. Rate Limiting

Two strategies are implemented:

#### Token Bucket

- Allows bursts up to bucket capacity
- Refills at a constant rate
- Better for handling traffic spikes

```typescript
@RateLimit({
  capacity: 100,
  refillRate: 10, // tokens per second
  windowSeconds: 60,
  strategy: 'token_bucket',
})
```

#### Leaky Bucket

- Smooths out traffic bursts
- More predictable rate
- Better for consistent load

```typescript
@RateLimit({
  capacity: 50,
  leakRate: 5, // requests per second
  windowSeconds: 60,
  strategy: 'leaky_bucket',
})
```

**Failure Handling**: When Redis is down, rate limiting can be configured to:

- **Skip** (allow all requests) - `RATE_LIMIT_SKIP_IF_REDIS_DOWN=true`
- **Deny** (fail closed) - `RATE_LIMIT_SKIP_IF_REDIS_DOWN=false`

### 2. Caching

Tag-based cache invalidation:

```typescript
// Set with tags
await cacheService.set('user:123', userData, {
  ttl: 3600,
  tags: ['user:123', 'users'],
});

// Invalidate by tags
await cacheService.invalidateByTags(['user:123']);
```

**Cache-Aside Pattern**:

```typescript
const data = await cacheService.getOrSet(
  'key',
  async () => {
    // Fetch from database
    return await db.query();
  },
  { ttl: 3600, tags: ['data'] },
);
```

### 3. API Versioning

Multiple versioning strategies:

```typescript
// URL-based: /v1/users, /v2/users
@ApiVersion('v1', 'v2')
@Controller('users')
export class UsersController {}

// Header-based: Accept: application/vnd.api+json;version=2
// Custom header: X-API-Version: 2
```

### 4. Idempotency

Prevent duplicate operations:

```bash
# Include idempotency key in header
curl -X POST https://api.example.com/users \
  -H "Idempotency-Key: unique-key-123" \
  -H "Authorization: Bearer <token>" \
  -d '{"name": "John"}'
```

The API will:

- Return cached response if the same key is used
- Store response for 24 hours (configurable)
- Verify request body hash to prevent conflicts

### 5. Authentication

JWT-based authentication with refresh tokens:

```bash
# Login
POST /auth/login
{
  "email": "user@example.com",
  "password": "password"
}

# Response
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 900
}

# Refresh token
POST /auth/refresh
{
  "refreshToken": "..."
}

# Protected endpoint
GET /protected
Authorization: Bearer <accessToken>
```

## 🔧 Configuration

### Environment Variables

| Variable                        | Description                   | Default       |
| ------------------------------- | ----------------------------- | ------------- |
| `NODE_ENV`                      | Environment                   | `development` |
| `PORT`                          | Server port                   | `3000`        |
| `DATABASE_HOST`                 | PostgreSQL host               | -             |
| `REDIS_HOST`                    | Redis host                    | `localhost`   |
| `JWT_SECRET`                    | JWT signing secret            | -             |
| `RATE_LIMIT_SKIP_IF_REDIS_DOWN` | Skip rate limit if Redis down | `true`        |
| `LOG_LEVEL`                     | Logging level                 | `info`        |

### Rate Limiting Configuration

```env
RATE_LIMIT_TTL=60          # Time window in seconds
RATE_LIMIT_MAX=100         # Default max requests
RATE_LIMIT_SKIP_IF_REDIS_DOWN=true  # Fail open/closed
```

## 🛡️ Failure Scenarios & Solutions

### 1. What happens if Redis is down?

**Rate Limiting**:

- Configurable: Skip (allow) or Deny (block)
- Set `RATE_LIMIT_SKIP_IF_REDIS_DOWN=true` to allow requests
- Set `RATE_LIMIT_SKIP_IF_REDIS_DOWN=false` to deny requests

**Caching**:

- Cache misses are handled gracefully
- Application continues to function
- Metrics track cache hit/miss rates

**Idempotency**:

- Falls back to allowing requests
- Logs warnings for monitoring

### 2. How do you prevent request storms?

**Multiple Layers**:

1. **Nginx**: First line of defense (100 req/s per IP)
2. **Application Rate Limiting**: Token bucket/leaky bucket
3. **Database Connection Pooling**: Limits concurrent connections
4. **Circuit Breaker Pattern**: (Can be added) Prevents cascading failures

**Configuration**:

```nginx
# nginx/nginx.conf
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
limit_req zone=api_limit burst=20 nodelay;
```

### 3. How do you deploy without downtime?

**Strategies**:

1. **Blue-Green Deployment**: Run two environments, switch traffic
2. **Rolling Updates**: Update instances gradually
3. **Health Checks**: Ensure new instances are healthy before routing traffic
4. **Graceful Shutdown**: Allow in-flight requests to complete

**Docker Compose**:

```yaml
healthcheck:
  test:
    [
      'CMD',
      'wget',
      '--quiet',
      '--tries=1',
      '--spider',
      'http://localhost:3000/health',
    ]
  interval: 30s
  timeout: 10s
  retries: 3
```

## 📊 Observability

### Health Checks

```bash
GET /health
```

Returns status of:

- Database connectivity
- Redis connectivity
- Memory usage

### Metrics

```bash
GET /health/metrics
```

Prometheus-compatible metrics:

- HTTP request duration
- HTTP request count
- Cache hit/miss rates
- Rate limit hits
- API request counts by version

### Logging

Structured JSON logs in production:

- Request/response logging
- Error tracking
- Performance metrics

Log files:

- `logs/application-YYYY-MM-DD.log`
- `logs/error-YYYY-MM-DD.log`

## 🐳 Docker Deployment

### Build and Run

```bash
# Build image
docker build -t api-platform .

# Run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

### Services

- **api**: NestJS application (port 3000)
- **postgres**: PostgreSQL database (port 5432)
- **redis**: Redis cache (port 6379)
- **nginx**: Reverse proxy (port 80)

## 🧪 Testing

```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Coverage
pnpm run test:cov
```

## 📝 API Examples

### Create User (Idempotent)

```bash
curl -X POST http://localhost:3000/v1/users \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-request-id-123" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe"
  }'
```

### Rate Limited Endpoint

```bash
# First 100 requests succeed
# 101st request returns 429 Too Many Requests
curl http://localhost:3000/v1/data \
  -H "Authorization: Bearer <token>"
```

### Cached Response

```bash
# First request: Cache miss, fetches from DB
# Subsequent requests: Cache hit, faster response
curl http://localhost:3000/v1/products/123 \
  -H "Authorization: Bearer <token>"
```

## 🔐 Security Best Practices

1. **JWT Secrets**: Use strong, random secrets
2. **HTTPS**: Enable TLS in production
3. **Rate Limiting**: Prevent abuse
4. **Input Validation**: All inputs validated
5. **SQL Injection**: TypeORM parameterized queries
6. **CORS**: Configure allowed origins
7. **Helmet**: Security headers enabled

## 📈 Performance Optimization

1. **Connection Pooling**: Database and Redis pools configured
2. **Caching**: Aggressive caching with smart invalidation
3. **Compression**: Gzip enabled in Nginx
4. **Keep-Alive**: HTTP keep-alive connections
5. **Load Balancing**: Nginx upstream with least_conn

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

UNLICENSED

## 🙋 Support

For questions and issues, please open a GitHub issue.

---

**Built with ❤️ for high-scale production environments**
