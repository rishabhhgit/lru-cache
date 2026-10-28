import { createApp } from './app';

const PORT = parseInt(process.env.PORT || '5001', 10);
const HOST = process.env.HOST || '0.0.0.0';

const app = createApp();

const server = app.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(
        `CacheLab gateway listening on ${HOST}:${PORT} -> C++ server at ${process.env.CACHE_SERVER_URL || 'http://localhost:8080'}`,
    );
});

// Graceful shutdown.
process.on('SIGTERM', () => {
    // eslint-disable-next-line no-console
    console.log('SIGTERM received, shutting down gateway...');
    server.close(() => {
        // eslint-disable-next-line no-console
        console.log('Gateway closed.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    // eslint-disable-next-line no-console
    console.log('SIGINT received, shutting down gateway...');
    server.close(() => {
        // eslint-disable-next-line no-console
        console.log('Gateway closed.');
        process.exit(0);
    });
});

export default server;
