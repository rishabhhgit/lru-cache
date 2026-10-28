/**
 * api/index.ts — Vercel serverless entry point.
 *
 * Vercel invokes this as a serverless function for all /api/* and /health
 * requests (see vercel.json rewrites). We export the Express app directly;
 * Vercel's @vercel/node runtime handles the HTTP lifecycle — no listen().
 *
 * The LRU cache runs fully in-process (TypeScript port of the C++ engine),
 * so no external server is needed.
 */
import { createApp } from '../backend/src/app';

export default createApp();

