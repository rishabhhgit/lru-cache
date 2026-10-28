# CacheLab — High-Performance LRU Cache

CacheLab is a complete, production-grade LRU (Least Recently Used) cache system with a C++20 core engine exposed over HTTP, an Express TypeScript API gateway, and a React dashboard frontend.

CacheLab demonstrates a full-stack LRU cache: the hot path lives in a lock-conscious C++ engine for maximum throughput, the Express gateway forwards requests and never fabricates success when the backend is down, and the React dashboard lets you inspect keys, values, hit/miss status, and live statistics in real time.

- **C++ engine** (`cpp-engine/`): header-only generic `LRUCache<K,V>` using `std::list` + `std::unordered_map` for O(1) average operations, protected by `std::shared_mutex` for thread safety, served via a lightweight `cpp-httplib` HTTP server.
- **API gateway** (`backend/`): Express + TypeScript service that forwards cache operations to the C++ server, with validation, centralized error handling, and honest 502 reporting when the C++ server is unavailable.
- **Frontend** (`frontend/`): React + TypeScript dashboard (Vite) for browsing entries (MRU → LRU), putting/getting/deleting keys, resizing, clearing, and watching live stats.
- **Tests**: GoogleTest unit tests for the C++ engine; Jest + supertest integration tests for the gateway against a real C++ server.

## How the LRU cache is implemented

### Core idea

An LRU cache evicts the **least recently used** entry when it reaches capacity. On every `get` (hit) or `put`, the touched entry becomes the **most recently used (MRU)**. The entry at the tail (LRU) is the first to be evicted.

### Data structures (`cpp-engine/include/lru_cache.hpp`)

The `LRUCache<K, V>` template combines two structures:

| Structure | Purpose |
|-----------|---------|
| `std::list<std::pair<const K, V>>` | Stores entries in recency order. `front()` = MRU, `back()` = LRU. |
| `std::unordered_map<K, list::iterator>` | Maps each key to its list node for O(1) average lookup. |

### Why this combination

- **Hash map** gives O(1) average lookup by key (find the list node).
- **Doubly-linked list** lets us move a node to the front (splice) or pop the back (evict) in O(1), without invalidating other iterators.

If we used only a map, finding/evicting the LRU would be O(n). If we used only a list, lookup by key would be O(n). Together they give O(1) average for both.

### Thread safety

All mutating operations (`get`, `put`, `remove`, `resize`, `clear`, `resetStats`) acquire a `std::unique_lock` (exclusive write lock). Read-only operations (`getStats`, `getKeysInOrder`, `getEntries`, `contains`, `capacity`, `size`) acquire a `std::shared_lock` (shared read lock), allowing concurrent reads.

### Complexity (average case)

| Operation | Time | Notes |
|-----------|------|-------|
| `get(key)` | O(1) avg | Hit: moves entry to MRU, increments hits. Miss: increments misses, returns `nullopt`. |
| `put(key, value)` | O(1) avg | Update existing (move to MRU) or insert new (evict LRU if full). |
| `remove(key)` | O(1) avg | Erase node from list and map. |
| `contains(key)` | O(1) avg | Read-only, does not change recency. |
| `resize(n)` | O(evicted) | Shrinking evicts LRU entries until size <= n. |
| `clear()` | O(n) | Drops all entries. |

Space complexity: **O(capacity)**.

### Eviction policy

When inserting a new key and `size == capacity`, the entry at `list_.back()` (the LRU) is removed from both the list and the map, and `evictions_` is incremented. The new entry is placed at `list_.begin()` (MRU).

### Statistics

The cache tracks `hits`, `misses`, `evictions`, `capacity`, and `size`, and derives `hit_rate` and `miss_rate` as percentages. `resetStats()` zeroes the counters without removing entries.

## API reference

The C++ server listens on `http://<host>:<port>` (default `0.0.0.0:8080`, capacity 100). The Express gateway mounts all routes under `/api`.

### C++ server endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health (`{status, service, timestamp}`) |
| GET | `/cache/:key` | Get a key. Hit → 200 `{key, value, hit:true}`. Miss → 404 `{key, value:null, hit:false}`. |
| PUT | `/cache/:key` | Insert/update `{value}`. Returns `{key, value, message:"ok"}`. |
| DELETE | `/cache/:key` | Remove a key. 200 if found, 404 if not. |
| GET | `/cache` | List all entries MRU→LRU `{count, entries:[{key,value,hit:true}]}`. |
| GET | `/stats` | Cache statistics `{capacity, size, hits, misses, hit_rate, miss_rate, evictions}`. |
| POST | `/clear` | Remove all entries `{message:"cache cleared"}`. |
| POST | `/resize` | Change capacity `{capacity: n}`. Evicts LRU when shrinking. Rejects `capacity <= 0`. |
| POST | `/stats/reset` | Reset hit/miss/eviction counters `{message:"stats reset"}`. |

### Express gateway endpoints (`/api/...`)

Same set of endpoints prefixed with `/api`, forwarded by `CacheService` via axios. Additional behavior:

