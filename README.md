# CacheLab — Production-Grade LRU Cache & Interactive Visualizer

CacheLab is a full-stack, high-performance Least Recently Used (LRU) cache system and interactive computer science visualizer. It couples a sub-microsecond **C++20** engine with a **Node.js + Express** REST gateway and a modern **React + TypeScript** developer dashboard and educational platform.

---

## Architecture Overview

<<<<<<< HEAD
## How the LRU cache is implemented
=======
```
┌────────────────────────────────────────────────────────┐
│             React + TypeScript Dashboard               │
│   (Live Doubly Linked List Visualizer, Playground,     │
│       History, Analytics, "Learn LRU" Walkthrough)     │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP (Port 5173 / Proxy)
                            ▼
┌────────────────────────────────────────────────────────┐
│          Express + TypeScript API Gateway              │
│       (Validation, Routing, Envelopes, Metrics)        │
│                      [Port 5001]                       │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP REST Client
                            ▼
┌────────────────────────────────────────────────────────┐
│             C++20 LRU Cache HTTP Server                │
│       (cpp-httplib, nlohmann-json, Thread-Safe)        │
│                      [Port 8080]                       │
└───────────────────────────┬────────────────────────────┘
                            │ In-Memory Pointer Operations
                            ▼
┌────────────────────────────────────────────────────────┐
│               Core LRU Data Structures                 │
│  std::unordered_map<K, list::iterator>  [O(1) Lookup]   │
│  std::list<std::pair<const K, V>>       [O(1) Splice]  │
│  std::shared_mutex                      [RW Concurrency│
└────────────────────────────────────────────────────────┘
```

### Technology Responsibilities

- **C++20 Core Engine (`cpp-engine/`)**: Header-only `LRUCache<K, V>` implementing the true LRU eviction algorithm in average $O(1)$ time complexity for `get`, `put`, `remove`, and eviction. Served via `cpp-httplib` with fine-grained reader-writer locking (`std::shared_mutex`).
- **Node.js & Express Gateway (`backend/`)**: API gateway handling schema validation, security headers (`helmet`), CORS, error translation, and honest reporting (never faking cache hits or masking engine downtime with mock state). Default port is **5001** to avoid conflicts with macOS ControlCenter/AirPlay on port 5000.
- **React + TypeScript Dashboard (`frontend/`)**: Dark-theme developer dashboard featuring live doubly linked list visualizers, an operation playground, an in-memory session audit trail, analytics, policy comparisons, and an interactive 7-step guided tutorial for beginners.

---

## How the LRU Cache Works

### Core Concept

An **LRU (Least Recently Used)** cache stores a fixed number of items in fast memory. When the cache is full and a new item must be inserted, the cache evicts the item that has not been accessed for the longest time.

```
NULL ⟵ [Head / LRU (Oldest)] ⇄ [Node 2] ⇄ ... ⇄ [Tail / MRU (Newest)] ⟶ NULL
           ▲                                           │
           │           When capacity is full:          │
           └────────── Evicted on insertion ───────────┘
```

### Why Two Data Structures are Required

1. **Hash Map (`std::unordered_map<K, list::iterator>`)**: Provides average $O(1)$ key lookup. However, a hash map has no sense of chronological order and cannot determine the oldest element without an $O(n)$ scan.
2. **Doubly Linked List (`std::list<std::pair<const K, V>>`)**: Maintains strict recency order. Popping the oldest item (head) or appending the newest item (tail) takes $O(1)$. However, searching for a key in a linked list requires an $O(n)$ traversal.

**The Solution:** The hash map stores pointers directly to the doubly linked list nodes. When a key is accessed (`GET`), the node is located in $O(1)$ time and moved to the MRU position using `std::list::splice()` in $O(1)$ time without invalidating pointers or moving memory.

### Complexity Guarantees

| Operation | Time Complexity | Notes |
| :--- | :--- | :--- |
| **GET(key)** | **$O(1)$ avg** | Locates node via hash map, splices to MRU position, increments hits. |
| **PUT(key, value)** | **$O(1)$ avg** | Updates in-place or evicts LRU (if full) and inserts at MRU. |
| **DELETE(key)** | **$O(1)$ avg** | Erases node from list and map in $O(1)$ without shifting elements. |
| **LRU Eviction** | **$O(1)$** | Pops head/tail node and erases its map entry. |
| **List Traversal** | **$O(n)$** | Reads entries in recency order without mutating cache state. |
| **Space** | **$O(\text{Capacity})$** | Maximum memory allocated is proportional to capacity. |

---

## Repository Layout

