package main

import (
    "io"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/prometheus/client_golang/prometheus/promhttp"
)

func TestHealthzEndpoint(t *testing.T) {
    mux := http.NewServeMux()
    mux.Handle("/metrics", promhttp.Handler())
    mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("content-type", "application/json")
        _, _ = w.Write([]byte(`{"ok":true}`))
    })
    srv := httptest.NewServer(mux)
    defer srv.Close()

    resp, err := http.Get(srv.URL + "/healthz")
    if err != nil {
        t.Fatalf("GET /healthz error: %v", err)
    }
    defer resp.Body.Close()
    if resp.StatusCode != 200 {
        t.Fatalf("/healthz status = %d", resp.StatusCode)
    }
    b, _ := io.ReadAll(resp.Body)
    if string(b) != "{\"ok\":true}" {
        t.Fatalf("unexpected body: %s", string(b))
    }
}

