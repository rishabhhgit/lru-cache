cmake_minimum_required(VERSION 3.15)
project(CacheLab LANGUAGES CXX)

# C++20 is required for std::optional, std::shared_lock, designated init, etc.
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

# Common warning flags for a production-quality build.
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    add_compile_options(-Wall -Wextra -Wpedantic -Wshadow -Wconversion -Wsign-conversion)
endif()

# Header-only dependencies (cpp-httplib, nlohmann/json) are expected as system
# headers, e.g. installed via Homebrew on macOS (/opt/homebrew/include).
include_directories(include)

# ---------------------------------------------------------------------------
# cachelab_core: the generic LRU cache engine (header-only library).
# ---------------------------------------------------------------------------
add_library(cachelab_core INTERFACE)
target_include_directories(cachelab_core INTERFACE include)

# Homebrew prefix (Apple Silicon) is not on the default compiler include path.
foreach(prefix /opt/homebrew /usr/local)
    if(EXISTS "${prefix}/include/httplib.h")
        target_include_directories(cachelab_core INTERFACE "${prefix}/include")
        break()
    endif()
endforeach()

# ---------------------------------------------------------------------------
# cache_server: lightweight HTTP front-end exposing the LRU cache over REST.
# ---------------------------------------------------------------------------
add_executable(cache_server src/cache_server.cpp)
target_link_libraries(cache_server PRIVATE cachelab_core)

# ---------------------------------------------------------------------------
# Unit tests with GoogleTest.
# ---------------------------------------------------------------------------
find_package(GTest REQUIRED)
add_executable(cache_tests tests/lru_cache_test.cpp)
target_link_libraries(cache_tests PRIVATE cachelab_core GTest::gtest_main GTest::gtest)
target_compile_definitions(cache_tests PRIVATE CACHELAB_TESTS)

# ---------------------------------------------------------------------------
# Performance benchmarks with Google Benchmark.
# ---------------------------------------------------------------------------
find_package(benchmark REQUIRED)
add_executable(cache_benchmark benchmarks/lru_cache_benchmark.cpp)
target_link_libraries(cache_benchmark PRIVATE cachelab_core benchmark::benchmark benchmark::benchmark_main)

# ---------------------------------------------------------------------------
# Convenience targets.
# ---------------------------------------------------------------------------
add_custom_target(run_tests
    COMMAND ${CMAKE_CTEST_COMMAND} --output-on-failure
    DEPENDS cache_tests
    WORKING_DIRECTORY ${CMAKE_BINARY_DIR}
    COMMENT "Running C++ test suite"
)

add_custom_target(run_benchmark
    COMMAND cache_benchmark
    DEPENDS cache_benchmark
    WORKING_DIRECTORY ${CMAKE_BINARY_DIR}
    COMMENT "Running cache benchmarks"
)

enable_testing()
add_test(NAME cachelab_unit_tests COMMAND cache_tests)
