// Mock server for /metrics.json endpoint
// Provides JSON formatted metrics for UI consumption

import http from 'http'

const metricsData = {
  // End-to-end latency percentiles (milliseconds)
  latency_p50: 45,
  latency_p95: 110,
  latency_p99: 175,

  // Slow consumer count
  slow_consumers: 0,

  // Connection stats
  ws_active: 1,

  // Throughput metrics
  ticks_out: 1250,
  snapshots_out: 15,

  // Reconnects and subscription storms (counters)
  xy_nats_reconnects_total: 0,
  xy_sub_storms_total: 0,

  // Bandwidth (bytes/sec)
  bandwidth: 8500,

  // Timestamp
  timestamp: Date.now()
}

// Create a simple server that serves metrics
const server = http.createServer((req, res) => {
  // Enable CORS for local development
  const allowOrigin = process.env.METRICS_CORS_ORIGIN || '*'
  res.setHeader('Access-Control-Allow-Origin', allowOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.url === '/metrics.json' || req.url === '/metrics') {
    // Update metrics with some variation
    const groups = ['xy.md.1','xy.md.2','xy.md.3']
    const latency_p95_by_group = Object.fromEntries(groups.map(g => [g, 90 + Math.random()*80]))
    const slow_consumers_by_group = Object.fromEntries(groups.map(g => [g, Math.random() > 0.7 ? Math.floor(Math.random()*3) : 0]))

    const metrics = {
      ...metricsData,
      latency_p50: 40 + Math.random() * 20,
      latency_p95: 100 + Math.random() * 30,
      latency_p99: 160 + Math.random() * 40,
      slow_consumers: Math.random() > 0.8 ? Math.floor(Math.random() * 3) : 0,
      ticks_out: metricsData.ticks_out + Math.floor(Math.random() * 100),
      bandwidth: 7000 + Math.random() * 3000,
      xy_nats_reconnects_total: metricsData.xy_nats_reconnects_total + (Math.random() > 0.9 ? 1 : 0),
      xy_sub_storms_total: metricsData.xy_sub_storms_total + (Math.random() > 0.95 ? 1 : 0),
      latency_p95_by_group,
      slow_consumers_by_group,
      timestamp: Date.now()
    }

    res.setHeader('Content-Type', 'application/json')
    res.writeHead(200)
    res.end(JSON.stringify(metrics, null, 2))
  } else if (req.url === '/healthz') {
    res.setHeader('Content-Type', 'application/json')
    res.writeHead(200)
    res.end(JSON.stringify({ ok: true }))
  } else {
    res.writeHead(404)
    res.end('Not Found')
  }
})

const PORT = process.env.METRICS_PORT || 8081
server.listen(PORT, () => {
  console.log(`Metrics mock server running at http://localhost:${PORT}`)
  console.log(`  - GET /metrics.json - JSON formatted metrics`)
  console.log(`  - GET /healthz - Health check`)
})