```
LRU CACHE/
├── cpp-engine/                       # C++20 core engine
│   ├── include/
│   │   └── lru_cache.hpp             # Generic LRUCache<K, V> template implementation
│   ├── src/
│   │   └── cache_server.cpp          # High-performance HTTP REST server
│   ├── tests/
│   │   └── lru_cache_test.cpp        # GoogleTest unit test suite (26 tests)
│   ├── benchmarks/
│   │   └── lru_cache_benchmark.cpp   # Google Benchmark performance suite (15 benchmarks)
│   └── CMakeLists.txt                # Build configuration
│
├── backend/                          # Express + TypeScript API gateway
│   ├── src/
│   │   ├── app.ts                    # Express app factory (routing, CORS, helmet)
│   │   ├── server.ts                 # Server entrypoint (default port 5001)
│   │   ├── routes/cache.ts           # REST API endpoints
│   │   ├── services/cacheService.ts  # Axios client forwarding to C++ server
│   │   └── middleware/               # Error handling and structured request logging
│   ├── tests/
│   │   ├── gateway.unit.test.ts      # Gateway unit test suite (15 tests)
│   │   └── cache.integration.test.ts# Integration tests against live C++ server
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                         # React + TypeScript Vite dashboard
│   ├── src/
│   │   ├── App.tsx                   # Master dashboard & state manager
│   │   ├── index.css                 # Dark developer theme stylesheet
│   │   ├── api/cache.ts              # Gateway HTTP client with envelope unwrapping
│   │   ├── types/cache.ts            # TypeScript interface definitions
│   │   └── components/
│   │       ├── Header.tsx            # Header, capacity selector, status pill, tabs
│   │       ├── StatsCards.tsx        # Live hit/miss/eviction metric cards
│   │       ├── CacheVisualizer.tsx   # Interactive Doubly Linked List & Hash Map viewer
│   │       ├── Playground.tsx        # Live GET, PUT, and DELETE testing panel
│   │       ├── EntriesTable.tsx      # Recency table with filter and quick actions
│   │       ├── OperationHistory.tsx  # In-memory session audit trail
│   │       ├── AnalyticsPanel.tsx    # Hit ratio visualizer and policy comparison
│   │       ├── LearnMode.tsx         # 7-step guided interactive simulation
│   │       └── CppCodeViewer.tsx     # C++ code inspector with annotations
│   ├── vite.config.ts                # Vite proxy config (port 5173 -> 5001)
│   └── package.json
│
└── README.md                         # Project documentation
```

---
>>>>>>> 1b4513b (made some changes)

## Getting Started

### Prerequisites

- **C++ Compiler**: GCC $\ge 11$ or Clang $\ge 13$ supporting C++20.
- **CMake**: Version $\ge 3.15$.
- **Homebrew Packages (macOS)**:
  ```bash
  brew install cmake cpp-httplib nlohmann-json googletest google-benchmark
  ```
- **Node.js**: Version $\ge 20.0.0$ and `npm`.

---

### Step 1: Build the C++ Engine

```bash
cd cpp-engine
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
```

This compiles:
- `build/cache_server` — HTTP cache server binary.
- `build/cache_tests` — GoogleTest test binary.
- `build/cache_benchmark` — Google Benchmark performance test binary.

---

### Step 2: Run C++ Unit Tests & Benchmarks

Run the GoogleTest test suite:
```bash
cd cpp-engine/build
./cache_tests
```
*(All 26 tests pass, verifying recency preservation, eviction metadata, capacity-1 edge cases, thread concurrency, and invariants).*

Run the micro-benchmarks:
```bash
./cache_benchmark
```
*Measured performance on Apple Silicon:*
- **GET Hit**: `~0.040 µs` (40 ns, ~25M ops/sec)
- **GET Miss**: `~0.018 µs` (18 ns, ~55M ops/sec)
- **PUT Insert**: `~0.120 µs` (120 ns, ~8M ops/sec)
- **PUT Update**: `~0.060 µs` (60 ns, ~16M ops/sec)
- **Mixed Ops**: `~0.050 µs` (50 ns, ~20M ops/sec)

---

### Step 3: Start the C++ Server

```bash
cd cpp-engine/build
./cache_server --host 0.0.0.0 --port 8080 --capacity 10
```

---

### Step 4: Install & Start the Backend Gateway

In a new terminal window:
```bash
cd backend
npm install
npm run build
npm start
```
*The Express gateway starts on `http://localhost:5001` and forwards requests to `http://localhost:8080`.*

To run the backend test suites:
```bash
npm test
```
*(Runs both `gateway.unit.test.ts` and `cache.integration.test.ts` — 27 tests passing).*

---

### Step 5: Start the Frontend Dashboard

In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
*Open your browser at `http://localhost:5173` to interact with **CacheLab**.*

---

## API Reference

All gateway routes are mounted under `/api` and return standardized envelopes:
`{ "success": true, "data": { ... } }`

### 1. Health Check
- **`GET /api/health`**
- **Response `200`**:
  ```json
  {
    "success": true,
    "service": "cachelab-gateway",
    "cppServer": "ok"
  }
  ```

### 2. Get Cache Entry
- **`GET /api/cache/:key`**
- **Response `200` (Hit)**:
  ```json
  {
    "success": true,
    "data": { "key": "user:1", "value": "Ada Lovelace", "hit": true },
    "key": "user:1"
  }
  ```
- **Response `404` (Miss)**:
  ```json
  {
    "success": true,
    "data": { "key": "missing_key", "value": null, "hit": false },
    "key": "missing_key"
  }
  ```

### 3. Insert or Update Entry
- **`POST /api/cache`** or **`PUT /api/cache/:key`**
- **Request Body**:
  ```json
  { "key": "user:101", "value": "Grace Hopper" }
  ```
