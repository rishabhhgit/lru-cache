import { Request, Response, NextFunction } from 'express';

/**
 * Simple structured request logger. Logs method, path, status and duration
 * for every request hitting the gateway.
 */
export function requestLogger(_req: Request, _res: Response, _next: NextFunction): void {
    // eslint-disable-next-line no-console
    console.log(`${new Date().toISOString()} ${_req.method} ${_req.originalUrl}`);
    _next();
}
