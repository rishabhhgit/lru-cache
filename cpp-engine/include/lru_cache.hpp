#ifndef CACHELAB_LRU_CACHE_HPP
#define CACHELAB_LRU_CACHE_HPP

#include <cstddef>
#include <list>
#include <mutex>
#include <shared_mutex>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace cachelab {

/**
 * @brief A generic LRU (Least Recently Used) cache implementation using C++20.
 *
 * Data structures:
 *   - std::list stores (key, value) pairs in recency order:
 *     front() = Most Recently Used (MRU), back() = Least Recently Used (LRU).
 *   - std::unordered_map maps keys to list iterators for O(1) average lookup.
 *
 * All mutating operations (get, put, remove, resize, clear) acquire a
 * std::unique_lock (write lock). Read-only operations (contains, getKeysInOrder,
 * getStats) acquire a std::shared_lock (read lock) where appropriate.
 *
 * Time complexity (average case, hash-map operations are average O(1),
 * not guaranteed worst-case O(1)):
 *   get:      O(1) average
 *   put:      O(1) average
 *   remove:   O(1) average
 *   contains: O(1) average
 *   resize:   O(n) where n = number of evicted entries
 *   clear:    O(n)
 *
 * Space complexity: O(capacity)
 */
template <typename K, typename V>
class LRUCache {
public:
    using key_type   = K;
    using mapped_type = V;
    using value_type  = std::pair<const K, V>;
    using list_type   = std::list<value_type>;
    using iterator    = typename list_type::iterator;
    using size_type   = std::size_t;

    struct Stats {
        size_type capacity;
        size_type size;
        size_type hits;
        size_type misses;
        size_type evictions;
        double hit_rate;
        double miss_rate;
    };

    /**
     * @brief Construct an LRU cache with the given capacity.
     * @param capacity Maximum number of entries. Must be > 0.
     * @throws std::invalid_argument if capacity == 0.
     */
    explicit LRUCache(size_type capacity)
        : capacity_(capacity), hits_(0), misses_(0), evictions_(0) {
        if (capacity == 0) {
            throw std::invalid_argument("LRUCache capacity must be greater than 0");
        }
    }

    LRUCache(const LRUCache&) = delete;
    LRUCache& operator=(const LRUCache&) = delete;
    LRUCache(LRUCache&&) noexcept = default;
    LRUCache& operator=(LRUCache&&) noexcept = default;

    /**
     * @brief Retrieve a value by key.
     *
     * On a hit, moves the entry to the MRU (front) position and increments hits.
     * On a miss, increments misses and returns std::nullopt.
     *
     * @return std::optional<V> containing the value on hit, or std::nullopt on miss.
     */
    auto get(const K& key) -> std::optional<V> {
        std::unique_lock lock(mutex_);
        auto it = map_.find(key);
        if (it == map_.end()) {
            ++misses_;
            return std::nullopt;
        }
        // Splice the node to the front (MRU position).
        list_.splice(list_.begin(), list_, it->second);
        ++hits_;
        return it->second->second;
    }

    /**
     * @brief Insert or update a key-value pair.
     *
     * If the key already exists, its value is updated and it is moved to MRU.
     * If the key is new and the cache is at capacity, the LRU entry is evicted.
     *
     * @param key   The key to insert/update.
     * @param value The value to associate with the key.
     */
    void put(const K& key, V value) {
        std::unique_lock lock(mutex_);
        auto it = map_.find(key);
        if (it != map_.end()) {
            // Update existing key in place and move to front.
            it->second->second = std::move(value);
            list_.splice(list_.begin(), list_, it->second);
            return;
        }

        // New entry: evict LRU if at capacity.
        if (list_.size() >= capacity_) {
            evictLRU();
        }

        // Insert at front (MRU).
        list_.emplace_front(key, std::move(value));
        map_[key] = list_.begin();
    }

