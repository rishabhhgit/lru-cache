#include "lru_cache.hpp"

#include <gtest/gtest.h>

#include <atomic>
#include <memory>
#include <string>
#include <thread>
#include <vector>

using cachelab::LRUCache;

static std::vector<std::string> mru_to_lru(const LRUCache<std::string, std::string>& c) {
    return c.getKeysInOrder();
}

TEST(LRUCacheTest, InsertAndRetrieve) {
    LRUCache<std::string, std::string> cache(3);
    cache.put("A", "apple");
    cache.put("B", "banana");
    cache.put("C", "cherry");
    EXPECT_TRUE(cache.contains("A"));
    EXPECT_TRUE(cache.contains("B"));
    EXPECT_TRUE(cache.contains("C"));
    EXPECT_FALSE(cache.contains("D"));
    auto v = cache.get("A");
    ASSERT_TRUE(v.has_value());
    EXPECT_EQ(*v, "apple");
}

TEST(LRUCacheTest, GetMissingReturnsNullopt) {
    LRUCache<std::string, std::string> cache(3);
    EXPECT_FALSE(cache.get("nonexistent").has_value());
}

TEST(LRUCacheTest, UpdateExistingKeyNoDuplicates) {
    LRUCache<std::string, std::string> cache(2);
    cache.put("A", "1");
    cache.put("B", "2");
    cache.put("A", "updated-A");
    EXPECT_EQ(cache.size(), 2u);
    auto v = cache.get("A");
    ASSERT_TRUE(v.has_value());
    EXPECT_EQ(*v, "updated-A");
    auto keys = mru_to_lru(cache);
    ASSERT_EQ(keys.size(), 2u);
    EXPECT_EQ(keys[0], "A");
    EXPECT_EQ(keys[1], "B");
}

TEST(LRUCacheTest, HitAndMissCounters) {
    LRUCache<std::string, std::string> cache(3);
    cache.resetStats();
    cache.put("A", "1");
    cache.put("B", "2");
    cache.get("A");
    cache.get("A");
    cache.get("Z");
    cache.get("Z");
    auto stats = cache.getStats();
    EXPECT_EQ(stats.hits, 2u);
    EXPECT_EQ(stats.misses, 2u);
    EXPECT_DOUBLE_EQ(stats.hit_rate, 50.0);
    EXPECT_DOUBLE_EQ(stats.miss_rate, 50.0);
}

TEST(LRUCacheTest, HitRateZeroWhenNoAccesses) {
    LRUCache<std::string, std::string> cache(3);
    auto stats = cache.getStats();
    EXPECT_EQ(stats.hits, 0u);
    EXPECT_EQ(stats.misses, 0u);
    EXPECT_DOUBLE_EQ(stats.hit_rate, 0.0);
    EXPECT_DOUBLE_EQ(stats.miss_rate, 0.0);
}

TEST(LRUCacheTest, GetMovesEntryToMRU) {
    LRUCache<std::string, std::string> cache(3);
    cache.put("A", "1");
    cache.put("B", "2");
    cache.put("C", "3");
    EXPECT_EQ(mru_to_lru(cache), (std::vector<std::string>{"C", "B", "A"}));
    cache.get("A");
    auto after = mru_to_lru(cache);
    ASSERT_EQ(after.size(), 3u);
    EXPECT_EQ(after[0], "A");
    EXPECT_EQ(after[1], "C");
    EXPECT_EQ(after[2], "B");
}

TEST(LRUCacheTest, EvictsLRUWhenFull) {
    LRUCache<std::string, std::string> cache(2);
    cache.put("A", "1");
    cache.put("B", "2");
    cache.put("C", "3");
    EXPECT_FALSE(cache.contains("A"));
    EXPECT_TRUE(cache.contains("B"));
    EXPECT_TRUE(cache.contains("C"));
    EXPECT_EQ(cache.getStats().evictions, 1u);
    auto keys = mru_to_lru(cache);
    ASSERT_EQ(keys.size(), 2u);
    EXPECT_EQ(keys[0], "C");
    EXPECT_EQ(keys[1], "B");
}

TEST(LRUCacheTest, CapacityOne) {
    LRUCache<std::string, std::string> cache(1);
    cache.put("A", "1");
    cache.put("B", "2");
    EXPECT_FALSE(cache.contains("A"));
    EXPECT_TRUE(cache.contains("B"));
    EXPECT_EQ(cache.getStats().evictions, 1u);
}

TEST(LRUCacheTest, RepeatedOperationsMaintainOrder) {
    LRUCache<std::string, std::string> cache(3);
    cache.put("A", "1");
    cache.put("B", "2");
    cache.put("C", "3");
    cache.get("B");
    cache.put("D", "4");
    EXPECT_FALSE(cache.contains("A"));
    EXPECT_EQ(mru_to_lru(cache), (std::vector<std::string>{"D", "B", "C"}));
}

TEST(LRUCacheTest, RemoveExistingKey) {
    LRUCache<std::string, std::string> cache(3);
    cache.put("A", "1");
    cache.put("B", "2");
    EXPECT_TRUE(cache.remove("B"));
    EXPECT_FALSE(cache.contains("B"));
    EXPECT_EQ(cache.size(), 1u);
    EXPECT_TRUE(cache.contains("A"));
}

