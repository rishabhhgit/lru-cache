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
    const [showHelp, setShowHelp] = useState(false);
    const [reaction, setReaction] = useState<'idle' | 'put' | 'get' | 'delete' | 'clear' | 'resize' | 'miss'>( 'idle');
    const [reactionTime, setReactionTime] = useState(0);

    const statsRef = useRef<ReturnType<typeof setInterval>>(null);
    const reactionTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

    const clearError = useCallback(() => setError(null), []);

    const triggerReaction = useCallback((type: 'put' | 'get' | 'delete' | 'clear' | 'resize' | 'miss') => {
        setReaction(type);
        setReactionTime(Date.now());
        if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
        reactionTimerRef.current = setTimeout(() => setReaction('idle'), 1500);
    }, []);

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
            triggerReaction('put');
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
            triggerReaction(result.hit ? 'get' : 'miss');
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
            triggerReaction('delete');
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
            triggerReaction('clear');
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
            triggerReaction('resize');
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

    const reactionAge = Date.now() - reactionTime;
    const isReacting = reaction !== 'idle' && reactionAge < 1500;

    return (
        <div className="app">
            {/* Reactive golden/silver background */}
            <div className="bg-layer" style={{
                background: isReacting
                    ? reactionGradient(reaction)
                    : 'linear-gradient(135deg, #f5f3e4 0%, #e8e2c8 50%, #d4c9a6 100%)',
                transition: 'background 0.8s ease',
            }}>
                <div className="bg-shine" style={{
                    opacity: isReacting ? 0.6 : 0.3,
                    transition: 'opacity 0.8s ease',
                }} />
                <div className="bg-particles" />
            </div>

            <div className="container">
                <header className="app-header">
                    <div className="brand">
                        <div className="logo">CL</div>
                        <div>
                            <h1>CacheLab</h1>
                            <p>LRU Cache Dashboard</p>
                        </div>
                    </div>
                    <div className="header-actions">
                        <button
                            className="btn ghost"
                            onClick={() => setShowHelp(!showHelp)}
                            title="How it works"
                        >
                            ? How it works
                        </button>
                        <span className={`status-badge ${stats ? 'ok' : 'down'}`}>
                            {stats ? 'Server OK' : 'Connecting…'}
                        </span>
                    </div>
                </header>

                {showHelp && (
                    <div className="help-modal">
                        <div className="help-card">
                            <h2>How CacheLab Works</h2>
                            <p>
                                CacheLab is an <strong>LRU (Least Recently Used)</strong> cache. When the cache
                                reaches its capacity, the <em>least recently used</em> entry is automatically
                                evicted to make room for new data.
                            </p>
                            <div className="help-steps">
                                <div className="step">
                                    <span className="step-num">1</span>
                                    <div>
                                        <strong>Put</strong> — Store a key-value pair. If the key exists, it's updated and marked most-recently-used.
                                    </div>
                                </div>
                                <div className="step">
                                    <span className="step-num">2</span>
                                    <div>
                                        <strong>Get</strong> — Retrieve a value. A hit promotes the key to MRU; a miss does nothing.
                                    </div>
                                </div>
                                <div className="step">
                                    <span className="step-num">3</span>
                                    <div>
                                        <strong>Eviction</strong> — When full, the oldest (LRU) entry is removed before inserting a new one.
                                    </div>
                                </div>
                                <div className="step">
                                    <span className="step-num">4</span>
                                    <div>
                                        <strong>Delete / Clear / Resize</strong> — Manage entries and capacity at runtime.
                                    </div>
                                </div>
                            </div>
                            <div className="help-tech">
                                <p><strong>Architecture:</strong> C++20 engine (std::list + std::unordered_map, O(1)) → cpp-httplib HTTP server → Express gateway → React dashboard.</p>
                                <p><strong>Thread safety:</strong> std::shared_mutex allows concurrent reads with exclusive writes.</p>
                            </div>
                            <button className="btn primary" onClick={() => setShowHelp(false)}>
                                Got it
                            </button>
                        </div>
                        <div className="help-backdrop" onClick={() => setShowHelp(false)} />
                    </div>
                )}

                {error && (
                    <div className="error-banner">
                        {error}
                        <button className="dismiss" onClick={clearError}>Dismiss</button>
                    </div>
                )}

                <div className="stats-row">
                    <StatCard label="Capacity" value={stats?.capacity ?? '-'} />
                    <StatCard label="Size" value={stats?.size ?? '-'} />
                    <StatCard label="Hits" value={stats?.hits ?? '-'} />
                    <StatCard label="Misses" value={stats?.misses ?? '-'} />
                    <StatCard label="Hit Rate" value={stats ? `${stats.hit_rate.toFixed(1)}%` : '-'} />
                    <StatCard label="Evictions" value={stats?.evictions ?? '-'} />
                </div>

                <div className="main-grid">
                    <div className="card entries-card">
                        <div className="card-header">
                            <h2>Entries (MRU → LRU)</h2>
                            <span className="count">{entries.length}</span>
                        </div>
                        <CacheList
                            entries={entries}
                            loading={loading}
                            error={error}
                            onGet={handleGet}
                            onDelete={handleDelete}
                        />
                    </div>

                    <div className="card controls-card">
                        <EntryForm
                            onPut={handlePut}
                            loading={loading}
                            error={error}
                            setError={setError}
                        />
                        {entry && (
                            <div className="lookup-result">
                                <h3>Last Lookup</h3>
                                <div className="lookup-key">{entry.key}</div>
                                <span className={`lookup-badge ${entry.hit ? 'hit' : 'miss'}`}>
                                    {entry.hit ? 'HIT' : 'MISS'}
                                </span>
                                <div className="lookup-value">{entry.value ?? '<null>'}</div>
                            </div>
                        )}
                        <div className="toolbar">
                            <button className="btn primary" onClick={() => { fetchStats(); fetchEntries(); }}>
                                Refresh
                            </button>
                            <button className="btn secondary" onClick={handleClear}>
                                Clear Cache
                            </button>
                            <button className="btn secondary" onClick={handleResetStats}>
                                Reset Stats
                            </button>
                        </div>
                        <div className="resize-card">
                            <h3>Resize</h3>
                            <div className="resize-input">
                                <input
                                    type="number"
                                    placeholder="new capacity"
                                    className="resize-input-field"
                                />
                                <button className="btn primary" onClick={() => {}}>Set</button>
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="app-footer">
                    CacheLab • C++20 LRU engine → Express gateway → React dashboard
                </footer>
            </div>
        </div>
    );
}

function reactionGradient(type: string) {
    switch (type) {
        case 'put': return 'linear-gradient(135deg, #fff8e1 0%, #ffe082 40%, #ffd54f 70%, #ffca28 100%)';
        case 'get': return 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 40%, #90caf9 70%, #64b5f6 100%)';
        case 'delete': return 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 40%, #ef9a9a 70%, #e57373 100%)';
        case 'clear': return 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 40%, #ce93d8 70%, #ba68c8 100%)';
        case 'resize': return 'linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 40%, #80cbc4 70%, #4db6ac 100%)';
        case 'miss': return 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 40%, #ffcc80 70%, #ffb74d 100%)';
        default: return 'linear-gradient(135deg, #f5f3e4 0%, #e8e2c8 50%, #d4c9a6 100%)';
    }
}

function StatCard({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
        </div>
    );
}