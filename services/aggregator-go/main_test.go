package main

import (
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/prometheus/client_golang/prometheus/promhttp"
)

func TestMetricsEndpoint(t *testing.T) {
    // Use the same handler wiring
    h := promhttp.Handler()
    req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
    w := httptest.NewRecorder()
    h.ServeHTTP(w, req)
    if w.Code != 200 {
        t.Fatalf("/metrics status = %d", w.Code)
    }
    body := w.Body.String()
    for _, name := range []string{"ticks_out", "snapshots_out", "nats_req_latency", "slow_consumers"} {
        if !contains(body, name) {
            t.Fatalf("expected metric %s in output", name)
        }
    }
}

func contains(s, sub string) bool { return len(s) >= len(sub) && (func() bool { return http.CanonicalHeaderKey(sub) != "" && (stringIndex(s, sub) >= 0) })() }

func stringIndex(s, sub string) int {
    for i := 0; i+len(sub) <= len(s); i++ {
        if s[i:i+len(sub)] == sub {
            return i
        }
    }
    return -1
}