- Missing/empty `key` → 400.
- PUT without `value` → 400.
- Invalid `capacity` on resize → 400.
- C++ server unreachable → 502 (never fakes success).

## Build & run

### Prerequisites

- C++: `cmake >= 3.15`, `g++`/`clang++` (C++20), Homebrew packages `cpp-httplib`, `nlohmann-json`, `googletest`, `google-benchmark` (installed in `/opt/homebrew`).
- Backend: Node.js >= 20, `npm`.

### 1. Build the C++ engine

```bash
cd cpp-engine
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
```

This produces:
- `build/cache_server` — HTTP cache server
- `build/cache_tests` — GoogleTest unit tests
- `build/cache_benchmark` — Google Benchmark benchmarks

### 2. Run C++ unit tests

```bash
cd cpp-engine/build
ctest --output-on-failure
```

Or run the test binary directly:

```bash
./cache_tests
```

### 3. Run C++ benchmarks

```bash
cd cpp-engine/build
./cache_benchmark
```

### 4. Start the C++ cache server

```bash
cd cpp-engine/build
./cache_server --host 0.0.0.0 --port 8080 --capacity 100
```

Environment variables: `CACHE_HOST`, `CACHE_PORT`, `CACHE_CAPACITY`.

### 5. Build and start the Express gateway

```bash
cd backend
npm install
npm run build          # compile TypeScript to dist/
npm start              # run node dist/server.js
```

Or in development mode:

```bash
cd backend
npm run dev            # ts-node src/server.ts
```

Gateway env vars:
- `PORT` (default 5000)
- `HOST` (default 0.0.0.0)
- `CACHE_SERVER_URL` (default `http://localhost:8080`)
- `CACHE_SERVER_TIMEOUT_MS` (default 5000)
- `CORS_ORIGIN` (default `*`)

### 6. Build and run the React frontend

```bash
cd frontend
npm install
npm run dev            # Vite dev server (port 5173)
```

Open `http://localhost:5173`. It proxies `/api` to the gateway at `http://localhost:5000`. Set `VITE_API_BASE_URL` to override.

For production:

```bash
cd frontend
npm run build          # output to dist/
npm run preview        # serve production build
```

### 7. Run backend tests

Integration tests spawn a real C++ server on port 8199 and exercise the gateway:

```bash
cd backend
npm test
```

## Example usage

```bash
# Start C++ server
./build/cache_server --port 8080 --capacity 3

# Put a key
curl -X PUT http://localhost:8080/cache/user:1 -H 'Content-Type: application/json' -d '{"value":"Ada"}'

# Get a key (hit -> MRU)
curl http://localhost:8080/cache/user:1

# Get a missing key (miss -> 404)
curl -i http://localhost:8080/cache/nonexistent

# List entries (MRU -> LRU)
curl http://localhost:8080/cache

# Stats
curl http://localhost:8080/stats

# Resize (evicts LRU when shrinking)
curl -X POST http://localhost:8080/resize -H 'Content-Type: application/json' -d '{"capacity":1}'

# Clear all
curl -X POST http://localhost:8080/clear

# Through the Express gateway (port 5000)
curl -X PUT http://localhost:5000/api/cache/user:1 -H 'Content-Type: application/json' -d '{"value":"Ada"}'
curl http://localhost:5000/api/cache/user:1
```

## Testing

### C++ unit tests (GoogleTest)

Cover: insert/retrieve, missing-key nullopt, update-no-duplicates, hit/miss counters, hit-rate zero, get-moves-to-MRU, LRU eviction when full, capacity-1, repeated operations, remove existing/missing, resize smaller/larger/zero, constructor zero-capacity, clear + reinsertion, resetStats keeps entries, stats capacity/size, contains does not change recency, concurrent puts/gets, no-duplicate-keys invariant.

Run: `cd cpp-engine/build && ctest --output-on-failure`

### Backend integration tests (Jest + supertest)

Spawn the real C++ server on port 8199 and test the Express gateway: health round-trip, PUT/GET round-trip, miss 404, validation 400, MRU→LRU listing, eviction on full, stats shape, resize + shrink, clear, stats reset, delete existing/missing, 502 when C++ server unavailable.

Run: `cd backend && npm test`

### C++ benchmarks (Google Benchmark)

`GetHit`, `GetMiss`, `PutInsert`, `PutUpdate`, `Mixed` at capacities 16/256/4096, reported in microseconds.

Run: `cd cpp-engine/build && ./cache_benchmark`

## Project status

- C++ LRU engine: complete, unit-tested, benchmarked, thread-safe.
- C++ HTTP server: complete, all REST endpoints implemented.
- Express gateway: complete, all routes forwarding to C++ server with validation and honest error reporting.
- Backend tests: passing (12/12 integration).
- Frontend: complete React dashboard with live stats, entry list (MRU→LRU), put/get/delete/resize/clear/reset-stats.
- End-to-end: C++ server → Express gateway → React dashboard verified.

## License

MIT
