# ──────────────────────────────────────────────
# Stage 1: Build
# ──────────────────────────────────────────────
FROM debian:bookworm-slim AS builder

# cpp-httplib and nlohmann/json are header-only; install system packages
# or fall back to downloading the single-file headers directly.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libssl-dev \
    nlohmann-json3-dev \
    wget \
    && apt-get install -y --no-install-recommends libcpphttplib-dev 2>/dev/null || true \
    && rm -rf /var/lib/apt/lists/*

# If cpp-httplib wasn't available as a package, grab the single-file header.
RUN if ! dpkg -l libcpphttplib-dev 2>/dev/null | grep -q '^ii'; then \
    wget -q -O /usr/local/include/httplib.h \
        https://raw.githubusercontent.com/yhirose/cpp-httplib/master/httplib.h; \
    fi

WORKDIR /app
COPY . .

RUN cmake -B build \
    -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build --target cache_server -j$(nproc)

# ──────────────────────────────────────────────
# Stage 2: Runtime (minimal image)
# ──────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/build/cache_server ./cache_server

# Default port (override with $PORT at runtime for Railway/Fly/Render)
EXPOSE 8080

# Reads $PORT so Railway/Fly can inject their port automatically
CMD ["/bin/sh", "-c", "./cache_server --host 0.0.0.0 --port ${PORT:-8080}"]
