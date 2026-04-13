# Redis Caching & Session Management Implementation

This document describes the Redis integration for distributed caching and session management in the NestJS shopping application.

## Overview

Redis has been integrated into the backend to:
1. **Cache product listings** - Reduce database queries with a 10-minute TTL
2. **Automatic cache invalidation** - Clears cache on product CRUD operations
3. **Provide session management** - Foundation for distributed session handling
4. **Enable manual cache control** - Admin endpoint for testing and debugging

## Infrastructure Setup

### Docker Compose Configuration

The `docker-compose.yml` includes Redis Stack with RedisInsight:

```yaml
redis:
  image: redis/redis-stack:latest
  ports:
    - "6379:6379"      # Redis server
    - "8001:8001"      # RedisInsight UI
  environment:
    REDIS_PASSWORD: redis_pass_123
  volumes:
    - redis_data:/data
    - ./redis.conf:/usr/local/etc/redis/redis.conf
```

**Key Features:**
- **Redis Stack** includes Redis + RedisInsight for visual debugging
- **Password Protected** with `redis_pass_123` (change in production)
- **Data Persistence** via RDB and AOF mechanisms
- **Health Checks** to ensure Redis readiness

### Redis Configuration

`redis.conf` includes:
- **RDB Snapshots** - Automatic persistence every 900s, 300s, or 60s based on change thresholds
- **AOF Persistence** - Append-only file for durability
- **Memory Management** - Max 256MB with LRU eviction policy
- **Keyspace Notifications** - Enabled for debugging support

## NestJS Backend Integration

### Installation

Dependencies added to `package.json`:
```json
{
  "@nestjs/cache-manager": "^2.1.1",
  "cache-manager": "^5.2.3",
  "cache-manager-redis-yet": "^4.1.2",
  "redis": "^4.6.13"
}
```

Install with:
```bash
npm install
```

### Redis Module

**File:** `src/redis/redis.module.ts`

Registers `CacheModule` globally with Redis store configuration:
- Automatically connects to Redis using environment variables
- Configures 10-minute default TTL
- Exports `RedisService` for manual cache operations

### Redis Service

**File:** `src/redis/redis.service.ts`

Provides utility methods:
- `get<T>(key)` - Retrieve cached values
- `set<T>(key, value, ttl)` - Store values with optional TTL
- `delete(key)` - Remove single cache key
- `deleteMany(keys)` - Remove multiple keys
- `clear()` - Clear entire cache
- `getOrSet<T>(key, fn, ttl)` - Cache-aside pattern helper

### Products Service Caching

**File:** `src/products/products.service.ts`

Implements cache-aside pattern for product listings:

```typescript
async list() {
  // Try cache first
  const cachedProducts = await this.cacheManager.get(this.PRODUCTS_CACHE_KEY);
  if (cachedProducts) return cachedProducts;

  // Fetch from DB and cache
  const products = await this.prisma.product.findMany(...);
  await this.cacheManager.set(this.PRODUCTS_CACHE_KEY, products, this.PRODUCTS_CACHE_TTL);
  return products;
}
```

**Automatic Cache Invalidation:**
- `create()` - Invalidates on new product
- `update()` - Invalidates on product modification
- `remove()` - Invalidates on product deletion

## API Endpoints

### Cache Management Endpoint

**Clear Products Cache (Admin)**
```
DELETE /products/cache/clear
Authorization: Bearer {jwt_token}
```

Response:
```json
{
  "success": true,
  "message": "Products cache cleared"
}
```

Used for:
- Testing during development
- Manual cache invalidation
- Debugging cache issues

## Environment Variables

Add to `.env`:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_pass_123
```

See `.env.example` for complete configuration template.

## Running the Application

### 1. Start Infrastructure
```bash
docker-compose up -d
```

This starts:
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`
- RedisInsight UI on `http://localhost:8001`

### 2. Configure Environment
```bash
cp .env.example .env
# Update .env with your configuration
```

### 3. Run Migrations
```bash
npx prisma migrate deploy
```

### 4. Start Backend
```bash
npm run start:dev
```

### 5. Access Services

| Service | URL |
|---------|-----|
| Backend API | `http://localhost:3002` |
| RedisInsight | `http://localhost:8001` |
| PostgreSQL | `localhost:5432` |

## Debugging with RedisInsight

1. Open `http://localhost:8001` in browser
2. Connect to Redis at `localhost:6379`
3. Use password: `redis_pass_123`
4. View cached keys in real-time
5. Inspect cache structure and TTLs

## Cache Flow Examples

### Product Listing (with cache)
```
1. Client: GET /products
2. Server: Check cache for "products:list"
3A. Cache HIT: Return cached products
3B. Cache MISS:
    - Query database
    - Store result in Redis with 10min TTL
    - Return to client
```

### Product Creation (with invalidation)
```
1. Client: POST /products (create new product)
2. Server:
    - Create product in database
    - Delete "products:list" from cache
    - Return created product
3. Next GET /products:
    - Cache is empty, queries database
    - Recaches fresh product list
```

## Performance Benefits

- **Reduced Database Load**: Product list queries can be served from Redis
- **Lower Latency**: Cache hits return in milliseconds vs seconds from DB
- **Automatic Staleness Prevention**: Cache invalidation ensures data consistency
- **Scalability**: Foundation for distributed session management across multiple servers

## Future Enhancements

1. **Session Storage** - Store JWT sessions in Redis
2. **Rate Limiting** - Implement request rate limiting with Redis
3. **Pub/Sub Messaging** - Cache invalidation across multiple servers
4. **Cache Warming** - Pre-load frequently accessed data on startup
5. **Fine-grained Cache Control** - Cache individual products by ID

## Troubleshooting

### Redis Connection Failed
- Verify Redis is running: `docker-compose ps`
- Check credentials match `.env`
- Ensure port 6379 is not blocked

### Cache Not Working
- Check Redis logs: `docker-compose logs redis`
- Verify environment variables are set
- Restart backend: cache will rebuild on next access

### RedisInsight Won't Connect
- Ensure port 8001 is open
- Try accessing via `http://127.0.0.1:8001`
- Check Docker network connectivity

## References

- [cache-manager Documentation](https://www.npmjs.com/package/cache-manager)
- [cache-manager-redis-yet](https://www.npmjs.com/package/cache-manager-redis-yet)
- [NestJS Caching](https://docs.nestjs.com/techniques/caching)
- [Redis Documentation](https://redis.io/docs/)
