import { Request, Response, NextFunction } from 'express';
import { AxiosError } from 'axios';

/**
 * Centralized error handler.
 *
 * Translates C++ server failures into honest HTTP responses. When the C++
 * cache server is unreachable we return 502 (Bad Gateway) -- never a
 * fabricated success. Client errors (4xx) from the C++ server are passed
 * through with their status code where possible.
 */
export function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: NextFunction,
): void {
    const axiosErr = err as AxiosError | undefined;

    // Network-level failure: the C++ server is down or unreachable.
    if (axiosErr && (axiosErr.code === 'ECONNREFUSED' || axiosErr.code === 'ETIMEDOUT')) {
        res.status(502).json({
            success: false,
            error: 'C++ cache server is unavailable',
        });
        return;
    }

    // The C++ server responded with an error status: forward it.
    if (axiosErr?.response?.status) {
        const upstreamData = axiosErr.response.data as { error?: string } | undefined;
        res.status(axiosErr.response.status).json({
            success: false,
            error: upstreamData?.error ?? 'Upstream cache server error',
        });
        return;
    }

    // Fallback: unexpected server error.
    res.status(500).json({
        success: false,
        error: 'Internal gateway error',
    });
}
