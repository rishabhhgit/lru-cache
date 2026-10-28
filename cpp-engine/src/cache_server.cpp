#include "lru_cache.hpp"

#include <chrono>
#include <csignal>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <shared_mutex>
#include <string>
#include <thread>

#include <httplib.h>
#include <nlohmann/json.hpp>

using json = nlohmann::json;
using Cache = cachelab::LRUCache<std::string, std::string>;

static std::unique_ptr<Cache> g_cache;

static void send_json(httplib::Response& res, int status, const json& body) {
    res.set_content(body.dump(), "application/json");
    res.status = status;
}

static void send_error(httplib::Response& res, int status, const std::string& message) {
    json err;
    err["error"] = message;
    send_json(res, status, err);
}

static bool parse_positive_int(const json& body, const char* field, std::size_t& out) {
    if (!body.contains(field) || !body[field].is_number_integer()) {
        return false;
    }
    long long v = body[field].get<long long>();
    if (v <= 0) return false;
    out = static_cast<std::size_t>(v);
    return true;
}

static volatile std::sig_atomic_t g_running = 1;

static void handle_signal(int /*sig*/) {
    g_running = 0;
}

int main(int argc, char* argv[]) {
    std::string host = "0.0.0.0";
    int port = 8080;
    std::size_t capacity = 100;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--host" && i + 1 < argc) {
            host = argv[++i];
        } else if (arg == "--port" && i + 1 < argc) {
            port = std::atoi(argv[++i]);
        } else if (arg == "--capacity" && i + 1 < argc) {
            capacity = static_cast<std::size_t>(std::atoll(argv[++i]));
        } else if (arg == "--help" || arg == "-h") {
            std::cout << "Usage: cache_server [--host HOST] [--port PORT] [--capacity N]\n";
            return 0;
        }
    }
    if (const char* env_host = std::getenv("CACHE_HOST")) host = env_host;
    if (const char* env_port = std::getenv("CACHE_PORT")) port = std::atoi(env_port);
    if (const char* env_cap = std::getenv("CACHE_CAPACITY")) capacity = static_cast<std::size_t>(std::atoll(env_cap));

    try {
        g_cache = std::make_unique<Cache>(capacity);
    } catch (const std::exception& e) {
        std::cerr << "Failed to create cache (capacity=" << capacity << "): " << e.what() << "\n";
        return 1;
    }

    httplib::Server svr;

    svr.Get("/health", [](const httplib::Request&, httplib::Response& res) {
        json body;
        body["status"] = "ok";
        body["service"] = "cachelab-cpp-server";
        body["timestamp"] =
            std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::system_clock::now().time_since_epoch())
                .count();
        send_json(res, 200, body);
    });

    svr.Get("/cache/(.*)", [](const httplib::Request& req, httplib::Response& res) {
        std::string key = req.matches[1];
        if (key.empty()) {
            send_error(res, 400, "key is required");
            return;
        }
        auto val = g_cache->get(key);
        if (val.has_value()) {
            json body;
            body["key"] = key;
            body["value"] = val.value();
            body["hit"] = true;
            send_json(res, 200, body);
        } else {
            json body;
            body["key"] = key;
            body["value"] = nullptr;
            body["hit"] = false;
            send_json(res, 404, body);
        }
    });

    svr.Put("/cache/(.*)", [](const httplib::Request& req, httplib::Response& res) {
        std::string key = req.matches[1];
        if (key.empty()) {
            send_error(res, 400, "key is required");
            return;
        }
        json body;
        try {
            body = json::parse(req.body);
        } catch (...) {
            send_error(res, 400, "invalid JSON in request body");
            return;
        }
        if (!body.contains("value")) {
            send_error(res, 400, "missing 'value' field in request body");
            return;
        }
        std::string value = body["value"].is_string()
                                ? body["value"].get<std::string>()
                                : body["value"].dump();
        try {
            g_cache->put(key, value);
        } catch (const std::exception& e) {
            send_error(res, 500, e.what());
            return;
        }
        json resp;
        resp["key"] = key;
        resp["value"] = value;
        resp["message"] = "ok";
        send_json(res, 200, resp);
    });

    svr.Delete("/cache/(.*)", [](const httplib::Request& req, httplib::Response& res) {
        std::string key = req.matches[1];
        if (key.empty()) {
            send_error(res, 400, "key is required");
            return;
        }
        bool removed = g_cache->remove(key);
        if (removed) {
            json resp;
            resp["key"] = key;
            resp["message"] = "deleted";
            send_json(res, 200, resp);
        } else {
            send_error(res, 404, "key not found");
        }
    });

    svr.Get("/cache", [](const httplib::Request&, httplib::Response& res) {
        // Use getEntries() (read-only) so listing the cache does not promote
        // every entry to MRU and corrupt the observed recency order.
        auto entries = g_cache->getEntries();
        json entries_json = json::array();
        for (const auto& [key, value] : entries) {
            json entry;
            entry["key"] = key;
            entry["value"] = value; // raw stored string; clients parse JSON as needed
            entry["hit"] = true;
            entries_json.push_back(entry);
        }
        json body;
        body["count"] = static_cast<int>(entries_json.size());
        body["entries"] = entries_json;
        send_json(res, 200, body);
    });

    svr.Get("/stats", [](const httplib::Request&, httplib::Response& res) {
        auto stats = g_cache->getStats();
        json body;
        body["capacity"] = static_cast<double>(stats.capacity);
        body["size"] = static_cast<double>(stats.size);
        body["hits"] = static_cast<double>(stats.hits);
        body["misses"] = static_cast<double>(stats.misses);
        body["hit_rate"] = stats.hit_rate;
        body["miss_rate"] = stats.miss_rate;
        body["evictions"] = static_cast<double>(stats.evictions);
        send_json(res, 200, body);
    });

    svr.Post("/clear", [](const httplib::Request&, httplib::Response& res) {
        g_cache->clear();
        json resp;
        resp["message"] = "cache cleared";
        send_json(res, 200, resp);
    });

    svr.Post("/resize", [](const httplib::Request& req, httplib::Response& res) {
        json body;
        try {
            body = json::parse(req.body);
        } catch (...) {
            send_error(res, 400, "invalid JSON in request body");
            return;
        }
        std::size_t new_capacity = 0;
        if (!parse_positive_int(body, "capacity", new_capacity)) {
            send_error(res, 400, "missing or invalid 'capacity' (must be a positive integer)");
            return;
        }
        try {
            g_cache->resize(new_capacity);
        } catch (const std::exception& e) {
            send_error(res, 400, e.what());
            return;
        }
        json resp;
        resp["message"] = "resized";
        resp["capacity"] = static_cast<double>(new_capacity);
        send_json(res, 200, resp);
    });

    svr.Post("/stats/reset", [](const httplib::Request&, httplib::Response& res) {
        g_cache->resetStats();
        json resp;
        resp["message"] = "stats reset";
        send_json(res, 200, resp);
    });

    std::signal(SIGINT, handle_signal);
    std::signal(SIGTERM, handle_signal);

    std::cout << "CacheLab C++ server listening on " << host << ":" << port
              << " (capacity=" << capacity << ")\n";

    std::thread server_thread([&]() {
        svr.listen(host, port);
    });

    // Give the listen thread a moment to bind; report early bind failures
    // (e.g. port already in use) instead of hanging.
    for (int i = 0; i < 100 && g_running && !svr.is_running(); ++i) {
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
    }
    if (!svr.is_running()) {
        std::cerr << "Failed to bind to " << host << ":" << port << "\n";
        svr.stop();
        server_thread.join();
        return 1;
    }

    while (g_running && svr.is_running()) {
        std::this_thread::sleep_for(std::chrono::milliseconds(200));
    }

    svr.stop();
    server_thread.join();
    std::cout << "CacheLab C++ server shut down.\n";
    return 0;
}