TEST(LRUCacheTest, RemoveMissingKeyReturnsFalse) {
    LRUCache<std::string, std::string> cache(3);
    cache.put("A", "1");
    EXPECT_FALSE(cache.remove("ZZZ"));
    EXPECT_EQ(cache.size(), 1u);
}

TEST(LRUCacheTest, RemoveUpdatesRecencyOfRemaining) {
    LRUCache<std::string, std::string> cache(3);
    cache.put("A", "1");
    cache.put("B", "2");
    cache.put("C", "3");
    cache.remove("B");
    EXPECT_EQ(mru_to_lru(cache), (std::vector<std::string>{"C", "A"}));
}

TEST(LRUCacheTest, ResizeSmallerEvictsLRU) {
    LRUCache<std::string, std::string> cache(3);
    cache.put("A", "1");
    cache.put("B", "2");
    cache.put("C", "3");
    cache.resize(1);
    EXPECT_EQ(cache.size(), 1u);
    EXPECT_TRUE(cache.contains("C"));
    EXPECT_FALSE(cache.contains("A"));
    EXPECT_FALSE(cache.contains("B"));
    EXPECT_EQ(cache.getStats().evictions, 2u);
}

TEST(LRUCacheTest, ResizeLargerDoesNotEvict) {
    LRUCache<std::string, std::string> cache(2);
    cache.put("A", "1");
    cache.put("B", "2");
    cache.resize(10);
    EXPECT_EQ(cache.size(), 2u);
    EXPECT_EQ(cache.capacity(), 10u);
}

TEST(LRUCacheTest, ResizeZeroRejected) {
    LRUCache<std::string, std::string> cache(3);
    EXPECT_THROW(cache.resize(0), std::invalid_argument);
}

TEST(LRUCacheTest, ConstructorZeroCapacityRejected) {
    EXPECT_THROW((LRUCache<std::string, std::string>(0)), std::invalid_argument);
}

TEST(LRUCacheTest, ClearRemovesAllEntries) {
    LRUCache<std::string, std::string> cache(3);
    cache.put("A", "1");
    cache.put("B", "2");
    cache.clear();
    EXPECT_EQ(cache.size(), 0u);
    EXPECT_FALSE(cache.contains("A"));
    EXPECT_TRUE(mru_to_lru(cache).empty());
}

TEST(LRUCacheTest, ClearAllowsReinsertion) {
    LRUCache<std::string, std::string> cache(2);
    cache.put("A", "1");
    cache.clear();
    cache.put("A", "2");
    auto v = cache.get("A");
    ASSERT_TRUE(v.has_value());
    EXPECT_EQ(*v, "2");
}

TEST(LRUCacheTest, ResetStatsKeepsEntries) {
    LRUCache<std::string, std::string> cache(3);
    cache.put("A", "1");
    cache.get("A");
    cache.get("Z");
    cache.resetStats();
    auto stats = cache.getStats();
    EXPECT_EQ(stats.hits, 0u);
    EXPECT_EQ(stats.misses, 0u);
    EXPECT_EQ(cache.size(), 1u);
    EXPECT_TRUE(cache.contains("A"));
}

TEST(LRUCacheTest, StatsReportsCapacityAndSize) {
    LRUCache<std::string, std::string> cache(5);
    cache.put("A", "1");
    cache.put("B", "2");
    auto stats = cache.getStats();
    EXPECT_EQ(stats.capacity, 5u);
    EXPECT_EQ(stats.size, 2u);
    EXPECT_EQ(stats.evictions, 0u);
}

TEST(LRUCacheTest, ContainsDoesNotChangeRecency) {
    LRUCache<std::string, std::string> cache(3);
    cache.put("A", "1");
    cache.put("B", "2");
    cache.put("C", "3");
    cache.contains("A");
    EXPECT_EQ(mru_to_lru(cache), (std::vector<std::string>{"C", "B", "A"}));
}

TEST(LRUCacheTest, ConcurrentPutsAndGets) {
    LRUCache<std::string, std::string> cache(1000);
    std::atomic<int> errors{0};
    const int iterations = 5000;
    auto worker = [&](int offset) {
        for (int i = 0; i < iterations; ++i) {
            std::string key = "k" + std::to_string((offset * iterations + i) % 1000);
            cache.put(key, "v");
            if (!cache.get(key).has_value()) ++errors;
        }
    };
    std::vector<std::thread> threads;
    for (int t = 0; t < 4; ++t) threads.emplace_back(worker, t);
    for (auto& th : threads) th.join();
    EXPECT_EQ(errors, 0);
    EXPECT_LE(cache.size(), cache.capacity());
}

TEST(LRUCacheTest, NoDuplicateKeysInvariant) {
    LRUCache<std::string, std::string> cache(10);
    for (int i = 0; i < 50; ++i) {
        cache.put("k" + std::to_string(i % 7), std::to_string(i));
        cache.get("k" + std::to_string(i % 7));
    }
    EXPECT_EQ(cache.size(), 7u);
    EXPECT_EQ(mru_to_lru(cache).size(), cache.size());
}
