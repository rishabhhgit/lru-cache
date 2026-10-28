import request from 'supertest';
import { createApp } from '../src/app';
import { CacheService } from '../src/services/cacheService';

describe('CacheLab Express Gateway Unit Tests', () => {
    let mockService: Partial<CacheService>;
    let app: ReturnType<typeof createApp>;

    beforeEach(() => {
        mockService = {
            health: jest.fn().mockResolvedValue({ ok: true, status: 200 }),
            getEntry: jest.fn().mockImplementation(async (key: string) => {
                if (key === 'hit-key') {
                    return { key, value: 'hit-value', hit: true };
                }
                return { key, value: null, hit: false };
            }),
            putEntry: jest.fn().mockImplementation(async (key: string, value: unknown) => {
                return {
                    key,
                    value: String(value),
                    inserted: true,
                    updated: false,
                    evicted: false,
                    evicted_entry: null,
                    message: 'ok',
                };
            }),
            deleteEntry: jest.fn().mockImplementation(async (key: string) => {
                if (key === 'missing-key') {
                    const err: any = new Error('Not found');
                    err.response = { status: 404, data: { error: 'key not found' } };
                    throw err;
                }
                return { key, value: 'deleted-val', message: 'deleted' };
            }),
            listEntries: jest.fn().mockResolvedValue({
                count: 2,
                entries: [
                    { key: 'b', value: '2', hit: true, position: 0, is_mru: true, is_lru: false },
                    { key: 'a', value: '1', hit: true, position: 1, is_mru: false, is_lru: true },
                ],
                lru_to_mru: [
                    { key: 'a', value: '1', hit: true, position: 0, is_lru: true, is_mru: false },
                    { key: 'b', value: '2', hit: true, position: 1, is_lru: false, is_mru: true },
                ],
                oldest_lru: { key: 'a', value: '1' },
                newest_mru: { key: 'b', value: '2' },
            }),
            getStats: jest.fn().mockResolvedValue({
                capacity: 5,
                size: 2,
                hits: 10,
                misses: 2,
                hit_rate: 83.33,
                miss_rate: 16.67,
                evictions: 1,
            }),
            clear: jest.fn().mockResolvedValue({ message: 'cache cleared' }),
            resize: jest.fn().mockImplementation(async (capacity: number) => ({
                message: 'resized',
                capacity,
            })),
            resetStats: jest.fn().mockResolvedValue({ message: 'stats reset' }),
            getBaseURL: jest.fn().mockReturnValue('http://localhost:8080'),
        };

        app = createApp(mockService as CacheService);
    });

    it('GET /health returns gateway health and C++ status', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.cppServer).toBe('ok');
    });

    it('GET /health returns 502 when C++ is unreachable', async () => {
        (mockService.health as jest.Mock).mockResolvedValueOnce({ ok: false });
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(502);
        expect(res.body.success).toBe(false);
    });

    it('GET /api/cache/:key returns 200 on hit', async () => {
        const res = await request(app).get('/api/cache/hit-key');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.hit).toBe(true);
        expect(res.body.data.value).toBe('hit-value');
    });

    it('GET /api/cache/:key returns 404 on cache miss', async () => {
        const res = await request(app).get('/api/cache/miss-key');
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(true);
        expect(res.body.data.hit).toBe(false);
        expect(res.body.data.value).toBeNull();
    });

    it('PUT /api/cache/:key saves entry with metadata', async () => {
        const res = await request(app).put('/api/cache/k1').send({ value: 'val1' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.key).toBe('k1');
        expect(res.body.data.inserted).toBe(true);
    });

    it('PUT /api/cache/:key returns 400 when value is missing', async () => {
        const res = await request(app).put('/api/cache/k1').send({});
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('POST /api/cache saves entry with body key and value', async () => {
        const res = await request(app).post('/api/cache').send({ key: 'k2', value: 'val2' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.key).toBe('k2');
    });

    it('POST /api/cache returns 400 when key is missing or empty', async () => {
        const res = await request(app).post('/api/cache').send({ value: 'val2' });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('DELETE /api/cache/:key removes key and returns 200', async () => {
        const res = await request(app).delete('/api/cache/k1');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.message).toBe('deleted');
    });

    it('DELETE /api/cache clears the entire cache', async () => {
        const res = await request(app).delete('/api/cache');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.message).toBe('cache cleared');
    });

    it('GET /api/cache returns entries with LRU-to-MRU ordering info', async () => {
        const res = await request(app).get('/api/cache');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.count).toBe(2);
        expect(res.body.data.lru_to_mru).toBeDefined();
        expect(res.body.data.oldest_lru.key).toBe('a');
        expect(res.body.data.newest_mru.key).toBe('b');
    });

    it('GET /api/stats returns statistics', async () => {
        const res = await request(app).get('/api/stats');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.capacity).toBe(5);
        expect(res.body.data.hit_rate).toBeCloseTo(83.33);
    });

    it('POST /api/cache/resize updates capacity', async () => {
        const res = await request(app).post('/api/cache/resize').send({ capacity: 10 });
        expect(res.status).toBe(200);
        expect(res.body.data.capacity).toBe(10);
    });

    it('POST /api/cache/resize rejects negative and zero capacities', async () => {
        const res1 = await request(app).post('/api/cache/resize').send({ capacity: 0 });
        expect(res1.status).toBe(400);

        const res2 = await request(app).post('/api/cache/resize').send({ capacity: -5 });
        expect(res2.status).toBe(400);

        const res3 = await request(app).post('/api/cache/resize').send({ capacity: 'ten' });
        expect(res3.status).toBe(400);
    });

    it('POST /api/stats/reset resets hit and miss counters', async () => {
        const res = await request(app).post('/api/stats/reset').send({});
        expect(res.status).toBe(200);
        expect(res.body.data.message).toBe('stats reset');
    });
});
