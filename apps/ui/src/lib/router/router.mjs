// Simple client-side hash router for SPA navigation

export class Router {
  constructor() {
    this.routes = new Map()
    this.currentRoute = null
    this.rootElement = null
  }

  register(path, component) {
    this.routes.set(path, component)
    return this
  }

  init(rootElement) {
    this.rootElement = rootElement

    // Handle initial route and route changes
    window.addEventListener('hashchange', () => this.handleRouteChange())
    this.handleRouteChange()
  }

  handleRouteChange() {
    const hash = window.location.hash.slice(1) || '/'
    const route = this.routes.get(hash)

    if (!route) {
      console.warn(`Route not found: ${hash}`)
      return
    }

    // Cleanup previous route
    if (this.currentRoute?.destroy) {
      this.currentRoute.destroy()
    }

    // Clear the root element
    this.rootElement.innerHTML = ''

    // Initialize new route
    if (typeof route === 'function') {
      this.currentRoute = route(this.rootElement)
    } else if (route?.init) {
      this.currentRoute = route
      route.init(this.rootElement)
    }
  }

  navigate(path) {
    window.location.hash = `#${path}`
  }
}

export default Router
