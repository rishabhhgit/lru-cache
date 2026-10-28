/**
 * Vercel serverless entry point.
 *
 * Vercel requires exporting the Express app as the default export rather than
 * calling app.listen(). The framework handles the HTTP lifecycle.
 *
 * Environment variables to set in your Vercel project settings:
 *   CACHE_SERVER_URL         – URL of your running C++ cache server
 *                              (e.g. https://your-cpp-server.fly.dev)
 *   CACHE_SERVER_TIMEOUT_MS  – optional, defaults to 5000
 *   CORS_ORIGIN              – optional, restrict to your frontend domain
 */
import { createApp } from '../backend/src/app';

export default createApp();

