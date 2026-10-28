import React from 'react';
import type { CacheStats } from '@/types/cache';

interface AnalyticsPanelProps {
    stats: CacheStats | null;
    avgLatencyMs: number;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ stats, avgLatencyMs }) => {
    const hits = stats?.hits ?? 0;
    const misses = stats?.misses ?? 0;
    const evictions = stats?.evictions ?? 0;
    const totalRequests = hits + misses;

    const hitRate = totalRequests > 0 ? (hits / totalRequests) * 100 : 0;
    const missRate = totalRequests > 0 ? (misses / totalRequests) * 100 : 0;

    return (
        <div className="cl-analytics-wrapper">
            <div className="cl-analytics-grid">
                {/* Hit vs Miss Analytics */}
                <div className="cl-card">
                    <div className="cl-card-header">
                        <div className="cl-card-title-box">
                            <h3 className="cl-card-title">Hit / Miss Ratio</h3>
                            <span className="cl-card-subtitle">Real-time cache hit efficiency from C++ engine</span>
                        </div>
                    </div>

                    <div className="cl-card-body">
                        <div className="cl-ratio-visual">
                            <div className="cl-ratio-bar">
                                <div
                                    className="cl-ratio-hit"
                                    style={{ width: `${hitRate}%` }}
                                    title={`Hits: ${hits} (${hitRate.toFixed(1)}%)`}
                                />
                                <div
                                    className="cl-ratio-miss"
                                    style={{ width: `${missRate}%` }}
                                    title={`Misses: ${misses} (${missRate.toFixed(1)}%)`}
                                />
                            </div>
                            <div className="cl-ratio-labels">
                                <div className="cl-ratio-label-hit">
                                    <span className="cl-dot hit" />
                                    <span>Hits: {hits} ({hitRate.toFixed(1)}%)</span>
                                </div>
                                <div className="cl-ratio-label-miss">
                                    <span className="cl-dot miss" />
                                    <span>Misses: {misses} ({missRate.toFixed(1)}%)</span>
                                </div>
                            </div>
                        </div>

                        <div className="cl-metrics-summary-list">
                            <div className="cl-metric-item">
                                <span className="cl-metric-name">Total Read Requests</span>
                                <span className="cl-metric-val">{totalRequests}</span>
                            </div>
                            <div className="cl-metric-item">
                                <span className="cl-metric-name">Total Evictions</span>
                                <span className="cl-metric-val">{evictions}</span>
                            </div>
                            <div className="cl-metric-item">
                                <span className="cl-metric-name">Avg Gateway Latency (HTTP)</span>
                                <span className="cl-metric-val">{avgLatencyMs > 0 ? `${avgLatencyMs.toFixed(1)} ms` : '—'}</span>
                            </div>
                            <div className="cl-metric-item">
                                <span className="cl-metric-name">Engine Native Ops (C++20)</span>
                                <span className="cl-metric-val text-emerald">~40–120 ns (Benchmarked)</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Eviction Distribution & Memory Insights */}
                <div className="cl-card">
                    <div className="cl-card-header">
                        <div className="cl-card-title-box">
                            <h3 className="cl-card-title">Latency & Execution Profile</h3>
                            <span className="cl-card-subtitle">Comparing network hop vs in-memory C++ pointer manipulation</span>
                        </div>
                    </div>

                    <div className="cl-card-body">
                        <div className="cl-latency-comparison-box">
                            <div className="cl-latency-bar-item">
                                <div className="cl-latency-title">
                                    <span>C++ LRU In-Memory Operation</span>
                                    <span className="text-emerald font-mono">~0.00005 ms (50 ns)</span>
                                </div>
                                <div className="cl-latency-bar-track">
                                    <div className="cl-latency-bar-fill" style={{ width: '4%' }} />
                                </div>
                                <div className="cl-latency-caption">Direct L1/L2 CPU cache memory pointer swap</div>
                            </div>

                            <div className="cl-latency-bar-item">
                                <div className="cl-latency-title">
                                    <span>Express API Gateway Forwarding</span>
                                    <span className="font-mono text-muted">~0.5 - 1.2 ms</span>
                                </div>
                                <div className="cl-latency-bar-track">
                                    <div className="cl-latency-bar-fill" style={{ width: '35%' }} />
                                </div>
                                <div className="cl-latency-caption">JSON serialization, Express routing, loopback socket</div>
                            </div>

                            <div className="cl-latency-bar-item">
                                <div className="cl-latency-title">
                                    <span>Full Frontend Round-Trip (UI ⟷ API)</span>
                                    <span className="font-mono text-muted">~2 - 5 ms</span>
                                </div>
                                <div className="cl-latency-bar-track">
                                    <div className="cl-latency-bar-fill" style={{ width: '75%' }} />
                                </div>
                                <div className="cl-latency-caption">Browser network stack, React state dispatch, DOM paint</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Eviction Policy Comparison Matrix */}
            <div className="cl-card cl-policy-card">
                <div className="cl-card-header">
                    <div className="cl-card-title-box">
                        <h3 className="cl-card-title">Policy Comparison Matrix</h3>
                        <span className="cl-card-subtitle">Comparing LRU against alternative cache replacement algorithms</span>
                    </div>
                </div>

                <div className="cl-table-responsive">
                    <table className="cl-policy-table">
                        <thead>
                            <tr>
                                <th>Policy</th>
                                <th>Strategy</th>
                                <th>Lookup Time</th>
                                <th>Eviction Time</th>
                                <th>Primary Advantage</th>
                                <th>Key Vulnerability</th>
                                <th>Typical Use Cases</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="highlight-row">
                                <td className="font-bold text-emerald">
                                    LRU <span className="cl-badge-engine">Implemented</span>
                                </td>
                                <td>Evicts the entry that hasn't been accessed for the longest time</td>
                                <td><code>O(1) avg</code></td>
                                <td><code>O(1)</code></td>
                                <td>Adapts quickly to temporal locality; simple O(1) ops</td>
                                <td>Vulnerable to full-cache sequential scan polluting all slots</td>
                                <td>Web caching, CPU caches, CDNs, Memory buffers</td>
                            </tr>
                            <tr>
                                <td className="font-bold">FIFO</td>
                                <td>Evicts the oldest inserted entry regardless of access count or recency</td>
                                <td><code>O(1) avg</code></td>
                                <td><code>O(1)</code></td>
                                <td>Extremely low overhead; simple queue</td>
                                <td>May evict heavily-accessed keys merely because they are old (Belady's Anomaly)</td>
                                <td>Basic rate limiters, simple log buffers</td>
                            </tr>
                            <tr>
                                <td className="font-bold">LFU</td>
                                <td>Evicts the entry with the lowest overall frequency of accesses</td>
                                <td><code>O(1) avg</code></td>
                                <td><code>O(1)</code></td>
                                <td>Protects persistent popular items from transient bursts</td>
                                <td>Historical items build up huge frequency counts that never decay (cache pollution)</td>
                                <td>Database query plan caches, static assets</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
