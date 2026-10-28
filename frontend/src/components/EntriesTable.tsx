import React, { useState } from 'react';
import type { CacheEntry } from '@/types/cache';

interface EntriesTableProps {
    entries: CacheEntry[]; // Ordered MRU -> LRU (or LRU -> MRU)
    onGet: (key: string) => void;
    onDelete: (key: string) => void;
    loading: boolean;
}

export const EntriesTable: React.FC<EntriesTableProps> = ({
    entries,
    onGet,
    onDelete,
    loading,
}) => {
    const [search, setSearch] = useState('');
    const [viewOrder, setViewOrder] = useState<'mru_first' | 'lru_first'>('mru_first');

    // Sort entries according to view preference
    // entries prop is passed in MRU -> LRU order by default from backend
    const displayedEntries = React.useMemo(() => {
        let list = [...entries];
        if (viewOrder === 'lru_first') {
            list = list.reverse();
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(
                (e) => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q),
            );
        }
        return list;
    }, [entries, viewOrder, search]);

    return (
        <div className="cl-card cl-table-card">
            <div className="cl-card-header">
                <div className="cl-card-title-box">
                    <h3 className="cl-card-title">
                        Cache Entries <span className="cl-count-pill">{entries.length}</span>
                    </h3>
                    <span className="cl-card-subtitle">
                        Recency order and active keys in the C++ engine
                    </span>
                </div>

                <div className="cl-table-toolbar">
                    <div className="cl-search-wrapper">
                        <input
                            type="text"
                            placeholder="Filter entries…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="cl-search-input"
                        />
                        {search && (
                            <button className="cl-search-clear" onClick={() => setSearch('')}>
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="cl-order-toggle-group">
                        <button
                            className={`cl-order-btn ${viewOrder === 'mru_first' ? 'active' : ''}`}
                            onClick={() => setViewOrder('mru_first')}
                            title="List newest (MRU) first"
                        >
                            MRU ⟶ LRU
                        </button>
                        <button
                            className={`cl-order-btn ${viewOrder === 'lru_first' ? 'active' : ''}`}
                            onClick={() => setViewOrder('lru_first')}
                            title="List oldest (LRU) first"
                        >
                            LRU ⟶ MRU
                        </button>
                    </div>
                </div>
            </div>

            <div className="cl-table-responsive">
                {entries.length === 0 ? (
                    <div className="cl-empty-state">
                        <div className="cl-empty-text">No cached items found</div>
                        <div className="cl-empty-sub">Add a key-value pair above to see it stored here.</div>
                    </div>
                ) : displayedEntries.length === 0 ? (
                    <div className="cl-empty-state">
                        <div className="cl-empty-text">No matches for "{search}"</div>
                        <button className="cl-btn-ghost-sm" onClick={() => setSearch('')}>
                            Clear search filter
                        </button>
                    </div>
                ) : (
                    <table className="cl-entries-table">
                        <thead>
                            <tr>
                                <th style={{ width: '60px' }}>Rank</th>
                                <th>Recency Position</th>
                                <th>Key</th>
                                <th>Value</th>
                                <th className="text-right" style={{ width: '140px' }}>
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedEntries.map((entry, idx) => {
                                // Calculate actual recency flags
                                const isMRU = entries[0]?.key === entry.key;
                                const isLRU = entries[entries.length - 1]?.key === entry.key;

                                return (
                                    <tr key={entry.key} className={isMRU ? 'row-mru' : isLRU ? 'row-lru' : ''}>
                                        <td className="cl-cell-rank">#{idx + 1}</td>
                                        <td className="cl-cell-recency">
                                            {isMRU && <span className="cl-badge-recency mru">MRU (Newest)</span>}
                                            {isLRU && <span className="cl-badge-recency lru">LRU (Target)</span>}
                                            {!isMRU && !isLRU && (
                                                <span className="cl-badge-recency mid">Rank {entries.findIndex(e => e.key === entry.key) + 1}</span>
                                            )}
                                        </td>
                                        <td className="cl-cell-key">
                                            <code>{entry.key}</code>
                                        </td>
                                        <td className="cl-cell-value">
                                            <code>{entry.value}</code>
                                        </td>
                                        <td className="cl-cell-actions text-right">
                                            <button
                                                className="cl-btn-action get"
                                                onClick={() => onGet(entry.key)}
                                                disabled={loading}
                                                title="Lookup: promotes to MRU"
                                            >
                                                GET
                                            </button>
                                            <button
                                                className="cl-btn-action delete"
                                                onClick={() => onDelete(entry.key)}
                                                disabled={loading}
                                                title="Delete this key"
                                            >
                                                DELETE
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
