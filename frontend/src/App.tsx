/**
 * CacheLab Dashboard — React frontend for the LRU cache.
 *
 * Talks to the Express gateway via the cacheApi client. The gateway forwards
 * every operation to the C++ cache server and returns honest responses
 * (including 502 when the C++ server is down).
 */

import { useState, useEffect, useCallback } from 'react';
import { cacheApi } from '@/api/cache';
import type { CacheEntry, CacheStats, GetEntryResponse } from '@/types/cache';

type ApiError = { message?: string; status?: number };

function App() {
    const [entries, setEntries] = useState<CacheEntry[]>([]);
    const [stats, setStats] = useState<CacheStats | null>(null);
    const [status, setStatus] = useState<{ ok: boolean; message?: string }>({ ok: false });
    const [entryResult, setEntryResult] = useState<GetEntryResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [putKey, setPutKey] = useState('');
    const [putValue, setPutValue] = useState('');
    const [getKey, setGetKey] = useState('');
    const [delKey, setDelKey] = useState('');
    const [resizeCap, setResizeCap] = useState('');

    // Fetch entries + stats on load and on refresh.
    const refresh = useCallback(async () => {
        try {
            const [listRes, statsRes, healthRes] = await Promise.all([
                cacheApi.listEntries(),
                cacheApi.getStats(),
                cacheApi.health(),
            ]);
            setEntries(listRes.entries);
            setStats(statsRes);
            setStatus({ ok: healthRes.ok, message: healthRes.ok ? undefined : 'C++ server unreachable' });
            setError(null);
        } catch (err: unknown) {
            const e = err as ApiError;
            setError(e.message || 'Failed to load cache data');
            setStatus({ ok: false, message: e.message });
        }
    }, []);

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, 3000);
        return () => clearInterval(id);
    }, [refresh]);

    const handlePut = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!putKey || !putValue) return;
        try {
            setError(null);
            await cacheApi.putEntry(putKey, putValue);
            setPutValue('');
            await refresh();
        } catch (err: unknown) {
            setError((err as ApiError).message || 'PUT failed');
        }
    };

    const handleGet = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!getKey) return;
        try {
            setError(null);
            const res = await cacheApi.getEntry(getKey);
            setEntryResult(res);
        } catch (err: unknown) {
            setEntryResult({ key: getKey, value: null, hit: false });
            setError((err as ApiError).message || 'GET failed');
        }
    };

    const handleDelete = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!delKey) return;
        try {
            setError(null);
            await cacheApi.deleteEntry(delKey);
            setDelKey('');
            await refresh();
        } catch (err: unknown) {
            setError((err as ApiError).message || 'DELETE failed');
        }
    };

    const handleClear = async () => {
        try {
            setError(null);
            await cacheApi.clear();
            await refresh();
        } catch (err: unknown) {
            setError((err as ApiError).message || 'CLEAR failed');
        }
    };

    const handleResize = async (e: React.FormEvent) => {
        e.preventDefault();
        const cap = Number(resizeCap);
        if (!cap || cap <= 0) return;
        try {
            setError(null);
            await cacheApi.resize(cap);
            setResizeCap('');
            await refresh();
        } catch (err: unknown) {
            setError((err as ApiError).message || 'RESIZE failed');
        }
    };

    const handleResetStats = async () => {
        try {
            setError(null);
            await cacheApi.resetStats();
            await refresh();
        } catch (err: unknown) {
            setError((err as ApiError).message || 'RESET STATS failed');
        }
    };

    return (
        <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 900, margin: '0 auto', padding: 24 }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>CL</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 20 }}>CacheLab</h1>
                    <p style={{ margin: 0, fontSize: 13, color: '#666' }}>LRU Cache Dashboard &bull; C++ engine + Express gateway</p>
                </div>
                <div style={{ marginLeft: 'auto', padding: 8, borderRadius: 6, background: status.ok ? '#dcfce7' : '#fee2e2', color: status.ok ? '#166534' : '#991b1b', fontSize: 12, fontWeight: 600 }}>
                    {status.ok ? 'Server OK' : 'Server Down'}
                </div>
            </header>

            {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>{error}</div>
            )}

            {/* Stats cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                {[['Capacity', stats?.capacity ?? '-'], ['Size', stats?.size ?? '-'], ['Hits', stats?.hits ?? '-'], ['Misses', stats?.misses ?? '-'], ['Evictions', stats?.evictions ?? '-'], ['Hit Rate', stats ? `${stats.hit_rate.toFixed(1)}%` : '-']].map(([label, value]) => (
                    <div key={label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{value}</div>
                    </div>
                ))}
            </div>

            <section style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 16, marginBottom: 12, color: '#0f172a' }}>Cache Entries (MRU &rarr; LRU)</h2>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                                <th style={{ padding: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>Key</th>
                                <th style={{ padding: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>Value</th>
                                <th style={{ padding: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: 11, width: 70 }}>Hit</th>
                                <th style={{ padding: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: 11, width: 90 }}>Delete</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.length === 0 ? (
                                <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No entries in cache.</td></tr>
                            ) : (
                                entries.map((entry) => (
                                    <tr key={entry.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: 12, fontWeight: 500, color: '#334155', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{entry.key}</td>
                                        <td style={{ padding: 12, color: '#475569', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{entry.value}</td>
                                        <td style={{ padding: 12 }}>
                                            <span style={{ padding: '2px 8px', borderRadius: 4, background: entry.hit ? '#dcfce7' : '#f1f5f9', color: entry.hit ? '#166534' : '#64748b', fontSize: 11, fontWeight: 600 }}>{entry.hit ? 'HIT' : 'MISS'}</span>
                                        </td>
                                        <td style={{ padding: 12 }}>
                                            <button
                                                onClick={() => { setDelKey(entry.key); handleDelete(new Event('submit') as unknown as React.FormEvent); }}
                                                style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '6px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <section style={{ marginBottom: 24, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20 }}>
                <h2 style={{ fontSize: 16, marginBottom: 16, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>&#128204;</span> Operations
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {/* PUT */}
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16 }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Put / Update key</div>
                        <form onSubmit={handlePut} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <input
                                placeholder="key"
                                value={putKey}
                                onChange={(e) => setPutKey(e.target.value)}
                                style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13, fontFamily: 'ui-monospace, monospace' }}
                            />
                            <input
                                placeholder="value"
                                value={putValue}
                                onChange={(e) => setPutValue(e.target.value)}
                                style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13, fontFamily: 'ui-monospace, monospace' }}
                            />
                            <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Put</button>
                        </form>
                    </div>

                    {/* GET */}
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16 }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Get key</div>
                        <form onSubmit={handleGet} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <input
                                placeholder="key"
                                value={getKey}
                                onChange={(e) => setGetKey(e.target.value)}
                                style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13, fontFamily: 'ui-monospace, monospace' }}
                            />
                            <button type="submit" style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Get</button>
                        </form>
                        {entryResult && (
                            <div style={{ marginTop: 10, padding: 8, background: entryResult.hit ? '#dcfce7' : '#fef2f2', borderRadius: 4, fontSize: 12, color: entryResult.hit ? '#166534' : '#991b1b' }}>
                                {entryResult.hit ? `HIT: ${entryResult.value}` : 'MISS: key not found'}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                    <button onClick={handleRefresh} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, padding: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Refresh</button>
                    <button onClick={handleClear} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, padding: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Clear All</button>
                    <button onClick={handleResetStats} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, padding: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Reset Stats</button>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input placeholder="new capacity" value={resizeCap} onChange={(e) => setResizeCap(e.target.value)} style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13, fontFamily: 'ui-monospace, monospace' }} />
                        <button onClick={handleResize} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, padding: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Resize</button>
                    </div>
                </div>
            </section>

            <footer style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#94a3b8' }}>
                CacheLab &bull; C++20 LRU engine &rarr; Express gateway &rarr; React dashboard
            </footer>
        </div>
    );

    function handleRefresh() {
        refresh();
    }
}

export default App;