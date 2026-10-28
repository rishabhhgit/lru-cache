import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

/** Shape of a JSON value stored in the C++ cache. */
export type CacheValue = string;

/** Response from GET /cache/:key */
export interface GetEntryResponse {
    key: string;
    value: string | null;
    hit: boolean;
}

/** Response from GET /cache (all entries, MRU -> LRU) */
export interface CacheEntry {
    key: string;
    value: string;
    hit: boolean;
}
export interface ListCacheResponse {
    count: number;
    entries: CacheEntry[];
}

/** Response from GET /stats */
export interface CacheStats {
    capacity: number;
    size: number;
    hits: number;
    misses: number;
    hit_rate: number;
    miss_rate: number;
    evictions: number;
}

/** Generic success/error envelope returned by the C++ server. */
interface CppResponse<T> {
    message?: string;
    error?: string;
    [key: string]: unknown;
    data?: T;
}

/**
 * CacheService forwards cache operations to the C++ HTTP cache server.
 *
 * It is a thin HTTP client: it never duplicates cache state and never
 * fabricates responses. If the C++ server is unreachable, errors propagate
 * so the gateway can report an honest 502 instead of a fake success.
 */
export class CacheService {
    private readonly client: AxiosInstance;

    constructor(baseURL: string, timeoutMs = 5000) {
        this.client = axios.create({
            baseURL,
            timeout: timeoutMs,
            headers: { 'Content-Type': 'application/json' },
        });

        // Log outgoing requests for observability.
        this.client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
            const method = config.method?.toUpperCase() ?? 'REQUEST';
            const url = config.url ?? '';
            // eslint-disable-next-line no-console
            console.log(`[cache-service] ${method} ${url}`);
            return config;
        });

        // Surface a clear, consistent error when the C++ server is down.
        this.client.interceptors.response.use(
            (res) => res,
            (err: AxiosError) => {
                if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
                    // eslint-disable-next-line no-console
                    console.error(
                        `[cache-service] C++ cache server unreachable at ${baseURL}: ${err.message}`,
                    );
                }
                return Promise.reject(err);
            },
        );
    }

    /** Base URL of the C++ cache server (for health checks / error messages). */
    getBaseURL(): string {
        return this.client.defaults.baseURL ?? '';
    }

    async health(): Promise<{ ok: boolean; status?: number; body?: unknown }> {
        try {
            const res = await this.client.get<unknown>('/health');
            return { ok: true, status: res.status, body: res.data };
        } catch (err) {
            return { ok: false, status: (err as AxiosError).response?.status, body: undefined };
        }
    }

    async getEntry(key: string): Promise<GetEntryResponse> {
        try {
            const res = await this.client.get<GetEntryResponse>(`/cache/${encodeURIComponent(key)}`);
            return res.data;
        } catch (err) {
            const axiosErr = err as AxiosError;
            // A 404 from the C++ server means a cache miss, not an error.
            // Return a miss result so the gateway can report it honestly.
            if (axiosErr.response?.status === 404) {
                return { key, value: null, hit: false };
            }
            throw err;
        }
    }

    async putEntry(key: string, value: unknown): Promise<{ key: string; value: string; message: string }> {
        const res = await this.client.put<{ key: string; value: string; message: string }>(
            `/cache/${encodeURIComponent(key)}`,
            { value },
        );
        return res.data;
    }

    async deleteEntry(key: string): Promise<{ key: string; message: string }> {
        const res = await this.client.delete<{ key: string; message: string }>(
            `/cache/${encodeURIComponent(key)}`,
        );
        return res.data;
    }

    async listEntries(): Promise<ListCacheResponse> {
        const res = await this.client.get<ListCacheResponse>('/cache');
        return res.data;
    }

    async getStats(): Promise<CacheStats> {
        const res = await this.client.get<CacheStats>('/stats');
        return res.data;
    }

    async clear(): Promise<{ message: string }> {
        const res = await this.client.post<{ message: string }>('/clear');
        return res.data;
    }

    async resize(capacity: number): Promise<{ message: string; capacity: number }> {
        const res = await this.client.post<{ message: string; capacity: number }>('/resize', {
            capacity,
        });
        return res.data;
    }

    async resetStats(): Promise<{ message: string }> {
        const res = await this.client.post<{ message: string }>('/stats/reset');
        return res.data;
    }
}
