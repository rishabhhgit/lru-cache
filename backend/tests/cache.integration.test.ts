import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { createApp } from '../src/app';
import { CacheService } from '../src/services/cacheService';
import request from 'supertest';

const CPP_TEST_PORT = 8199;
const CPP_BASE_URL = `http://localhost:${CPP_TEST_PORT}`;

let cppProc: ChildProcess | null = null;
let app: ReturnType<typeof createApp>;

async function waitForCppServer(baseURL: string, timeoutMs = 10000): Promise<void> {
    const start = Date.now();
    const { default: axios } = await import('axios');
    while (Date.now() - start < timeoutMs) {
        try {
            await axios.get(`${baseURL}/health`, { timeout: 1000 });
            return;
        } catch {
            await new Promise((r) => setTimeout(r, 200));
        }
    }
    throw new Error(`C++ cache server did not become healthy at ${baseURL}`);
}

beforeAll(async () => {
    const bin = process.env.CPP_SERVER_BIN || path.join(__dirname, '../../cpp-engine/build/cache_server');
    cppProc = spawn(bin, ['--port', String(CPP_TEST_PORT), '--capacity', '3'], {
        stdio: 'ignore',
    });
    await waitForCppServer(CPP_BASE_URL);

    process.env.CACHE_SERVER_URL = CPP_BASE_URL;
    app = createApp();
});

afterAll(() => {
    if (cppProc) {
        cppProc.kill('SIGTERM');
        cppProc = null;
    }
});

const api = (appInstance: ReturnType<typeof createApp>) => request(appInstance);

describe('CacheLab gateway integration (real C++ cache server)', () => {
    it('GET /api/health reports ok when C++ server is up', async () => {
        const res = await api(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('PUT then GET a key round-trips through the C++ server', async () => {
        const put = await api(app).put('/api/cache/user:1').send({ value: { name: 'Ada', role: 'engineer' } });
        expect(put.status).toBe(200);
        expect(put.body.success).toBe(true);
        expect(put.body.data.key).toBe('user:1');

        const get = await api(app).get('/api/cache/user:1');
        expect(get.status).toBe(200);
        expect(get.body.success).toBe(true);
        expect(get.body.data.hit).toBe(true);
        expect(get.body.data.value).toBe('{"name":"Ada","role":"engineer"}');
    });

    it('GET a missing key returns a cache miss (404), not a hit', async () => {
        const res = await api(app).get('/api/cache/does-not-exist');
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(true);
        expect(res.body.data.hit).toBe(false);
        expect(res.body.data.value).toBeNull();
    });

    it('PUT without value returns 400', async () => {
        const res = await api(app).put('/api/cache/no-value').send({});
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('GET /api/cache returns entries in MRU -> LRU order', async () => {
        await api(app).put('/api/cache/k1').send({ value: 'v1' });
        await api(app).put('/api/cache/k2').send({ value: 'v2' });
        await api(app).put('/api/cache/k3').send({ value: 'v3' });
        await api(app).get('/api/cache/k1');

        const res = await api(app).get('/api/cache');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        const keys = res.body.data.entries.map((e: { key: string }) => e.key);
        expect(keys[0]).toBe('k1'); // MRU
        expect(keys[keys.length - 1]).toBe('k2'); // LRU
    });


    it('PUT a new key when full evicts the LRU entry', async () => {
        await api(app).post('/api/cache/clear').send({});
        await api(app).put('/api/cache/e1').send({ value: '1' });
        await api(app).put('/api/cache/e2').send({ value: '2' });
        await api(app).put('/api/cache/e3').send({ value: '3' });

        await api(app).put('/api/cache/e4').send({ value: '4' });

        const after = await api(app).get('/api/cache/e1');
        expect(after.body.data.hit).toBe(false);
        expect(after.status).toBe(404);

        const stats = await api(app).get('/api/stats');
        expect(stats.body.data.evictions).toBeGreaterThan(0);
    });
    it('GET /api/stats returns capacity, size, hits, misses, rates, evictions', async () => {
        const res = await api(app).get('/api/stats');
        expect(res.status).toBe(200);
        const s = res.body.data;
        expect(typeof s.capacity).toBe('number');
        expect(typeof s.size).toBe('number');
        expect(typeof s.hits).toBe('number');
        expect(typeof s.misses).toBe('number');
        expect(typeof s.hit_rate).toBe('number');
        expect(typeof s.miss_rate).toBe('number');
        expect(typeof s.evictions).toBe('number');
    });

    it('POST /api/cache/resize changes capacity and evicts LRU when shrinking', async () => {
        await api(app).post('/api/cache/clear').send({});
        await api(app).put('/api/cache/r1').send({ value: '1' });
        await api(app).put('/api/cache/r2').send({ value: '2' });
        await api(app).put('/api/cache/r3').send({ value: '3' });

        const res = await api(app).post('/api/cache/resize').send({ capacity: 1 });
        expect(res.status).toBe(200);
        expect(res.body.data.capacity).toBe(1);

        const stats = await api(app).get('/api/stats');
        expect(stats.body.data.capacity).toBe(1);
        expect(stats.body.data.size).toBeLessThanOrEqual(1);

        const bad = await api(app).post('/api/cache/resize').send({ capacity: 0 });
        expect(bad.status).toBe(400);
    });

    it('POST /api/cache/clear removes all entries', async () => {
        await api(app).put('/api/cache/c1').send({ value: '1' });
        await api(app).put('/api/cache/c2').send({ value: '2' });

        const clear = await api(app).post('/api/cache/clear').send({});
        expect(clear.status).toBe(200);

        const stats = await api(app).get('/api/stats');
        expect(stats.body.data.size).toBe(0);

        const get = await api(app).get('/api/cache/c1');
        expect(get.body.data.hit).toBe(false);
    });

    it('POST /api/stats/reset clears counters but keeps entries', async () => {
        await api(app).post('/api/cache/clear').send({});
        await api(app).put('/api/cache/s1').send({ value: '1' });
        await api(app).get('/api/cache/s1');

        const reset = await api(app).post('/api/stats/reset').send({});
        expect(reset.status).toBe(200);

        const stats = await api(app).get('/api/stats');
        expect(stats.body.data.hits).toBe(0);
        expect(stats.body.data.size).toBe(1);
    });

    it('DELETE removes an existing key and 404s for a missing key', async () => {
        await api(app).put('/api/cache/d1').send({ value: '1' });
        const del = await api(app).delete('/api/cache/d1');
        expect(del.status).toBe(200);

        const gone = await api(app).get('/api/cache/d1');
        expect(gone.body.data.hit).toBe(false);

        const delMissing = await api(app).delete('/api/cache/d1');
        expect(delMissing.status).toBe(404);
    });

    it('returns 502 when the C++ cache server is unavailable (never fakes success)', async () => {
        // Mock CacheService that throws connection errors on every call,
        // simulating the C++ server being down. The gateway must report 502.
        const unavailable: any = {
            health: async () => ({ ok: false }),
            getEntry: async () => { throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }); },
            putEntry: async () => { throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }); },
            deleteEntry: async () => { throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }); },
            listEntries: async () => { throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }); },
            getStats: async () => { throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }); },
            clear: async () => { throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }); },
            resize: async (_cap: number) => { throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }); },
            resetStats: async () => { throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }); },
            getBaseURL: () => '',
        };

        const deadApp = createApp(unavailable);
        const res = await api(deadApp).get('/api/cache/anything');
        expect(res.status).toBe(502);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('unavailable');
    });
});

