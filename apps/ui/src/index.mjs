// Main entry point for the xiaoy UI application
import { Router } from './lib/router/router.mjs'
import { attachMetricsOverlay } from './overlay/metrics-overlay.mjs'
import { MinimalPanel } from './pages/dashboard/MinimalPanel.mjs'
import { minimalPanelStore } from './stores/minimalPanelStore.mjs'
import { createFpsMeter } from './lib/metrics/metrics.mjs'

// Initialize global FPS meter
const fpsMeter = createFpsMeter()
fpsMeter.start()
window.fpsMeter = fpsMeter

// Initialize router
const router = new Router()

// Register routes
router.register('/dashboard', MinimalPanel)
router.register('/', () => {
  // Default redirect to dashboard
  window.location.hash = '#/dashboard'
})

// Initialize metrics overlay (conditionally based on debug mode)
const metricsUnsubscribe = attachMetricsOverlay({
  enabled: true // Will check debug flag internally
})

// Start the application
function initApp() {
  const rootElement = document.getElementById('app')
  if (!rootElement) {
    console.error('Root element #app not found')
    return
  }

  // Initialize stores
  minimalPanelStore.init()

  // Start routing
  router.init(rootElement)

  // Navigate to default route if no hash
  if (!window.location.hash) {
    window.location.hash = '#/dashboard'
  }

  console.log('xiaoy UI initialized')
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp)
} else {
  initApp()
}

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  metricsUnsubscribe?.()
  fpsMeter.stop()
  minimalPanelStore.destroy()
})