- **Response `200`**:
  ```json
  {
    "success": true,
    "data": {
      "key": "user:101",
      "value": "Grace Hopper",
      "inserted": true,
      "updated": false,
      "evicted": true,
      "evicted_entry": { "key": "user:99", "value": "Old Data" },
      "message": "ok"
    },
    "key": "user:101"
  }
  ```

### 4. Delete Single Entry
- **`DELETE /api/cache/:key`**
- **Response `200`**:
  ```json
  {
    "success": true,
    "data": { "key": "user:101", "value": "Grace Hopper", "message": "deleted" },
    "key": "user:101"
  }
  ```

### 5. Clear Entire Cache
- **`DELETE /api/cache`** or **`POST /api/cache/clear`**
- **Response `200`**:
  ```json
  {
    "success": true,
    "data": { "message": "cache cleared" }
  }
  ```

### 6. List All Entries (Recency Order)
- **`GET /api/cache`**
- **Response `200`**:
  ```json
  {
    "success": true,
    "data": {
      "count": 2,
      "entries": [
        { "key": "user:102", "value": "Alan Turing", "is_mru": true, "is_lru": false },
        { "key": "user:101", "value": "Grace Hopper", "is_mru": false, "is_lru": true }
      ],
      "lru_to_mru": [
        { "key": "user:101", "value": "Grace Hopper", "is_lru": true, "is_mru": false },
        { "key": "user:102", "value": "Alan Turing", "is_lru": false, "is_mru": true }
      ],
      "oldest_lru": { "key": "user:101", "value": "Grace Hopper" },
      "newest_mru": { "key": "user:102", "value": "Alan Turing" }
    }
  }
  ```

### 7. Get Cache Statistics
- **`GET /api/stats`**
- **Response `200`**:
  ```json
  {
    "success": true,
    "data": {
      "capacity": 10,
      "size": 2,
      "hits": 14,
      "misses": 3,
      "hit_rate": 82.35,
      "miss_rate": 17.65,
      "evictions": 5
    }
  }
  ```

### 8. Resize Cache Capacity
- **`POST /api/cache/resize`**
- **Request Body**: `{ "capacity": 5 }`
- **Response `200`**:
  ```json
  {
    "success": true,
    "data": { "message": "resized", "capacity": 5 }
  }
  ```

### 9. Reset Statistics
- **`POST /api/stats/reset`**
- **Response `200`**:
  ```json
  {
    "success": true,
    "data": { "message": "stats reset" }
  }
  ```

---

## Features & Highlights

### 1. Interactive Doubly Linked List Visualizer
- Visualizes actual nodes in memory: `[NULL] ⟵ [LRU Node] ⇄ [Node] ⇄ ... ⇄ [MRU Node] ⟶ [NULL]`.
- Identifies the **MRU (Newest)** and **LRU (Eviction Target)** nodes dynamically.
- Live animations for cache hits (green flash), updates (amber pulse), insertions (slide in), and evictions (ghost card fade-out).
- Interactive **Hash Map Bucket Overlay** showing how `std::unordered_map` maps keys directly to memory node iterators.

### 2. Operation Playground
- Dedicated testbed for `GET`, `PUT`, `DELETE`, `CLEAR`, and `RESIZE`.
- Rich explanation banners stating exactly what the cache did (e.g. why an item moved, which item was evicted, or why recency was untouched on a miss).

### 3. Session Audit Trail (History)
- Real-time audit log of every request performed during the session.
- Records timestamp, operation type, target key, outcome, response latency in milliseconds, and cache size.

### 4. "Learn LRU" Educational Simulator
- Beginner-friendly, 7-step guided interactive walkthrough.
- Demonstrates how cache fills up (`A=10`, `B=20`, `C=30`), how a lookup promotes `A` to MRU, and why inserting `D=40` evicts `B` instead of `A`.
- Features Step Next, Step Prev, Auto-Play (timer-based playback), Pause, and Restart controls.
- Runs in an isolated simulation state to prevent mutating the user's active session.

### 5. C++ Core Engine Inspector
- In-app code viewer displaying the actual `LRUCache<K, V>` template implementation with syntax highlighting and line-by-line annotations.

---

## Troubleshooting & FAQ

1. **Port 5000 Already in Use on macOS?**
   - On macOS Monterey and later, Apple's AirPlay Receiver binds to port 5000 (`ControlCenter`). CacheLab avoids this by configuring the Express gateway to port **5001** by default.
2. **C++ Server Not Healthy / 502 Bad Gateway?**
   - Ensure `build/cache_server` is running on port 8080 before starting the gateway (`./cache_server --port 8080 --capacity 10`).
3. **Running in Docker or Headless Environments?**
   - You can pass environment variables `CACHE_HOST`, `CACHE_PORT`, `CACHE_CAPACITY` to `cache_server`, and `PORT`, `CACHE_SERVER_URL` to the Express backend.

---

## License

<<<<<<< HEAD
MIT
=======
MIT License. Designed and engineered for high performance and computer science education.
>>>>>>> 1b4513b (made some changes)
