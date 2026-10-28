/**
 * lruCache.ts
 *
 * A faithful TypeScript port of cpp-engine/include/lru_cache.hpp.
 *
 * Data structures mirror the C++ original:
 *   - A doubly-linked list keeps entries in recency order:
 *     head.next = Most Recently Used (MRU), tail.prev = Least Recently Used (LRU).
 *   - A Map<key, ListNode> provides O(1) average lookup.
 *
 * All operations are synchronous and O(1) average (amortised), matching the
 * C++ implementation. No external dependencies.
 */

interface ListNode<K, V> {
    key: K;
    value: V;
    prev: ListNode<K, V> | null;
    next: ListNode<K, V> | null;
}

export interface CacheStats {
    capacity: number;
    size: number;
    hits: number;
    misses: number;
    evictions: number;
    hit_rate: number;
    miss_rate: number;
}

export interface PutResult<K, V> {
    key: K;
    value: V;
    inserted: boolean;
    updated: boolean;
    evicted: boolean;
    evicted_key: K | null;
    evicted_value: V | null;
}

export interface CacheEntry<K, V> {
    key: K;
    value: V;
    position: number;
    is_mru: boolean;
    is_lru: boolean;
}

export class LRUCache<K = string, V = string> {
    private readonly map: Map<K, ListNode<K, V>> = new Map();
    // Sentinel nodes — never hold real data, simplify edge cases.
    private readonly head: ListNode<K, V>;   // before MRU
    private readonly tail: ListNode<K, V>;   // after LRU
    private _capacity: number;
    private _hits = 0;
    private _misses = 0;
    private _evictions = 0;

    constructor(capacity: number) {
        if (!Number.isInteger(capacity) || capacity <= 0) {
            throw new Error('LRUCache capacity must be a positive integer');
        }
        this._capacity = capacity;
        this.head = { key: null as unknown as K, value: null as unknown as V, prev: null, next: null };
        this.tail = { key: null as unknown as K, value: null as unknown as V, prev: null, next: null };
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }

    // ── Public API ──────────────────────────────────────────────────────────

    /**
     * Retrieve a value by key.
     * On hit: moves entry to MRU, increments hits.
     * On miss: increments misses, returns null.
     */
    get(key: K): V | null {
        const node = this.map.get(key);
        if (!node) {
            this._misses++;
            return null;
        }
        this.moveToFront(node);
        this._hits++;
        return node.value;
    }

    /**
     * Insert or update a key-value pair.
     * If the key exists, its value is updated and moved to MRU.
     * If new and at capacity, the LRU entry is evicted first.
     */
    put(key: K, value: V): PutResult<K, V> {
        const existing = this.map.get(key);
        if (existing) {
            existing.value = value;
            this.moveToFront(existing);
            return {
                key, value,
                inserted: false, updated: true,
                evicted: false, evicted_key: null, evicted_value: null,
            };
        }

        let evicted = false;
        let evicted_key: K | null = null;
        let evicted_value: V | null = null;

        if (this.map.size >= this._capacity) {
            const lru = this.tail.prev!;
            if (lru !== this.head) {
                evicted_key = lru.key;
                evicted_value = lru.value;
                this.removeNode(lru);
                this.map.delete(evicted_key);
                this._evictions++;
                evicted = true;
            }
        }

        const node: ListNode<K, V> = { key, value, prev: null, next: null };
        this.insertAtFront(node);
        this.map.set(key, node);

        return { key, value, inserted: true, updated: false, evicted, evicted_key, evicted_value };
    }

    /**
     * Remove a key from the cache.
     * Returns the removed value, or null if the key didn't exist.
     */
    remove(key: K): V | null {
        const node = this.map.get(key);
        if (!node) return null;
        this.removeNode(node);
        this.map.delete(key);
        return node.value;
    }

    /**
     * Check if a key exists without changing recency.
     */
    contains(key: K): boolean {
        return this.map.has(key);
    }

    /**
     * Return entries in MRU → LRU order (most recent first).
     */
    getEntriesMRUtoLRU(): CacheEntry<K, V>[] {
        const entries: CacheEntry<K, V>[] = [];
        let node = this.head.next!;
        let i = 0;
        const total = this.map.size;
        while (node !== this.tail) {
            entries.push({
                key: node.key,
                value: node.value,
                position: i,
                is_mru: i === 0,
                is_lru: i === total - 1,
            });
            node = node.next!;
            i++;
        }
        return entries;
    }

    /**
     * Return entries in LRU → MRU order (oldest first).
     */
    getEntriesLRUtoMRU(): CacheEntry<K, V>[] {
        const entries: CacheEntry<K, V>[] = [];
        let node = this.tail.prev!;
        let i = 0;
        const total = this.map.size;
        while (node !== this.head) {
            entries.push({
                key: node.key,
                value: node.value,
                position: i,
                is_lru: i === 0,
                is_mru: i === total - 1,
            });
            node = node.prev!;
            i++;
        }
        return entries;
    }

    /**
     * Clear all entries (does not reset stats).
     */
    clear(): void {
        this.map.clear();
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }

    /**
     * Change capacity at runtime. If new capacity < current size,
     * LRU entries are evicted until size <= capacity.
     */
    resize(newCapacity: number): void {
        if (!Number.isInteger(newCapacity) || newCapacity <= 0) {
            throw new Error('LRUCache capacity must be a positive integer');
        }
        this._capacity = newCapacity;
        while (this.map.size > this._capacity) {
            const lru = this.tail.prev!;
            if (lru === this.head) break;
            this.map.delete(lru.key);
            this.removeNode(lru);
            this._evictions++;
        }
    }

    /**
     * Reset hit/miss/eviction counters without deleting entries.
     */
    resetStats(): void {
        this._hits = 0;
        this._misses = 0;
        this._evictions = 0;
    }

    getStats(): CacheStats {
        const total = this._hits + this._misses;
        return {
            capacity: this._capacity,
            size: this.map.size,
            hits: this._hits,
            misses: this._misses,
            evictions: this._evictions,
            hit_rate: total > 0 ? (this._hits / total) * 100 : 0,
            miss_rate: total > 0 ? (this._misses / total) * 100 : 0,
        };
    }

    get capacity(): number { return this._capacity; }
    get size(): number { return this.map.size; }

    // ── Private helpers ─────────────────────────────────────────────────────

    private moveToFront(node: ListNode<K, V>): void {
        this.removeNode(node);
        this.insertAtFront(node);
    }

    private insertAtFront(node: ListNode<K, V>): void {
        node.prev = this.head;
        node.next = this.head.next;
        this.head.next!.prev = node;
        this.head.next = node;
    }

    private removeNode(node: ListNode<K, V>): void {
        node.prev!.next = node.next;
        node.next!.prev = node.prev;
    }
}

