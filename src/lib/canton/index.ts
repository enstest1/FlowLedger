import { MockCantonAdapter } from './mock-adapter'
import { DevNetCantonAdapter } from './devnet-adapter'
import { MainNetCantonAdapter } from './mainnet-adapter'
import type { CantonAdapter } from './types'

let adapter: CantonAdapter | null = null

export function getCantonAdapter(): CantonAdapter {
  if (!adapter) {
    const env = process.env.CANTON_NETWORK_ENV ?? 'mock'
    switch (env) {
      case 'mainnet':
        adapter = new MainNetCantonAdapter()
        // Featured app check: verifies FeaturedAppRight exists on MainNet.
        // Runs in background — does not block startup or any request.
        void (adapter as MainNetCantonAdapter).checkFeaturedAppStatus()
        break
      case 'testnet':
      case 'devnet':
      case 'localnet':
        adapter = new DevNetCantonAdapter()
        break
      default:
        adapter = new MockCantonAdapter()
    }
  }
  return adapter
}

// Force a fresh adapter instance (useful after env changes or in tests)
export function resetCantonAdapter(): void {
  adapter = null
}

// Re-export for convenience — callers can import runStartupChecks from '@/lib/canton'
export { runStartupChecks } from './startup-check'
