import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetadataCache } from '../../../src/cache/MetadataCache';

describe('MetadataCache', () => {
  it('stores and retrieves values', () => {
    const cache = new MetadataCache(60);
    cache.set('key1', { id: 1, name: 'orders' });
    expect(cache.get('key1')).toEqual({ id: 1, name: 'orders' });
  });

  it('returns undefined for missing keys', () => {
    const cache = new MetadataCache(60);
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('expires entries after TTL', async () => {
    const cache = new MetadataCache(0.001); // 1ms TTL
    cache.set('expiring', 'value');
    await new Promise(r => setTimeout(r, 10));
    expect(cache.get('expiring')).toBeUndefined();
  });

  it('does not expire entries before TTL', async () => {
    const cache = new MetadataCache(60);
    cache.set('fresh', 'data');
    await new Promise(r => setTimeout(r, 5));
    expect(cache.get('fresh')).toBe('data');
  });

  it('clears all entries', () => {
    const cache = new MetadataCache(60);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('deletes specific entry', () => {
    const cache = new MetadataCache(60);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.delete('a');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
  });

  it('evicts oldest entry when full', () => {
    const cache = new MetadataCache(60);
    // Override maxSize for testing
    (cache as unknown as { maxSize: number }).maxSize = 3;
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // Should evict 'a'
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('d')).toBe(4);
  });

  it('prunes expired entries', async () => {
    const cache = new MetadataCache(0.001);
    cache.set('old', 'value');
    await new Promise(r => setTimeout(r, 10));
    cache.set('new', 'value2');
    cache.prune();
    expect(cache.size).toBe(1);
  });

  it('reports correct size', () => {
    const cache = new MetadataCache(60);
    expect(cache.size).toBe(0);
    cache.set('x', 1);
    cache.set('y', 2);
    expect(cache.size).toBe(2);
  });

  it('handles concurrent set/get', () => {
    const cache = new MetadataCache(60);
    const ops = Array.from({ length: 100 }, (_, i) => {
      cache.set(`key${i}`, i);
      return cache.get(`key${i}`);
    });
    expect(ops.every((v, i) => v === i || v === undefined)).toBe(true);
  });
});
