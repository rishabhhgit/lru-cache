import axios, { type AxiosError, type AxiosResponse } from 'axios';
import type {
    CacheEntry,
    CacheStats,
    GetEntryResponse,
    ListCacheResponse,
} from '@/types/cache';

/**
 * Thin HTTP client for the CacheLab Express gateway.
 *
 * The gateway forwards every operation to the C++ cache server. If the C++
 * server is unreachable, the gateway returns an honest 502 instead of a
 * fabricated success, and we surface that error here.
 */
const client = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
    headers: { 'Content-Type': 'application/json' },
});

client.interceptors.response.use(
    (res) => res,
    (err: AxiosError) => {
        if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
            // eslint-disable-next-line no-console
            console.error('[cache-api] gateway unreachable:', err.message);
        }
        return Promise.reject(err);
    },
);

async function request<T>(promise: Promise<AxiosResponse<T>>): Promise<T> {
    const res = await promise;
    return res.data as T;
}

export const cacheApi = {
    health: () => request<{ ok: boolean; status?: number }>(client.get('/health')),

    getEntry: (key: string) =>
        request<GetEntryResponse>(client.get(`/cache/${encodeURIComponent(key)}`)),

    putEntry: (key: string, value: unknown) =>
        request<{ key: string; value: string; message: string }>(
            client.put(`/cache/${encodeURIComponent(key)}`, { value }),
        ),

    deleteEntry: (key: string) =>
        request<{ key: string; message: string }>(
            client.delete(`/cache/${encodeURIComponent(key)}`),
        ),

    listEntries: () => request<ListCacheResponse>(client.get('/cache')),

    getStats: () => request<CacheStats>(client.get('/stats')),

    clear: () => request<{ message: string }>(client.post('/clear')),

    resize: (capacity: number) =>
        request<{ message: string; capacity: number }>(client.post('/resize', { capacity })),

    resetStats: () => request<{ message: string }>(client.post('/stats/reset')),
};

export type {
    CacheEntry,
    CacheStats,
    GetEntryResponse,
    ListCacheResponse,
};
