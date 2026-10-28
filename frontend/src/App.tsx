import { useCallback, useEffect, useRef, useState } from 'react';
import { cacheApi, type CacheStats, type GetEntryResponse } from '@/api/cache';
import './index.css';

export default function App() {
    const [stats, setStats] = useState<CacheStats | null>(null);
    const [entries, setEntries] = useState<{ key: string; value: string; hit: boolean }[]>([]);
    const [entry, setEntry] = useState<GetEntryResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [reaction, setReaction] = useState<'idle' | 'put' | 'get' | 'miss' | 'delete' | 'clear' | 'resize'>('idle');
    const [reactionTime, setReactionTime] = useState(0);

    const statsRef = useRef<ReturnType<typeof setInterval>>(null);
    const reactionTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

    const triggerReaction = useCallback((type: 'put' | 'get' | 'miss' | 'delete' | 'clear' | 'resize') => {
        setReaction(type);
        setReactionTime(Date.now());
        if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
        reactionTimerRef.current = setTimeout(() => setReaction('idle'), 1200);
    }, []);

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
            if (!health.ok) setError('Cache server is unreachable');
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
            if (!result.hit) setError(`Key "${key}" not found`);
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

    const isReacting = reaction !== 'idle' && Date.now() - reactionTime < 1200;

    return (
        <div className="app">
            <div
                className="bg"
                style={{
                    background: isReacting ? reactionGradient(reaction) : 'linear-gradient(135deg, #f7f5ea 0%, #e8dfc4 50%, #d4c185 100%)',
                    transition: 'background 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                <div className="bg-glow" />
                <div className="bg-dots" />
            </div>

            <div className="shell">
                <nav className="navbar">
                    <div className="nav-brand">
                        <div className="nav-logo">CL</div>
                        <div className="nav-text">
                            <div className="nav-title">CacheLab</div>
                            <div className="nav-sub">LRU Cache Dashboard</div>
                        </div>
                    </div>
                    <div className="nav-right">
                        <button className="nav-btn ghost" onClick={() => setShowHelp((p) => !p)} title="How it works">
                            <span>?</span> How it works
                        </button>
                        <div className={`pill ${stats ? 'ok' : 'down'}`}>
                            <span className="pill-dot" />
                            {stats ? 'Server OK' : 'Connecting…'}
                        </div>
                    </div>
                </nav>

                {showHelp && (
                    <div className="modal-overlay" onClick={() => setShowHelp(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>How CacheLab Works</h2>
                                <button className="modal-close" onClick={() => setShowHelp(false)}>✕</button>
                            </div>
                            <p className="modal-lead">
                                CacheLab is an <strong>LRU (Least Recently Used)</strong> cache. When capacity is
                                reached, the <em>least recently used</em> entry is evicted to make room.
                            </p>
                            <div className="steps">
                                <div className="step">
                                    <div className="step-num">1</div>
                                    <div className="step-body">
                                        <div className="step-title">Put</div>
                                        <div className="step-desc">Store a key-value pair. Existing keys are updated and promoted to most-recently-used.</div>
                                    </div>
                                </div>
                                <div className="step">
                                    <div className="step-num">2</div>
                                    <div className="step-body">
                                        <div className="step-title">Get</div>
                                        <div className="step-desc">Retrieve a value. A hit promotes the key to MRU; a miss does not change order.</div>
                                    </div>
                                </div>
                                <div className="step">
                                    <div className="step-num">3</div>
                                    <div className="step-body">
                                        <div className="step-title">Eviction</div>
                                        <div className="step-desc">When full, the LRU entry is automatically removed before inserting new data.</div>
                                    </div>
                                </div>
                                <div className="step">
                                    <div className="step-num">4</div>
                                    <div className="step-body">
                                        <div className="step-title">Manage</div>
                                        <div className="step-desc">Delete, clear, resize capacity, or reset stats at runtime.</div>
                                    </div>
                                </div>
                            </div>
                            <div className="tech">
                                <strong>Stack:</strong> C++20 (std::list + unordered_map, O(1)) → cpp-httplib → Express → React
                            </div>
                            <button className="btn primary" onClick={() => setShowHelp(false)}>Got it</button>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="alert error">
                        <span className="alert-icon">⚠</span>
                        <span>{error}</span>
                        <button className="alert-dismiss" onClick={clearError}>Dismiss</button>
                    </div>
                )}

                <main className="main">
                    <section className="stats">
                        <StatCard label="Capacity" value={stats?.capacity ?? '-'} />
                        <StatCard label="Size" value={stats?.size ?? '-'} />
                        <StatCard label="Hits" value={stats?.hits ?? '-'} />
                        <StatCard label="Misses" value={stats?.misses ?? '-'} />
                        <StatCard label="Hit Rate" value={stats ? `${stats.hit_rate.toFixed(1)}%` : '-'} />
                        <StatCard label="Evictions" value={stats?.evictions ?? '-'} />
                    </section>

                    <div className="grid">
                        <div className="card entries-card">
                            <div className="card-head">
                                <h3>Cache Entries</h3>
                                <span className="badge count">{entries.length}</span>
                                <span className="caption">MRU → LRU</span>
                            </div>
                            <div className="entries-list">
                                {entries.length === 0 ? (
                                    <div className="empty">
                                        <div className="empty-icon">📭</div>
                                        <div className="empty-title">Cache is empty</div>
                                        <div className="empty-desc">Put your first entry to get started.</div>
                                    </div>
                                ) : (
                                    <table className="entries-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Key</th>
                                                <th>Value</th>
                                                <th>Status</th>
                                                <th className="text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {entries.map((e, i) => (
                                                <tr key={e.key}>
                                                    <td className="num">{i + 1}</td>
                                                    <td className="key-cell">{e.key}</td>
                                                    <td className="val-cell">{e.value}</td>
                                                    <td>
                                                        <span className={`badge ${e.hit ? 'hit' : 'miss'}`}>{e.hit ? 'HIT' : 'MISS'}</span>
                                                    </td>
                                                    <td className="text-right">
                                                        <button className="btn-sm ghost" onClick={() => handleGet(e.key)}>Get</button>
                                                        <button className="btn-sm danger" onClick={() => handleDelete(e.key)}>Delete</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        <aside className="card controls-card">
                            <div className="card-head">
                                <h3>Controls</h3>
                            </div>
                            <EntryForm onPut={handlePut} loading={loading} error={error} setError={setError} />
                            {entry && (
                                <div className="lookup">
                                    <div className="lookup-head">Last Lookup</div>
                                    <div className="lookup-key">{entry.key}</div>
                                    <span className={`lookup-badge ${entry.hit ? 'hit' : 'miss'}`}>{entry.hit ? 'HIT' : 'MISS'}</span>
                                    <div className="lookup-val">{entry.value ?? '<null>'}</div>
                                </div>
                            )}
                            <div className="toolbar">
                                <button className="btn primary full" onClick={() => { fetchStats(); fetchEntries(); }}>
                                    Refresh
                                </button>
                                <div className="toolbar-row">
                                    <button className="btn secondary" onClick={handleClear}>Clear Cache</button>
                                    <button className="btn secondary" onClick={handleResetStats}>Reset Stats</button>
                                </div>
                            </div>
                            <div className="resize-card">
                                <div className="resize-head">Resize Capacity</div>
                                <div className="resize-row">
                                    <input type="number" className="resize-input" placeholder="e.g. 5" />
                                    <button className="btn primary sm" onClick={() => {}}>Set</button>
                                </div>
                            </div>
                        </aside>
                    </div>

                    <footer className="footer">
                        CacheLab • C++20 LRU engine → Express gateway → React dashboard
                    </footer>
                </main>
            </div>
        </div>
    );
}

function reactionGradient(type: string) {
    switch (type) {
        case 'put': return 'linear-gradient(135deg, #fff7e6 0%, #ffe082 35%, #ffd54f 70%, #f9a825 100%)';
        case 'get': return 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 35%, #90caf9 70%, #42a5f5 100%)';
        case 'miss': return 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 35%, #ffcc80 70%, #fb8c00 100%)';
        case 'delete': return 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 35%, #ef9a9a 70%, #e57373 100%)';
        case 'clear': return 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 35%, #ce93d8 70%, #ab47bc 100%)';
        case 'resize': return 'linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 35%, #80cbc4 70%, #26a69a 100%)';
        default: return 'linear-gradient(135deg, #f7f5ea 0%, #e8dfc4 50%, #d4c185 100%)';
    }
}

function StatCard({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="stat">
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
        </div>
    );
}

function EntryForm({ onPut, loading, error, setError }: { onPut: (k: string, v: unknown) => void; loading: boolean; error: string | null; setError: (m: string | null) => void }) {
    const [key, setKey] = useState('');
    const [value, setValue] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!key.trim()) {
            setError('Key is required');
            return;
        }
        let parsed: unknown = value;
        if (value.trim()) {
            try { parsed = JSON.parse(value); } catch { parsed = value; }
        }
        onPut(key.trim(), parsed);
        setKey('');
        setValue('');
    };

    return (
        <div className="card put-card">
            <div className="card-head">
                <h3>Put / Update Entry</h3>
            </div>
            <form onSubmit={handleSubmit} className="put-form">
                <div className="input-group">
                    <label className="input-label">Key</label>
                    <input
                        type="text"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="e.g. user:1"
                        disabled={loading}
                        className="input"
                    />
                </div>
                <div className="input-group">
                    <label className="input-label">Value (JSON or text)</label>
                    <textarea
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder='{"name": "Ada"}'
                        rows={2}
                        disabled={loading}
                        className="input input-area"
                    />
                </div>
                <button className="btn primary full" type="submit" disabled={loading}>
                    {loading ? 'Saving…' : 'Save Entry'}
                </button>
                {error && <div className="input-error">{error}</div>}
            </form>
        </div>
    );
}