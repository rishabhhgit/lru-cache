#include "lru_cache.hpp"

#include <benchmark/benchmark.h>

#include <random>
#include <string>
#include <vector>

using cachelab::LRUCache;

// ---------------------------------------------------------------------------
// Fixture: fresh cache per benchmark run, keys are simple strings.
// ---------------------------------------------------------------------------
class CacheFixture : public benchmark::Fixture {
public:
    void SetUp(const ::benchmark::State& st) override {
        capacity_ = static_cast<size_t>(st.range(0));
        cache_ = std::make_unique<LRUCache<std::string, std::string>>(capacity_);
        // Pre-fill a working set so GET hits are realistic.
        for (size_t i = 0; i < capacity_; ++i) {
            cache_->put("key" + std::to_string(i), "value" + std::to_string(i));
        }
    }

    void TearDown(const ::benchmark::State&) override { cache_.reset(); }

protected:
    size_t capacity_{0};
    std::unique_ptr<LRUCache<std::string, std::string>> cache_;
};

// GET hit: access an existing key (cycles through keys to stay in cache).
BENCHMARK_DEFINE_F(CacheFixture, GetHit)(benchmark::State& st) {
    size_t i = 0;
    for (auto _ : st) {
        auto v = cache_->get("key" + std::to_string(i % capacity_));
        benchmark::DoNotOptimize(v);
        ++i;
    }
    st.SetItemsProcessed(st.iterations());
}
BENCHMARK_REGISTER_F(CacheFixture, GetHit)
    ->Args({16})
    ->Args({256})
    ->Args({4096})
    ->Unit(benchmark::kMicrosecond);

// GET miss: access a key guaranteed absent.
BENCHMARK_DEFINE_F(CacheFixture, GetMiss)(benchmark::State& st) {
    for (auto _ : st) {
        auto v = cache_->get("__missing__");
        benchmark::DoNotOptimize(v);
    }
    st.SetItemsProcessed(st.iterations());
}
BENCHMARK_REGISTER_F(CacheFixture, GetMiss)
    ->Args({16})
    ->Args({256})
    ->Args({4096})
    ->Unit(benchmark::kMicrosecond);

// PUT insertion: insert new keys until capacity is reached, then reuse.
// This drives evictions once the cache is full.
BENCHMARK_DEFINE_F(CacheFixture, PutInsert)(benchmark::State& st) {
    size_t i = 0;
    for (auto _ : st) {
        cache_->put("newkey" + std::to_string(i), "newvalue" + std::to_string(i));
        ++i;
        if (i >= capacity_ * 2) i = 0; // overwrite old newkeys to keep churn
    }
    st.SetItemsProcessed(st.iterations());
}
BENCHMARK_REGISTER_F(CacheFixture, PutInsert)
    ->Args({16})
    ->Args({256})
    ->Args({4096})
    ->Unit(benchmark::kMicrosecond);

// PUT update: update existing keys (no eviction after warm-up).
BENCHMARK_DEFINE_F(CacheFixture, PutUpdate)(benchmark::State& st) {
    size_t i = 0;
    for (auto _ : st) {
        cache_->put("key" + std::to_string(i % capacity_), "updated" + std::to_string(i));
        ++i;
    }
    st.SetItemsProcessed(st.iterations());
}
BENCHMARK_REGISTER_F(CacheFixture, PutUpdate)
    ->Args({16})
    ->Args({256})
    ->Args({4096})
    ->Unit(benchmark::kMicrosecond);

// Mixed workload: 50% gets, 50% puts against a steady-state cache.
BENCHMARK_DEFINE_F(CacheFixture, Mixed)(benchmark::State& st) {
    size_t i = 0;
    for (auto _ : st) {
        if (i % 2 == 0) {
            cache_->get("key" + std::to_string(i % capacity_));
        } else {
            cache_->put("key" + std::to_string(i % capacity_), "v" + std::to_string(i));
        }
        ++i;
    }
    st.SetItemsProcessed(st.iterations());
}
BENCHMARK_REGISTER_F(CacheFixture, Mixed)
    ->Args({16})
    ->Args({256})
    ->Args({4096})
    ->Unit(benchmark::kMicrosecond);

BENCHMARK_MAIN();
