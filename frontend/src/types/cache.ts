/**
 * Shared TypeScript types for the CacheLab frontend.
 * Mirrors the API envelopes returned by the Express gateway and C++ cache server.
 */

/** Envelope for all API responses from Express gateway. */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    key?: string;
    service?: string;
    cppServer?: string;
}

/** A single cache entry. */
export interface CacheEntry {
    key: string;
    value: string;
    hit?: boolean;
    position?: number;
    is_mru?: boolean;
    is_lru?: boolean;
}

/** GET /api/cache (list) response data. */
export interface ListCacheResponse {
    count: number;
    entries: CacheEntry[];
    lru_to_mru?: CacheEntry[];
    oldest_lru?: { key: string; value: string } | null;
    newest_mru?: { key: string; value: string } | null;
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

/** PUT /api/cache/:key or POST /api/cache response data. */
export interface PutEntryResponse {
    key: string;
    value: string;
    inserted?: boolean;
    updated?: boolean;
    evicted?: boolean;
    evicted_entry?: { key: string; value: string } | null;
    message: string;
}

/** DELETE /api/cache/:key response data. */
export interface DeleteEntryResponse {
    key: string;
    value?: string;
    message: string;
}

/** Health check response data. */
export interface HealthResponse {
    success: boolean;
    service: string;
    cppServer: string;
}

/** History entry for operation audit trail. */
export interface OperationLog {
    id: string;
    type: 'GET' | 'PUT' | 'DELETE' | 'CLEAR' | 'RESIZE' | 'RESET_STATS';
    key?: string;
    value?: string;
    hit?: boolean;
    evictedKey?: string;
    status: 'success' | 'error';
    message: string;
    latencyMs: number;
    timestamp: string;
    sizeAfter?: number;
}
