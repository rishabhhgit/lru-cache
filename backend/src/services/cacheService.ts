/**
 * cacheService.ts
 *
 * Previously this was an HTTP proxy to the C++ cache server.
 * It now owns the LRU cache in-process using the TypeScript port of the
 * same algorithm (lruCache.ts), so the full stack runs on Vercel with no
 * external dependency.
 *
 * The public method signatures are identical to before — routes/cache.ts
 * does not need to change.
 */

import { LRUCache } from './lruCache';
import type { CacheStats, PutResult } from './lruCache';

export type { CacheStats };

// ── Response shapes (mirror the old C++ server JSON) ───────────────────────

export interface GetEntryResponse {
    key: string;
    value: string | null;
    hit: boolean;
}

export interface PutEntryResponse {
    key: string;
    value: string;
    inserted: boolean;
    updated: boolean;
    evicted: boolean;
    evicted_entry: { key: string; value: string } | null;
    message: string;
}

export interface DeleteEntryResponse {
    key: string;
    value: string;
    message: string;
}

export interface ListCacheResponse {
    count: number;
    entries: Array<{
        key: string;
        value: string;
        hit: boolean;
        position: number;
        is_mru: boolean;
        is_lru: boolean;
    }>;
    lru_to_mru: Array<{
        key: string;
        value: string;
        hit: boolean;
        position: number;
        is_lru: boolean;
        is_mru: boolean;
    }>;
    oldest_lru: { key: string; value: string } | null;
    newest_mru: { key: string; value: string } | null;
}

// ── Singleton cache instance ────────────────────────────────────────────────

// Default capacity 100; override with CACHE_CAPACITY env var.
const DEFAULT_CAPACITY = parseInt(process.env.CACHE_CAPACITY ?? '100', 10);

// Module-level singleton so all requests share the same cache state.
let _cache: LRUCache<string, string> | null = null;

function getCache(): LRUCache<string, string> {
    if (!_cache) {
        _cache = new LRUCache<string, string>(DEFAULT_CAPACITY);
    }
    return _cache;
}

// ── CacheService ────────────────────────────────────────────────────────────

export class CacheService {
    private readonly cache: LRUCache<string, string>;

    constructor() {
        this.cache = getCache();
    }

    /** Used by the health route — always healthy when running in-process. */
    getBaseURL(): string {
        return 'in-process';
    }

    health(): { ok: boolean; status?: number; body?: unknown } {
        return { ok: true, status: 200, body: { status: 'ok', service: 'cachelab-ts-engine' } };
    }

    getEntry(key: string): GetEntryResponse {
        const value = this.cache.get(key);
        if (value !== null) {
            return { key, value, hit: true };
        }
        return { key, value: null, hit: false };
    }

    putEntry(key: string, value: unknown): PutEntryResponse {
        const strValue = typeof value === 'string' ? value : JSON.stringify(value);
        const result: PutResult<string, string> = this.cache.put(key, strValue);
        return {
            key,
            value: strValue,
            inserted: result.inserted,
            updated: result.updated,
            evicted: result.evicted,
            evicted_entry: result.evicted
                ? { key: result.evicted_key!, value: result.evicted_value! }
                : null,
            message: result.inserted ? 'inserted' : 'updated',        };
    }

    deleteEntry(key: string): DeleteEntryResponse {
        const value = this.cache.remove(key);
        if (value === null) {
            throw Object.assign(new Error('key not found'), { statusCode: 404 });
        }
        return { key, value, message: 'deleted' };
    }

    listEntries(): ListCacheResponse {
        const mruToLru = this.cache.getEntriesMRUtoLRU();
        const lruToMru = this.cache.getEntriesLRUtoMRU();

        return {
            count: mruToLru.length,
            entries: mruToLru.map(e => ({ ...e, hit: true })),
            lru_to_mru: lruToMru.map(e => ({ ...e, hit: true })),
            oldest_lru: lruToMru.length > 0
                ? { key: lruToMru[0].key, value: lruToMru[0].value }
                : null,
            newest_mru: mruToLru.length > 0
                ? { key: mruToLru[0].key, value: mruToLru[0].value }
                : null,
        };
    }

    getStats(): CacheStats {
        return this.cache.getStats();
    }

    clear(): { message: string } {
        this.cache.clear();
        return { message: 'cache cleared' };
    }

    resize(capacity: number): { message: string; capacity: number } {
        this.cache.resize(capacity);
        return { message: 'resized', capacity };
    }

    resetStats(): { message: string } {
        this.cache.resetStats();
        return { message: 'stats reset' };
    }
}