    /**
     * @brief Remove a specific key from the cache.
     *
     * @return true if the key existed and was removed, false otherwise.
     */
    auto remove(const K& key) -> bool {
        std::unique_lock lock(mutex_);
        auto it = map_.find(key);
        if (it == map_.end()) {
            return false;
        }
        list_.erase(it->second);
        map_.erase(it);
        return true;
    }

    /**
     * @brief Change the cache capacity at runtime.
     *
     * If the new capacity is smaller than the current size, the LRU entries
     * are evicted until size <= new capacity.
     *
     * @param new_capacity The new capacity. Must be > 0.
     * @throws std::invalid_argument if new_capacity == 0.
     */
    void resize(size_type new_capacity) {
        if (new_capacity == 0) {
            throw std::invalid_argument("LRUCache capacity must be greater than 0");
        }
        std::unique_lock lock(mutex_);
        capacity_ = new_capacity;
        while (list_.size() > capacity_) {
            evictLRU();
        }
    }

    /**
     * @brief Remove all entries from the cache.
     */
    void clear() {
        std::unique_lock lock(mutex_);
        list_.clear();
        map_.clear();
    }

    /**
     * @brief Return current cache statistics.
     */
    auto getStats() const -> Stats {
        std::shared_lock lock(mutex_);
        double total = static_cast<double>(hits_ + misses_);
        double hits  = static_cast<double>(hits_);
        double misses = static_cast<double>(misses_);
        Stats s;
        s.capacity   = capacity_;
        s.size       = list_.size();
        s.hits       = hits_;
        s.misses     = misses_;
        s.evictions  = evictions_;
        s.hit_rate   = (total > 0.0) ? (hits / total) * 100.0 : 0.0;
        s.miss_rate  = (total > 0.0) ? (misses / total) * 100.0 : 0.0;
        return s;
    }

    /**
     * @brief Return keys from MRU to LRU order.
     */
    auto getKeysInOrder() const -> std::vector<K> {
        std::shared_lock lock(mutex_);
        std::vector<K> keys;
        keys.reserve(list_.size());
        for (const auto& [k, _] : list_) {
            keys.push_back(k);
        }
        return keys;
    }

    /** @brief Return (key, value) entries from MRU to LRU order without changing recency. */
    auto getEntries() const -> std::vector<std::pair<K, V>> {
        std::shared_lock lock(mutex_);
        std::vector<std::pair<K, V>> entries;
        entries.reserve(list_.size());
        for (const auto& [k, v] : list_) {
            entries.emplace_back(k, v);
        }
        return entries;
    }

    /**
     * @brief Check if a key exists without changing recency.
     */
    auto contains(const K& key) const -> bool {
        std::shared_lock lock(mutex_);
        return map_.find(key) != map_.end();
    }

    /**
     * @brief Reset hit/miss/eviction counters without deleting cached entries.
     */
    void resetStats() {
        std::unique_lock lock(mutex_);
        hits_ = 0;
        misses_ = 0;
        evictions_ = 0;
    }

    /**
     * @brief Return the current capacity.
     */
    auto capacity() const -> size_type {
        std::shared_lock lock(mutex_);
        return capacity_;
    }

    /**
     * @brief Return the current number of entries.
     */
    auto size() const -> size_type {
        std::shared_lock lock(mutex_);
        return list_.size();
    }

private:
    /**
     * @brief Evict the least recently used entry (back of the list).
     *
     * Assumes the caller holds the write lock and the list is non-empty.
     */
    void evictLRU() {
        if (list_.empty()) return;
        auto& last = list_.back();
        map_.erase(last.first);
        list_.pop_back();
        ++evictions_;
    }

    list_type        list_;      // front = MRU, back = LRU
    std::unordered_map<K, iterator> map_;  // key -> list iterator
    mutable std::shared_mutex mutex_;      // protects list_ and map_
    size_type        capacity_;
    size_type        hits_;
    size_type        misses_;
    size_type        evictions_;
};

} // namespace cachelab

#endif // CACHELAB_LRU_CACHE_HPP
