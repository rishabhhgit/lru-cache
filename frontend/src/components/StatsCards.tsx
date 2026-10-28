import React from 'react';
import type { CacheStats } from '@/types/cache';

interface StatsCardsProps {
    stats: CacheStats | null;
    loading: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
    const hits = stats?.hits ?? 0;
    const misses = stats?.misses ?? 0;
    const evictions = stats?.evictions ?? 0;
    const size = stats?.size ?? 0;
    const capacity = stats?.capacity ?? 1;
    const totalRequests = hits + misses;

    const hitRate = totalRequests > 0 ? (hits / totalRequests) * 100 : 0;
    const missRate = totalRequests > 0 ? (misses / totalRequests) * 100 : 0;
    const usagePercent = capacity > 0 ? Math.min(100, Math.round((size / capacity) * 100)) : 0;

    return (
        <section className="cl-stats-grid">
            <div className="cl-stat-card">
                <div className="cl-stat-header">
                    <span className="cl-stat-title">Usage & Capacity</span>
                    <span className="cl-stat-badge size-badge">{usagePercent}%</span>
                </div>
                <div className="cl-stat-value-row">
                    <span className="cl-stat-main-num">{size}</span>
                    <span className="cl-stat-denom">/ {capacity}</span>
                </div>
                <div className="cl-progress-track">
                    <div
                        className="cl-progress-fill"
                        style={{
                            width: `${usagePercent}%`,
                            backgroundColor: usagePercent >= 100 ? '#f43f5e' : usagePercent >= 70 ? '#f59e0b' : '#10b981',
                        }}
                    />
                </div>
                <div className="cl-stat-caption">
                    {capacity - size === 0 ? 'Cache is full (next insert evicts LRU)' : `${capacity - size} free slot${capacity - size === 1 ? '' : 's'}`}
                </div>
            </div>

            <div className="cl-stat-card hit-card">
                <div className="cl-stat-header">
                    <span className="cl-stat-title">Cache Hits</span>
                    <span className="cl-stat-badge hit-badge">{hitRate.toFixed(1)}%</span>
                </div>
                <div className="cl-stat-value-row">
                    <span className="cl-stat-main-num text-emerald">{hits}</span>
                    <span className="cl-stat-sub">hits</span>
                </div>
                <div className="cl-progress-track">
                    <div className="cl-progress-fill bg-emerald" style={{ width: `${hitRate}%` }} />
                </div>
                <div className="cl-stat-caption">Promotes element to MRU position</div>
            </div>

            <div className="cl-stat-card miss-card">
                <div className="cl-stat-header">
                    <span className="cl-stat-title">Cache Misses</span>
                    <span className="cl-stat-badge miss-badge">{missRate.toFixed(1)}%</span>
                </div>
                <div className="cl-stat-value-row">
                    <span className="cl-stat-main-num text-rose">{misses}</span>
                    <span className="cl-stat-sub">misses</span>
                </div>
                <div className="cl-progress-track">
                    <div className="cl-progress-fill bg-rose" style={{ width: `${missRate}%` }} />
                </div>
                <div className="cl-stat-caption">Key absent; order unchanged</div>
            </div>

            <div className="cl-stat-card evict-card">
                <div className="cl-stat-header">
                    <span className="cl-stat-title">Evictions</span>
                    <span className="cl-stat-badge evict-badge">O(1)</span>
                </div>
                <div className="cl-stat-value-row">
                    <span className="cl-stat-main-num text-amber">{evictions}</span>
                    <span className="cl-stat-sub">evicted</span>
                </div>
                <div className="cl-progress-track">
                    <div
                        className="cl-progress-fill bg-amber"
                        style={{ width: `${Math.min(100, evictions * 10)}%` }}
                    />
                </div>
                <div className="cl-stat-caption">Oldest LRU key popped when full</div>
            </div>
        </section>
    );
};
