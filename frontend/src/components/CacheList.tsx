import type { CacheEntry } from '@/types/cache';

interface CacheListProps {
    entries: CacheEntry[];
    loading: boolean;
    error: string | null;
    onGet: (key: string) => void;
    onDelete: (key: string) => void;
}

export function CacheList({
    entries,
    loading,
    error,
    onGet,
    onDelete,
}: CacheListProps) {
    if (loading) {
        return (
            <div className="card">
                <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: '#94a3b8' }}>
                    Entries (MRU &rarr; LRU)
                </h2>
                <div className="muted">Loading entries…</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card">
                <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: '#94a3b8' }}>
                    Entries (MRU &rarr; LRU)
                </h2>
                <div className="error-banner">{error}</div>
            </div>
        );
    }

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1rem', color: '#94a3b8' }}>
                    Entries (<span style={{ color: '#fff' }}>{entries.length}</span>)
                </h2>
                <span className="small">Ordered MRU &rarr; LRU</span>
            </div>
            {entries.length === 0 ? (
                <div className="empty">No entries in cache.</div>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Key</th>
                            <th>Value</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((entry, i) => (
                            <tr key={entry.key}>
                                <td style={{ color: '#94a3b8' }}>{i + 1}</td>
                                <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                                    {entry.key}
                                </td>
                                <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {entry.value}
                                </td>
                                <td>
                                    <span className={`badge ${entry.hit ? 'ok' : 'bad'}`}>
                                        {entry.hit ? 'HIT' : 'MISS'}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        <button
                                            className="secondary"
                                            onClick={() => onGet(entry.key)}
                                            disabled={loading}
                                        >
                                            Get
                                        </button>
                                        <button
                                            className="danger"
                                            onClick={() => onDelete(entry.key)}
                                            disabled={loading}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
