// Local ambient types for monorepo-only type reference.
// In CI, ws-gateway is installed standalone via npm and cannot resolve
// the workspace package `@xiaoy/ts-contracts`. We declare a minimal
// module shape so `tsc --noEmit` succeeds.

declare module '@xiaoy/ts-contracts' {
  export type Tick = {
    ts_ms: number
    symbol: string
    price: number
    volume?: number
  }
}

