import { useState, useEffect, useCallback, useRef } from 'react';
import {
    cacheApi,
    type CacheEntry,
    type CacheStats,
    type GetEntryResponse,
    type PutEntryResponse,
} from '@/api/cache';
import type { OperationLog } from '@/types/cache';
import { Header } from '@/components/Header';
import { StatsCards } from '@/components/StatsCards';
import { CacheVisualizer } from '@/components/CacheVisualizer';
import { Playground } from '@/components/Playground';
import { EntriesTable } from '@/components/EntriesTable';
import { OperationHistory } from '@/components/OperationHistory';
import { AnalyticsPanel } from '@/components/AnalyticsPanel';
import { LearnMode } from '@/components/LearnMode';
import { CppCodeViewer } from '@/components/CppCodeViewer';
import './index.css';

export default function App() {
    // Navigation state
    const [activeTab, setActiveTab] = useState<'dashboard' | 'learn' | 'code'>('dashboard');

    // Cache state
    const [stats, setStats] = useState<CacheStats | null>(null);
    const [mruEntries, setMruEntries] = useState<CacheEntry[]>([]);
    const [lruEntries, setLruEntries] = useState<CacheEntry[]>([]);
    const [isEngineOnline, setIsEngineOnline] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Active visual highlight state
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const [actionType, setActionType] = useState<
        'hit' | 'miss' | 'inserted' | 'updated' | 'evicted' | 'deleted' | null
    >(null);
    const [lastEvicted, setLastEvicted] = useState<{ key: string; value: string } | null>(null);

    // Operation history audit trail
    const [logs, setLogs] = useState<OperationLog[]>([]);
    const [avgLatencyMs, setAvgLatencyMs] = useState<number>(0);

    const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const triggerHighlight = useCallback(
        (
            key: string,
            type: 'hit' | 'miss' | 'inserted' | 'updated' | 'evicted' | 'deleted',
            evicted: { key: string; value: string } | null = null,
        ) => {
            setActiveKey(key);
            setActionType(type);
            setLastEvicted(evicted);

            if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
            highlightTimerRef.current = setTimeout(() => {
                setActiveKey(null);
                setActionType(null);
            }, 2500);
        },
        [],
    );

    const addLog = useCallback(
        (logData: Omit<OperationLog, 'id' | 'timestamp'>) => {
            const newLog: OperationLog = {
                ...logData,
                id: Math.random().toString(36).substring(2, 9),
                timestamp: new Date().toLocaleTimeString(),
            };
            setLogs((prev) => [newLog, ...prev.slice(0, 99)]);

            // Update average latency
            setAvgLatencyMs((prevAvg) => {
                if (prevAvg === 0) return logData.latencyMs;
                return prevAvg * 0.8 + logData.latencyMs * 0.2;
            });
        },
        [],
    );

    // Data fetching
    const fetchStats = useCallback(async () => {
        try {
            const s = await cacheApi.getStats();
            setStats(s);
        } catch {
            // Error handled by health check
        }
    }, []);

    const fetchEntries = useCallback(async () => {
        try {
            const list = await cacheApi.listEntries();
            const mru = list.entries || [];
            const lru = list.lru_to_mru || [...mru].reverse();
            setMruEntries(mru);
            setLruEntries(lru);
        } catch {
            // Error handled by health check
        }
    }, []);

    const checkHealth = useCallback(async () => {
        try {
            const h = await cacheApi.health();
            setIsEngineOnline(h.ok);
            if (!h.ok) {
                setError('Unable to reach the cache backend. Please try again shortly.');
            } else {
                setError(null);
            }
        } catch {
            setIsEngineOnline(false);
            setError('Backend gateway or C++ engine is offline.');
        }
    }, []);

    const refreshAll = useCallback(async () => {
        await checkHealth();
        await fetchStats();
        await fetchEntries();
    }, [checkHealth, fetchStats, fetchEntries]);

    // Initial load and periodic polling
    useEffect(() => {
        refreshAll();
        const interval = setInterval(() => {
            refreshAll();
        }, 3000);
        return () => clearInterval(interval);
    }, [refreshAll]);

    // User Operations
    const handleGet = async (key: string): Promise<GetEntryResponse> => {
        const start = performance.now();
        setLoading(true);
        try {
            const result = await cacheApi.getEntry(key);
            const latency = Math.round(performance.now() - start);

            triggerHighlight(key, result.hit ? 'hit' : 'miss');
            addLog({
                type: 'GET',
                key,
                value: result.value ?? undefined,
                hit: result.hit,
                status: 'success',
                message: result.hit ? `Cache HIT: key "${key}" found and promoted to MRU position` : `Cache MISS: key "${key}" not found`,
                latencyMs: latency,
                sizeAfter: stats?.size,
            });

            await fetchStats();
            await fetchEntries();
            return result;
        } catch (err) {
            const latency = Math.round(performance.now() - start);
            addLog({
                type: 'GET',
                key,
                status: 'error',
                message: (err as Error).message,
                latencyMs: latency,
            });
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const handlePut = async (key: string, value: string): Promise<PutEntryResponse> => {
        const start = performance.now();
        setLoading(true);
        try {
            const result = await cacheApi.putEntry(key, value);
            const latency = Math.round(performance.now() - start);

            const evictedEntry = result.evicted && result.evicted_entry ? result.evicted_entry : null;
            triggerHighlight(
                key,
                result.evicted ? 'evicted' : result.updated ? 'updated' : 'inserted',
                evictedEntry,
            );

            let msg = '';
            if (result.inserted) {
                msg = result.evicted
                    ? `Inserted new key "${key}". Cache was full; evicted oldest LRU key "${evictedEntry?.key}".`
                    : `Inserted new key "${key}" at MRU position.`;
            } else {
                msg = `Updated existing key "${key}" and moved to MRU position.`;
            }

            addLog({
                type: 'PUT',
                key,
                value,
                evictedKey: evictedEntry?.key,
                status: 'success',
                message: msg,
                latencyMs: latency,
                sizeAfter: stats?.size,
            });

            await fetchStats();
            await fetchEntries();
            return result;
        } catch (err) {
            const latency = Math.round(performance.now() - start);
            addLog({
                type: 'PUT',
                key,
                value,
                status: 'error',
                message: (err as Error).message,
                latencyMs: latency,
            });
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (key: string): Promise<void> => {
        const start = performance.now();
        setLoading(true);
        try {
            await cacheApi.deleteEntry(key);
            const latency = Math.round(performance.now() - start);

            triggerHighlight(key, 'deleted');
            addLog({
                type: 'DELETE',
                key,
                status: 'success',
                message: `Successfully deleted key "${key}" from cache`,
                latencyMs: latency,
                sizeAfter: Math.max(0, (stats?.size ?? 1) - 1),
            });

            await fetchStats();
            await fetchEntries();
        } catch (err) {
            const latency = Math.round(performance.now() - start);
            addLog({
                type: 'DELETE',
                key,
                status: 'error',
                message: (err as Error).message,
                latencyMs: latency,
            });
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const handleClear = async () => {
        const start = performance.now();
        setLoading(true);
        try {
            await cacheApi.clear();
            const latency = Math.round(performance.now() - start);

            addLog({
                type: 'CLEAR',
                status: 'success',
                message: 'Cleared all entries from the cache',
                latencyMs: latency,
                sizeAfter: 0,
            });

            await fetchStats();
            await fetchEntries();
        } catch (err) {
            const latency = Math.round(performance.now() - start);
            addLog({
                type: 'CLEAR',
                status: 'error',
                message: (err as Error).message,
                latencyMs: latency,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleResize = async (capacity: number) => {
        const start = performance.now();
        setLoading(true);
        try {
            await cacheApi.resize(capacity);
            const latency = Math.round(performance.now() - start);

            addLog({
                type: 'RESIZE',
                status: 'success',
                message: `Changed capacity to ${capacity}. Any excess LRU entries were evicted.`,
                latencyMs: latency,
            });

            await fetchStats();
            await fetchEntries();
        } catch (err) {
            const latency = Math.round(performance.now() - start);
            addLog({
                type: 'RESIZE',
                status: 'error',
                message: (err as Error).message,
                latencyMs: latency,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleResetStats = async () => {
        const start = performance.now();
        setLoading(true);
        try {
            await cacheApi.resetStats();
            const latency = Math.round(performance.now() - start);

            addLog({
                type: 'RESET_STATS',
                status: 'success',
                message: 'Reset hit, miss, and eviction counters to zero (entries retained).',
                latencyMs: latency,
            });

            await fetchStats();
        } catch (err) {
            const latency = Math.round(performance.now() - start);
            addLog({
                type: 'RESET_STATS',
                status: 'error',
                message: (err as Error).message,
                latencyMs: latency,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleLoadSampleData = async () => {
        setLoading(true);
        try {
            await cacheApi.putEntry('user:101', 'Ada Lovelace');
            await cacheApi.putEntry('user:102', 'Alan Turing');
            await cacheApi.putEntry('user:103', 'Grace Hopper');
            await refreshAll();
            addLog({
                type: 'PUT',
                status: 'success',
                message: 'Loaded sample entries: user:101, user:102, user:103',
                latencyMs: 12,
            });
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="cl-app">
            <div className="cl-shell">
                <Header
                    stats={stats}
                    isEngineOnline={isEngineOnline}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    onResize={handleResize}
                    onClear={handleClear}
                    onResetStats={handleResetStats}
                    loading={loading}
                />

                {error && (
                    <div className="cl-global-alert">
                        <span className="cl-alert-icon">⚠️</span>
                        <span className="cl-alert-msg">{error}</span>
                        <button className="cl-btn-ghost-sm" onClick={refreshAll}>
                            Retry Connection
                        </button>
                    </div>
                )}

                <main className="cl-main-content">
                    {/* TAB 1: DASHBOARD & VISUALIZER */}
                    {activeTab === 'dashboard' && (
                        <>
                            <StatsCards stats={stats} loading={loading} />

                            <CacheVisualizer
                                entries={lruEntries}
                                stats={stats}
                                activeKey={activeKey}
                                actionType={actionType}
                                lastEvicted={lastEvicted}
                                onQuickGet={handleGet}
                                onQuickDelete={handleDelete}
                                onLoadSampleData={handleLoadSampleData}
                            />

                            <div className="cl-dashboard-grid">
                                <div className="cl-col-main">
                                    <Playground
                                        onGet={handleGet}
                                        onPut={handlePut}
                                        onDelete={handleDelete}
                                        loading={loading}
                                    />
                                    <EntriesTable
                                        entries={mruEntries}
                                        onGet={handleGet}
                                        onDelete={handleDelete}
                                        loading={loading}
                                    />
                                </div>

                                <div className="cl-col-side">
                                    <OperationHistory
                                        logs={logs}
                                        onClearLogs={() => setLogs([])}
                                    />
                                </div>
                            </div>

                            <AnalyticsPanel stats={stats} avgLatencyMs={avgLatencyMs} />
                        </>
                    )}

                    {/* TAB 2: LEARN LRU INTERACTIVE MODE */}
                    {activeTab === 'learn' && <LearnMode />}

                    {/* TAB 3: C++ CORE ENGINE CODE INSPECTOR */}
                    {activeTab === 'code' && <CppCodeViewer />}
                </main>

                <footer className="cl-footer">
                    <div className="cl-footer-info">
                        <strong>CacheLab</strong> • C++20 Core LRU Engine ⟵ HTTP REST ⟵ Express API Gateway ⟵ React TypeScript Dashboard
                    </div>
                    <div className="cl-footer-meta">
                        <span>Average Time Complexity: GET <strong>O(1)</strong> | PUT <strong>O(1)</strong> | EVICT <strong>O(1)</strong></span>
                    </div>
                </footer>
            </div>
        </div>
    );
}