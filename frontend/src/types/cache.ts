/**
 * Shared TypeScript types for the CacheLab frontend.
 * Mirrors the API envelopes returned by the Express gateway / C++ cache server.
 */

/** Envelope for all API responses. */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

/** A single cache entry (MRU -> LRU). */
export interface CacheEntry {
    key: string;
    value: string;
    hit: boolean;
}

/** GET /api/cache (list) response data. */
export interface ListCacheResponse {
    count: number;
    entries: CacheEntry[];
}

/** GET /api/stats response data. */
export interface CacheStats {
    capacity: number;
    size: number;
    hits: number;
    misses: number;
    hit_rate: number;
    miss_rate: number;
    evictions: number;
}

/** GET /api/cache/:key response data. */
export interface GetEntryResponse {
    key: string;
    value: string | null;
    hit: boolean;
}

/** PUT /api/cache/:key request body. */
export interface PutEntryRequest {
    value: unknown;
}

/** POST /api/cache/resize request body. */
export interface ResizeRequest {
    capacity: number;
}
