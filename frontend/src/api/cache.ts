import axios, { type AxiosError } from 'axios';
import type {
    ApiResponse,
    CacheEntry,
    CacheStats,
    DeleteEntryResponse,
    GetEntryResponse,
    HealthResponse,
    ListCacheResponse,
    PutEntryResponse,
} from '@/types/cache';

const client = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
});

/**
 * Unwraps the backend ApiResponse<T> envelope.
 * If the response contains an error or non-success, throws with the error message.
 */
async function request<T>(requestFn: () => Promise<{ data: ApiResponse<T> }>): Promise<T> {
    try {
        const res = await requestFn();
        if (res.data && typeof res.data === 'object') {
            if ('data' in res.data && res.data.data !== undefined) {
                return res.data.data as T;
            }
            return res.data as unknown as T;
        }
        return res.data as unknown as T;
    } catch (err) {
        const axiosErr = err as AxiosError<ApiResponse<unknown>>;
        if (axiosErr.response?.data?.error) {
            throw new Error(axiosErr.response.data.error);
        }
        if (axiosErr.response?.status === 502) {
            throw new Error('C++ Cache Server is unreachable (HTTP 502)');
        }
        if (axiosErr.code === 'ECONNREFUSED') {
            throw new Error('Backend gateway is unreachable (Connection refused)');
        }
        throw new Error(axiosErr.message || 'Unknown network error');
    }
}

export const cacheApi = {
    health: async (): Promise<{ ok: boolean; cppServer: string; service: string }> => {
        try {
            const res = await client.get<HealthResponse>('/health');
            const data = res.data;
            const ok = Boolean(data?.success && data?.cppServer === 'ok');
            return {
                ok,
                cppServer: data?.cppServer ?? 'down',
                service: data?.service ?? 'cachelab-gateway',
            };
        } catch {
            return {
                ok: false,
                cppServer: 'down',
                service: 'cachelab-gateway',
            };
        }
    },

    getEntry: async (key: string): Promise<GetEntryResponse> => {
        try {
            const res = await client.get<ApiResponse<GetEntryResponse>>(`/cache/${encodeURIComponent(key)}`);
            if (res.data?.data) {
                return res.data.data;
            }
            return res.data as unknown as GetEntryResponse;
        } catch (err) {
            const axiosErr = err as AxiosError<ApiResponse<GetEntryResponse>>;
            // 404 indicates a clean cache miss from the server
            if (axiosErr.response?.status === 404 && axiosErr.response?.data?.data) {
                return axiosErr.response.data.data;
            }
            if (axiosErr.response?.data?.error) {
                throw new Error(axiosErr.response.data.error);
            }
            throw err;
        }
    },

    putEntry: (key: string, value: unknown): Promise<PutEntryResponse> =>
        request<PutEntryResponse>(() =>
            client.put<ApiResponse<PutEntryResponse>>(`/cache/${encodeURIComponent(key)}`, { value }),
        ),

    postEntry: (key: string, value: unknown): Promise<PutEntryResponse> =>
        request<PutEntryResponse>(() =>
            client.post<ApiResponse<PutEntryResponse>>('/cache', { key, value }),
        ),

    deleteEntry: (key: string): Promise<DeleteEntryResponse> =>
        request<DeleteEntryResponse>(() =>
            client.delete<ApiResponse<DeleteEntryResponse>>(`/cache/${encodeURIComponent(key)}`),
        ),

    listEntries: (): Promise<ListCacheResponse> =>
        request<ListCacheResponse>(() =>
            client.get<ApiResponse<ListCacheResponse>>('/cache'),
        ),

    getStats: (): Promise<CacheStats> =>
        request<CacheStats>(() =>
            client.get<ApiResponse<CacheStats>>('/stats'),
        ),

    clear: (): Promise<{ message: string }> =>
        request<{ message: string }>(() =>
            client.delete<ApiResponse<{ message: string }>>('/cache'),
        ),

    resize: (capacity: number): Promise<{ message: string; capacity: number }> =>
        request<{ message: string; capacity: number }>(() =>
            client.post<ApiResponse<{ message: string; capacity: number }>>('/cache/resize', { capacity }),
        ),

    resetStats: (): Promise<{ message: string }> =>
        request<{ message: string }>(() =>
            client.post<ApiResponse<{ message: string }>>('/stats/reset'),
        ),
};

export type {
    CacheEntry,
    CacheStats,
    GetEntryResponse,
    HealthResponse,
    ListCacheResponse,
    PutEntryResponse,
    DeleteEntryResponse,
};
