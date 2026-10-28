import React, { useState } from 'react';

export const CppCodeViewer: React.FC = () => {
    const [activeSnippet, setActiveSnippet] = useState<'class' | 'get' | 'put' | 'evict'>('class');

    return (
        <div className="cl-code-viewer-container">
            <div className="cl-card">
                <div className="cl-card-header">
                    <div className="cl-card-title-box">
                        <h3 className="cl-card-title">💻 C++20 Core LRU Engine Inspector</h3>
                        <span className="cl-card-subtitle">
                            Inspect the actual production C++ code powering this system (`cpp-engine/include/lru_cache.hpp`)
                        </span>
                    </div>

                    <div className="cl-subnav-pills">
                        <button
                            className={`cl-subnav-btn ${activeSnippet === 'class' ? 'active' : ''}`}
                            onClick={() => setActiveSnippet('class')}
                        >
                            Class Architecture
                        </button>
                        <button
                            className={`cl-subnav-btn ${activeSnippet === 'get' ? 'active' : ''}`}
                            onClick={() => setActiveSnippet('get')}
                        >
                            GET Operation
                        </button>
                        <button
                            className={`cl-subnav-btn ${activeSnippet === 'put' ? 'active' : ''}`}
                            onClick={() => setActiveSnippet('put')}
                        >
                            PUT Operation
                        </button>
                        <button
                            className={`cl-subnav-btn ${activeSnippet === 'evict' ? 'active' : ''}`}
                            onClick={() => setActiveSnippet('evict')}
                        >
                            Eviction Mechanism
                        </button>
                    </div>
                </div>

                <div className="cl-card-body">
                    {activeSnippet === 'class' && (
                        <div className="cl-code-panel">
                            <div className="cl-code-meta">
                                <strong>Data Structure Definitions</strong>: `std::list` (doubly linked list) + `std::unordered_map`
                            </div>
                            <pre className="cl-code-block">
{`template <typename K, typename V>
class LRUCache {
public:
    using key_type    = K;
    using mapped_type = V;
    using value_type  = std::pair<const K, V>;
    using list_type   = std::list<value_type>;
    using iterator    = typename list_type::iterator;
    using size_type   = std::size_t;

    struct PutResult {
        bool inserted{false};
        bool updated{false};
        bool evicted{false};
        K evicted_key{};
        V evicted_value{};
        K key{};
        V value{};
    };

private:
    list_type                       list_;      // front = MRU (most recent), back = LRU (oldest)
    std::unordered_map<K, iterator> map_;       // key -> list iterator (O(1) average lookup)
    mutable std::shared_mutex       mutex_;     // Reader-writer thread safety (C++17/20)
    size_type                       capacity_;
    size_type                       hits_;
    size_type                       misses_;
    size_type                       evictions_;
};`}
                            </pre>
                        </div>
                    )}

                    {activeSnippet === 'get' && (
                        <div className="cl-code-panel">
                            <div className="cl-code-meta">
                                <strong>get(key)</strong>: O(1) average lookup via map, then O(1) splice to front.
                            </div>
                            <pre className="cl-code-block">
{`auto get(const K& key) -> std::optional<V> {
    std::unique_lock lock(mutex_); // Acquire exclusive write lock
    auto it = map_.find(key);
    
    if (it == map_.end()) {
        ++misses_;
        return std::nullopt; // Cache Miss: order remains unchanged
    }

    // Cache Hit: Splice node to front (MRU position) in O(1) without invalidating iterators!
    list_.splice(list_.begin(), list_, it->second);
    ++hits_;
    return it->second->second; // Return cached value
}`}
                            </pre>
                        </div>
                    )}

                    {activeSnippet === 'put' && (
                        <div className="cl-code-panel">
                            <div className="cl-code-meta">
                                <strong>put(key, value)</strong>: Handles update in-place or insert with eviction if full.
                            </div>
                            <pre className="cl-code-block">
{`auto put(const K& key, V value) -> PutResult {
    std::unique_lock lock(mutex_);
    PutResult result;
    result.key = key;

    auto it = map_.find(key);
    if (it != map_.end()) {
        // Update existing key in-place and promote to MRU
        it->second->second = std::move(value);
        list_.splice(list_.begin(), list_, it->second);
        result.updated = true;
        result.value = it->second->second;
        return result;
    }

    result.inserted = true;

    // If cache reached capacity, evict the least recently used element (back)
    if (list_.size() >= capacity_) {
        if (!list_.empty()) {
            result.evicted = true;
            result.evicted_key = list_.back().first;
            result.evicted_value = list_.back().second;
        }
        evictLRU(); // Erases from map and pops from back in O(1)
    }

    // Insert new entry at front (MRU)
    list_.emplace_front(key, std::move(value));
    map_[key] = list_.begin();
    result.value = list_.front().second;
    return result;
}`}
                            </pre>
                        </div>
                    )}

                    {activeSnippet === 'evict' && (
                        <div className="cl-code-panel">
                            <div className="cl-code-meta">
                                <strong>evictLRU()</strong>: Erases back node from hash map and pops back of list in O(1).
                            </div>
                            <pre className="cl-code-block">
{`void evictLRU() {
    if (list_.empty()) return;

    // The back of the list is always the Least Recently Used (oldest) entry
    auto& last = list_.back();

    // Erase key from hash map in O(1) average
    map_.erase(last.first);

    // Pop tail node from doubly linked list in O(1)
    list_.pop_back();

    ++evictions_;
}`}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
