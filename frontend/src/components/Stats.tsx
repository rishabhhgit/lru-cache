import type { CacheStats } from '@/types/cache';

interface StatsProps {
    stats: CacheStats | null;
    loading: boolean;
    error: string | null;
}

export function Stats({ stats, loading, error }: StatsProps) {
    if (loading) {
        return (
            <div className="card">
                <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: '#94a3b8' }}>Stats</h2>
                <div className="muted">Loading stats…</div>
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="card">
                <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: '#94a3b8' }}>Stats</h2>
                <div className="error-banner">{error || 'No stats available'}</div>
            </div>
        );
    }

    return (
        <div className="card">
            <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#94a3b8' }}>Cache Stats</h2>
            <div className="grid">
                <div className="stat">
                    <div className="label">Capacity</div>
                    <div className="value">{stats.capacity}</div>
                </div>
                <div className="stat">
                    <div className="label">Size</div>
                    <div className="value">{stats.size}</div>
                </div>
                <div className="stat">
                    <div className="label">Hits</div>
                    <div className="value">{stats.hits}</div>
                </div>
                <div className="stat">
                    <div className="label">Misses</div>
                    <div className="value">{stats.misses}</div>
                </div>
                <div className="stat">
                    <div className="label">Hit rate</div>
                    <div className="value">{stats.hit_rate.toFixed(1)}%</div>
                </div>
                <div className="stat">
                    <div className="label">Evictions</div>
                    <div className="value">{stats.evictions}</div>
                </div>
            </div>
        </div>
    );
}
