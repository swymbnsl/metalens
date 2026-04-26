interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory LRU-like cache for OpenMetadata API responses.
 * Default TTL is 5 minutes (300 seconds).
 */
export class MetadataCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxSize = 200;

  constructor(private ttlSeconds: number = 300) {}

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    // LRU: re-insert to move to end
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    if (this.store.size >= this.maxSize) {
      // Evict oldest entry (first key in insertion order)
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) {
        this.store.delete(firstKey);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  /** Remove all expired entries */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}
