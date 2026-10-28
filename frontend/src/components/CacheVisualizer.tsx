import React from 'react';
import type { CacheEntry, CacheStats } from '@/types/cache';

interface CacheVisualizerProps {
    entries: CacheEntry[]; // Ordered LRU -> MRU
    stats: CacheStats | null;
    activeKey: string | null;
    actionType: 'hit' | 'miss' | 'inserted' | 'updated' | 'evicted' | 'deleted' | null;
    lastEvicted: { key: string; value: string } | null;
    onQuickGet: (key: string) => void;
    onQuickDelete: (key: string) => void;
    onLoadSampleData: () => void;
}

export const CacheVisualizer: React.FC<CacheVisualizerProps> = ({
    entries,
    stats,
    activeKey,
    actionType,
    lastEvicted,
    onQuickGet,
    onQuickDelete,
    onLoadSampleData,
}) => {
    const [showHashMap, setShowHashMap] = React.useState(true);
    const capacity = stats?.capacity ?? 1;

    // Entries are passed in LRU -> MRU order
    const totalEntries = entries.length;

    return (
        <section className="cl-visualizer-container">
            <div className="cl-vis-header">
                <div className="cl-vis-title-group">
                    <h2 className="cl-vis-title">
                        <span className="cl-vis-icon">🔗</span> Doubly Linked List & Hash Map State
                    </h2>
                    <span className="cl-vis-subtitle">
                        Real-time C++ heap representation • LRU (Head / Eviction Target) ⇄ MRU (Tail / Newest)
                    </span>
                </div>

                <div className="cl-vis-toolbar">
                    <button
                        className={`cl-btn-toggle ${showHashMap ? 'active' : ''}`}
                        onClick={() => setShowHashMap((prev) => !prev)}
                        title="Toggle Hash Map mapping inspection"
                    >
                        🗂️ {showHashMap ? 'Hide Hash Map' : 'Show Hash Map'}
                    </button>
                </div>
            </div>

            {/* Main Linked List Visualization Strip */}
            <div className="cl-vis-canvas">
                {totalEntries === 0 ? (
                    <div className="cl-vis-empty">
                        <div className="cl-vis-empty-icon">📭</div>
                        <div className="cl-vis-empty-title">Cache is currently empty</div>
                        <div className="cl-vis-empty-desc">
                            No entries in the C++ doubly linked list. Insert entries using the Playground below or load quick sample data.
                        </div>
                        <button className="cl-btn-sample" onClick={onLoadSampleData}>
                            ⚡ Load Sample Data (A, B, C)
                        </button>
                    </div>
                ) : (
                    <div className="cl-linked-list-track">
                        {/* Ghost Evicted Node (if eviction just occurred) */}
                        {lastEvicted && actionType === 'evicted' && (
                            <div className="cl-evicted-ghost-wrapper">
                                <div className="cl-node-card evicted-animation">
                                    <div className="cl-node-tag tag-evicted">EVICTED FROM LRU</div>
                                    <div className="cl-node-key">{lastEvicted.key}</div>
                                    <div className="cl-node-val">{lastEvicted.value}</div>
                                    <div className="cl-node-pointers">
                                        <span>pop_front()</span>
                                    </div>
                                </div>
                                <div className="cl-evict-arrow">⤳ Evicted</div>
                            </div>
                        )}

                        {/* Head Sentinel / NULL pointer */}
                        <div className="cl-sentinel-box">
                            <span className="cl-sentinel-label">HEAD</span>
                            <span className="cl-sentinel-null">nullptr</span>
                            <span className="cl-sentinel-pointer">⟵ prev</span>
                        </div>

                        {/* List Nodes */}
                        {entries.map((entry, index) => {
                            const isOldestLRU = index === 0;
                            const isNewestMRU = index === totalEntries - 1;
                            const isActive = activeKey === entry.key;

                            let nodeStatusClass = '';
                            if (isActive) {
                                if (actionType === 'hit') nodeStatusClass = 'node-hit';
                                else if (actionType === 'updated') nodeStatusClass = 'node-updated';
                                else if (actionType === 'inserted') nodeStatusClass = 'node-inserted';
                                else if (actionType === 'deleted') nodeStatusClass = 'node-deleted';
                            }

                            return (
                                <React.Fragment key={entry.key}>
                                    <div
                                        className={`cl-node-card ${nodeStatusClass} ${isOldestLRU ? 'is-lru' : ''} ${isNewestMRU ? 'is-mru' : ''}`}
                                    >
                                        <div className="cl-node-header">
                                            <span className="cl-node-rank">#{index + 1}</span>
                                            {isOldestLRU && (
                                                <span className="cl-node-tag tag-lru" title="Next in line to be evicted if full">
                                                    LRU (Oldest)
                                                </span>
                                            )}
                                            {isNewestMRU && (
                                                <span className="cl-node-tag tag-mru" title="Most recently accessed or inserted">
                                                    MRU (Newest)
                                                </span>
                                            )}
                                            {!isOldestLRU && !isNewestMRU && (
                                                <span className="cl-node-tag tag-mid">Slot {index + 1}</span>
                                            )}
                                        </div>

                                        <div className="cl-node-body">
                                            <div className="cl-node-field">
                                                <span className="cl-field-label">Key</span>
                                                <span className="cl-node-key" title={entry.key}>
                                                    {entry.key}
                                                </span>
                                            </div>
                                            <div className="cl-node-field">
                                                <span className="cl-field-label">Value</span>
                                                <span className="cl-node-val" title={entry.value}>
                                                    {entry.value}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="cl-node-pointers">
                                            <span className="cl-ptr left" title="Points to less recently used predecessor">
                                                ← prev
                                            </span>
                                            <span className="cl-ptr-divider">|</span>
                                            <span className="cl-ptr right" title="Points to more recently used successor">
                                                next →
                                            </span>
                                        </div>

                                        <div className="cl-node-actions">
                                            <button
                                                className="cl-btn-mini get"
                                                onClick={() => onQuickGet(entry.key)}
                                                title="GET: Touch and move to MRU"
                                            >
                                                GET
                                            </button>
                                            <button
                                                className="cl-btn-mini del"
                                                onClick={() => onQuickDelete(entry.key)}
                                                title="DELETE: Erase from cache"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>

                                    {/* Link Connector between adjacent nodes */}
                                    {index < totalEntries - 1 && (
                                        <div className="cl-link-connector" title="Doubly linked list bidirectional pointers">
                                            <div className="cl-link-arrow">⇄</div>
                                            <div className="cl-link-line" />
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}

                        {/* Tail Sentinel / NULL pointer */}
                        <div className="cl-sentinel-box">
                            <span className="cl-sentinel-label">TAIL</span>
                            <span className="cl-sentinel-null">nullptr</span>
                            <span className="cl-sentinel-pointer">next ⟶</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Dual Data Structure Hash Map Overlay */}
            {showHashMap && totalEntries > 0 && (
                <div className="cl-hashmap-panel">
                    <div className="cl-hm-header">
                        <span className="cl-hm-title">
                            std::unordered_map&lt;std::string, std::list::iterator&gt; [O(1) Avg Lookup]
                        </span>
                        <span className="cl-hm-info">
                            Each map entry stores a direct iterator/pointer to its doubly-linked node in memory.
                        </span>
                    </div>
                    <div className="cl-hm-buckets">
                        {entries.map((entry, idx) => (
                            <div
                                key={entry.key}
                                className={`cl-hm-bucket ${activeKey === entry.key ? 'active' : ''}`}
                            >
                                <span className="cl-hm-key">"{entry.key}"</span>
                                <span className="cl-hm-arrow">⟶ Node #{idx + 1}</span>
                                <span className="cl-hm-ptr">
                                    [0x{((idx + 1) * 0x10a4).toString(16).toUpperCase()}]
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};
