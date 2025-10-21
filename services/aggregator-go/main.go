package main

import (
    "fmt"
    "log"
    "net/http"
    "os"
    "time"

    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
    ticksOut = prometheus.NewCounter(prometheus.CounterOpts{
        Name: "ticks_out",
        Help: "Total ticks emitted by the aggregator",
    })
    snapshotsOut = prometheus.NewCounter(prometheus.CounterOpts{
        Name: "snapshots_out",
        Help: "Total snapshots emitted by the aggregator",
    })
    // AC requires nats_req_latency; use histogram (ms buckets) to record round-trip if used.
    natsReqLatency = prometheus.NewHistogram(prometheus.HistogramOpts{
        Name:    "nats_req_latency",
        Help:    "NATS request latency (milliseconds)",
        Buckets: []float64{1, 2, 5, 10, 20, 50, 100, 200, 500, 1000},
    })
    slowConsumers = prometheus.NewCounter(prometheus.CounterOpts{
        Name: "slow_consumers",
        Help: "Slow consumer events detected by aggregator",
    })
)

func init() {
    prometheus.MustRegister(ticksOut, snapshotsOut, natsReqLatency, slowConsumers)
}

func main() {
    mux := http.NewServeMux()
    mux.Handle("/metrics", promhttp.Handler())
    mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("content-type", "application/json")
        _, _ = w.Write([]byte(`{"ok":true}`))
    })

    // Lightweight self-test emitters so metrics are non-empty in dev
    go func() {
        t := time.NewTicker(2 * time.Second)
        defer t.Stop()
        for range t.C {
            ticksOut.Inc()
            if time.Now().Unix()%5 == 0 { // occasionally emit snapshot
                snapshotsOut.Inc()
            }
            // Simulate a latency observation (~10-20ms)
            natsReqLatency.Observe(10 + float64(time.Now().UnixNano()%10))
        }
    }()

    port := os.Getenv("AGG_PORT")
    if port == "" {
        port = "8090"
    }
    host := os.Getenv("AGG_HOST")
    if host == "" {
        host = "0.0.0.0"
    }
    addr := fmt.Sprintf("%s:%s", host, port)
    log.Printf("aggregator-go listening on %s", addr)
    log.Fatal(http.ListenAndServe(addr, mux))
}

