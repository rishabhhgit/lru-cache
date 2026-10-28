import { Router, Request, Response, NextFunction } from 'express';
import { CacheService } from '../services/cacheService';

/** Standard envelope for all API responses. */
interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    key?: string;
}

const router = Router();

/**
 * Attach cache routes to the router.
 *
 * Operations are handled by the in-process TypeScript LRU cache engine.
 */
export function createCacheRoutes(cacheService: CacheService): Router {
    const router = Router();

    // ---- GET /api/health ---------------------------------------------------
    router.get('/health', (_req: Request, res: Response) => {
        const health = cacheService.health();
        res.json({ success: true, service: 'cachelab-gateway', cppServer: health.ok ? 'ok' : 'down' });
    });

    // ---- GET /api/cache/:key ----------------------------------------------
    router.get('/cache/:key', (req: Request, res: Response, next: NextFunction) => {
        const key = req.params.key;
        if (!key || key === '') {
            res.status(400).json({ success: false, error: 'key is required' });
            return;
        }
        try {
            const entry = cacheService.getEntry(key);
            // A cache miss is not an error: report it with hit: false.
            // Use 404 status to signal absence while keeping the body honest.
            const status = entry.hit ? 200 : 404;
            res.status(status).json({ success: true, data: entry, key });
        } catch (err) {
            next(err);
        }
    });

    // ---- PUT /api/cache/:key ----------------------------------------------
    router.put('/cache/:key', (req: Request, res: Response, next: NextFunction) => {
        const key = req.params.key;
        if (!key || key === '') {
            res.status(400).json({ success: false, error: 'key is required' });
            return;
        }
        if (req.body === undefined || req.body.value === undefined) {
            res.status(400).json({ success: false, error: "missing 'value' field in request body" });
            return;
        }
        try {
            const result = cacheService.putEntry(key, req.body.value);
            res.json({ success: true, data: result, key });
        } catch (err) {
            next(err);
        }
    });

    // ---- POST /api/cache --------------------------------------------------
    router.post('/cache', (req: Request, res: Response, next: NextFunction) => {
        const key = req.body?.key;
        if (!key || typeof key !== 'string' || key.trim() === '') {
            res.status(400).json({ success: false, error: "missing or invalid 'key' in request body" });
            return;
        }
        if (req.body === undefined || req.body.value === undefined) {
            res.status(400).json({ success: false, error: "missing 'value' field in request body" });
            return;
        }
        try {
            const result = cacheService.putEntry(key.trim(), req.body.value);
            res.json({ success: true, data: result, key: key.trim() });
        } catch (err) {
            next(err);
        }
    });

    // ---- DELETE /api/cache (clear entire cache) ---------------------------
    router.delete('/cache', (_req: Request, res: Response, next: NextFunction) => {
        try {
            const result = cacheService.clear();
            res.json({ success: true, data: result });
        } catch (err) {
            next(err);
        }
    });

    // ---- DELETE /api/cache/:key -------------------------------------------
    router.delete('/cache/:key', (req: Request, res: Response, next: NextFunction) => {
        const key = req.params.key;
        if (!key || key === '') {
            res.status(400).json({ success: false, error: 'key is required' });
            return;
        }
        try {
            const result = cacheService.deleteEntry(key);
            res.json({ success: true, data: result, key });
        } catch (err: unknown) {
            const e = err as { statusCode?: number; message?: string };
            if (e.statusCode === 404) {
                res.status(404).json({ success: false, error: 'key not found' });
                return;
            }
            next(err);
        }
    });

    // ---- GET /api/cache ---------------------------------------------------
    router.get('/cache', (_req: Request, res: Response, next: NextFunction) => {
        try {
            const list = cacheService.listEntries();
            res.json({ success: true, data: list });
        } catch (err) {
            next(err);
        }
    });

    // ---- GET /api/stats ---------------------------------------------------
    router.get('/stats', (_req: Request, res: Response, next: NextFunction) => {
        try {
            const stats = cacheService.getStats();
            res.json({ success: true, data: stats });
        } catch (err) {
            next(err);
        }
    });

    // ---- POST /api/cache/clear -------------------------------------------
    router.post('/cache/clear', (_req: Request, res: Response, next: NextFunction) => {
        try {
            const result = cacheService.clear();
            res.json({ success: true, data: result });
        } catch (err) {
            next(err);
        }
    });

    // ---- POST /api/cache/resize -------------------------------------------
    router.post('/cache/resize', (req: Request, res: Response, next: NextFunction) => {
        const capacity = req.body?.capacity;
        if (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity <= 0) {
            res.status(400).json({
                success: false,
                error: "missing or invalid 'capacity' (must be a positive integer)",
            });
            return;
        }
        try {
            const result = cacheService.resize(capacity);
            res.json({ success: true, data: result });
        } catch (err) {
            next(err);
        }
    });

    // ---- POST /api/stats/reset -------------------------------------------
    router.post('/stats/reset', (_req: Request, res: Response, next: NextFunction) => {
        try {
            const result = cacheService.resetStats();
            res.json({ success: true, data: result });
        } catch (err) {
            next(err);
        }
    });

    return router;
}

export default router;
