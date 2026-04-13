import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get a value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.cacheManager.get<T>(key);
      this.logger.debug(`Cache HIT: ${key}`);
      return value || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error getting cache key ${key}: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Set a value in cache with optional TTL
   */
  async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl || undefined);
      this.logger.debug(`Cache SET: ${key} (TTL: ${ttl}ms)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error setting cache key ${key}: ${errorMessage}`);
    }
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string): Promise<number> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache DELETE: ${key}`);
      return 1;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error deleting cache key ${key}: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deleteMany(keys: string[]): Promise<number> {
    let deletedCount = 0;
    for (const key of keys) {
      try {
        await this.cacheManager.del(key);
        deletedCount++;
        this.logger.debug(`Cache DELETE: ${key}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error deleting cache key ${key}: ${errorMessage}`);
      }
    }
    return deletedCount;
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      await this.cacheManager.reset();
      this.logger.log('Cache cleared completely');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error clearing cache: ${errorMessage}`);
    }
  }

  /**
   * Cache-Aside pattern helper
   * Get from cache or fetch from source function and cache the result
   */
  async getOrSet<T = any>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    // Try to get from cache
    const cachedValue = await this.get<T>(key);
    if (cachedValue) {
      return cachedValue;
    }

    // Cache miss - fetch from source
    this.logger.debug(`Cache MISS: ${key}, fetching from source`);
    const value = await fn();

    // Store in cache
    await this.set(key, value, ttl);
    return value;
  }
}
