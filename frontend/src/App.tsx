import { useCallback, useEffect, useRef, useState } from 'react';
import { cacheApi, type CacheStats, type GetEntryResponse } from '@/api/cache';
import { CacheList } from '@/components/CacheList';
import { EntryForm } from '@/components/EntryForm';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Stats } from '@/components/Stats';
import './index.css';

export default function App() {
    const [stats, setStats] = useState<CacheStats | null>(null);
    const [entries, setEntries] = useState<{ key: string; value: string; hit: boolean }[]>([]);
    const [entry, setEntry] = useState<GetEntryResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const statsRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const clearError = useCallback(() => setError(null), []);

    const fetchStats = useCallback(async () => {
        try {
            setStats(await cacheApi.getStats());
        } catch (err) {
            setError((err as Error)?.message ?? 'Failed to load stats');
        }
    }, []);

    const fetchEntries = useCallback(async () => {
        try {
            const list = await cacheApi.listEntries();
            setEntries(list.entries);
        } catch (err) {
            setError((err as Error)?.message ?? 'Failed to load entries');
        }
    }, []);

    const fetchHealth = useCallback(async () => {
        try {
            const health = await cacheApi.health();
            if (!health.ok) {
                setError('Cache server is unreachable');
            }
        } catch {
            setError('Cache server is unreachable');
        }
    }, []);

    useEffect(() => {
        fetchHealth();
        fetchStats();
        fetchEntries();
        statsRef.current = setInterval(() => {
            fetchStats();
            fetchEntries();
        }, 2000);
        return () => {
            if (statsRef.current) clearInterval(statsRef.current);
        };
    }, [fetchHealth, fetchStats, fetchEntries]);

    const handlePut = async (key: string, value: unknown) => {
        setLoading(true);
        setError(null);
        try {
            await cacheApi.putEntry(key, value);
            setEntry(null);
            await fetchEntries();
            await fetchStats();
        } catch (err) {
            setError((err as Error)?.message ?? 'Failed to save entry');
        } finally {
            setLoading(false);
        }
    };

    const handleGet = async (key: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await cacheApi.getEntry(key);
            setEntry(result);
            if (!result.hit) {
                setError(`Key "${key}" not found in cache`);
            }
        } catch (err) {
            setError((err as Error)?.message ?? 'Failed to get entry');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (key: string) => {
        setLoading(true);
        setError(null);
        try {
            await cacheApi.deleteEntry(key);
            setEntry(null);
            await fetchEntries();
            await fetchStats();
        } catch (err) {
            setError((err as Error)?.message ?? 'Failed to delete entry');
        } finally {
            setLoading(false);
        }
    };

    const handleClear = async () => {
        setLoading(true);
        setError(null);
        try {
            await cacheApi.clear();
            setEntry(null);
            await fetchEntries();
            await fetchStats();
        } catch (err) {
            setError((err as Error)?.message ?? 'Failed to clear cache');
        } finally {
            setLoading(false);
        }
    };

    const handleResize = async (capacity: number) => {
        setLoading(true);
        setError(null);
        try {
            await cacheApi.resize(capacity);
            await fetchStats();
            await fetchEntries();
        } catch (err) {
            setError((err as Error)?.message ?? 'Failed to resize cache');
        } finally {
            setLoading(false);
        }
    };

    const handleResetStats = async () => {
        setLoading(true);
        setError(null);
        try {
            await cacheApi.resetStats();
            await fetchStats();
        } catch (err) {
            setError((err as Error)?.message ?? 'Failed to reset stats');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app">
            <header>
                <h1>CacheLab</h1>
                <span className="badge ok">LRU Cache</span>
            </header>

            <main className="app">
                <ErrorBanner error={error} onDismiss={clearError} />

                <div className="toolbar">
                    <button className="primary" onClick={fetchStats} disabled={loading}>
                        Refresh
                    </button>
                    <button className="secondary" onClick={handleClear} disabled={loading}>
                        Clear Cache
                    </button>
                    <button className="secondary" onClick={handleResetStats} disabled={loading}>
                        Reset Stats
                    </button>
                </div>

                <Stats stats={stats} loading={loading && entries.length === 0 && !stats} error={error} />

                <div className="grid" style={{ gridTemplateColumns: '1fr 320px', gap: '1rem' }}>
                    <div style={{ minWidth: 0 }}>
                        <CacheList
                            entries={entries}
                            loading={loading}
                            error={error}
                            onGet={handleGet}
                            onDelete={handleDelete}
                        />
                    </div>
                    <div>
                        <EntryForm
                            onPut={handlePut}
                            loading={loading}
                            error={error}
                            setError={setError}
                        />
                        {entry && (
                            <div className="card" style={{ marginTop: '1rem' }}>
                                <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: '#94a3b8' }}>
                                    Last Lookup
                                </h2>
                                <div className="row">
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{entry.key}</span>
                                    <span
                                        className={`badge ${entry.hit ? 'ok' : 'bad'}`}
                                        style={{ marginLeft: 'auto' }}
                                    >
                                        {entry.hit ? 'HIT' : 'MISS'}
                                    </span>
                                </div>
                                <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', wordBreak: 'break-all', marginTop: '0.5rem' }}>
                                    {entry.value ?? '<null>'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

