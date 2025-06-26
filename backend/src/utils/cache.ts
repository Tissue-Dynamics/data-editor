/**
 * LRU Cache implementation with TTL support to prevent memory leaks
 */
export class LRUCache<K, V> {
  private maxSize: number;
  private ttl: number; // milliseconds
  private cache: Map<K, { value: V; timestamp: number }>;
  private accessOrder: K[];

  constructor(maxSize = 100, ttlSeconds = 3600) {
    this.maxSize = maxSize;
    this.ttl = ttlSeconds * 1000;
    this.cache = new Map();
    this.accessOrder = [];
  }

  set(key: K, value: V): void {
    // Remove expired entries first
    this.evictExpired();

    // If key exists, remove it from access order
    if (this.cache.has(key)) {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }

    // Add to end of access order
    this.accessOrder.push(key);
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });

    // Evict oldest if over capacity
    while (this.accessOrder.length > this.maxSize) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.delete(key);
      return undefined;
    }

    // Move to end of access order
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
    }

    return entry.value;
  }

  delete(key: K): boolean {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    return this.cache.delete(key);
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check expiration
    if (Date.now() - entry.timestamp > this.ttl) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  get size(): number {
    this.evictExpired();
    return this.cache.size;
  }

  private evictExpired(): void {
    const now = Date.now();
    const keysToDelete: K[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }
  }

  // Get all values (for iteration)
  values(): V[] {
    this.evictExpired();
    return Array.from(this.cache.values()).map(entry => entry.value);
  }
}