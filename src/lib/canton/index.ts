import { MockCantonAdapter } from './mock-adapter'
import { DevNetCantonAdapter } from './devnet-adapter'
import type { CantonAdapter } from './types'

let adapter: CantonAdapter | null = null

export function getCantonAdapter(): CantonAdapter {
  if (!adapter) {
    const env = process.env.CANTON_NETWORK_ENV ?? 'mock'
    if (env === 'localnet' || env === 'devnet' || env === 'mainnet') {
      adapter = new DevNetCantonAdapter()
    } else {
      adapter = new MockCantonAdapter()
    }
  }
  return adapter
}

// Force a fresh adapter instance (useful after env changes or in tests)
export function resetCantonAdapter(): void {
  adapter = null
}
