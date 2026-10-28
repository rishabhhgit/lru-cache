import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createCacheRoutes } from './routes/cache';
import { CacheService } from './services/cacheService';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

/**
 * Build the Express application.
 *
 * The gateway owns routing, validation, CORS, body limits and error
 * handling. Cache state lives exclusively in the C++ server; this app only
 * forwards requests.
 */
export function createApp(cacheService?: CacheService): Application {
    const app: Application = express();

    // Trust proxy (useful behind a reverse proxy / load balancer).
    app.set('trust proxy', true);

    // Security headers.
    app.use(helmet());

    // CORS for the frontend dashboard. Origin is configurable via env.
    const corsOrigin = process.env.CORS_ORIGIN || '*';
    app.use(cors({ origin: corsOrigin, methods: ['GET', 'PUT', 'DELETE', 'POST', 'OPTIONS'] }));

    // Request logging and body parsing with size limit.
    app.use(requestLogger);
    app.use(express.json({ limit: '1mb' }));

    // Health at root for load balancers.
    app.get('/health', (_req, res) => {
        res.json({ success: true, service: 'cachelab-gateway' });
    });

    // API routes.
    const svc = cacheService ?? new CacheService(
        process.env.CACHE_SERVER_URL || 'http://localhost:8080',
        parseInt(process.env.CACHE_SERVER_TIMEOUT_MS || '5000', 10),
    );
    app.use('/api', createCacheRoutes(svc));

    // 404 for unknown routes.
    app.use((_req, res) => {
        res.status(404).json({ success: false, error: 'Not found' });
    });

    // Centralized error handling (must be last).
    app.use(errorHandler);

    return app;
}
