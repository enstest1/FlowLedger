'use client'

// Canton wallet browser integration via @canton-network/dapp-sdk (CIP-103).
//
// The dApp SDK injects window.canton when a compatible Canton wallet is active.
// Compatible wallets:
//   - Canton wallet running via cn-quickstart (LocalNet) — exposes window.canton via postMessage
//   - Future: browser extension (wallet-gateway-extension — not yet released as of April 2026)
//
// Without a running Canton wallet, isCantonWalletInstalled() returns false and
// the manual party ID entry fallback is shown. This is correct behaviour.

export interface CantonWalletInfo {
  partyId: string
  publicKey?: string
}

// CIP-103 provider interface injected as window.canton by the dApp SDK
interface CIP103Provider {
  request<T>(args: { method: string; params?: unknown }): Promise<T>
  on<T>(event: string, listener: (data: T) => void): CIP103Provider
  removeListener<T>(event: string, listener: (data: T) => void): CIP103Provider
}

interface AccountInfo {
  partyId: string
  publicKey?: string
}

declare global {
  interface Window {
    canton?: CIP103Provider
  }
}

export function isCantonWalletInstalled(): boolean {
  return typeof window !== 'undefined' && typeof window.canton !== 'undefined'
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ])
}

export async function connectCantonWallet(): Promise<CantonWalletInfo> {
  if (!isCantonWalletInstalled()) {
    throw new Error('Canton wallet not detected')
  }

  // CIP-103: connect and get primary account.
  // 8-second timeout guards against non-Canton wallets (e.g. Nightly) that inject
  // window.canton but never resolve CIP-103 requests.
  await withTimeout(
    window.canton!.request({ method: 'connect' }),
    8000,
    'Canton wallet connect'
  )
  const account = await withTimeout(
    window.canton!.request<AccountInfo>({ method: 'getPrimaryAccount' }),
    8000,
    'Canton getPrimaryAccount'
  )

  return {
    partyId: account.partyId,
    publicKey: account.publicKey,
  }
}

export async function signChallengeWithWallet(nonce: string): Promise<string> {
  if (!isCantonWalletInstalled()) {
    throw new Error('Canton wallet not detected')
  }

  // CIP-103: sign an arbitrary message with the party key
  const result = await window.canton!.request<{ signature: string }>({
    method: 'signMessage',
    params: { message: `FlowLedger auth: ${nonce}` },
  })

  return result.signature
}

export function onWalletAccountChanged(callback: (info: CantonWalletInfo | null) => void): () => void {
  if (!isCantonWalletInstalled()) return () => {}

  const handler = (accounts: AccountInfo[]) => {
    callback(accounts[0] ?? null)
  }

  window.canton!.on('accountsChanged', handler)
  return () => window.canton!.removeListener('accountsChanged', handler)
}

// Canton party ID format: hint::hexfingerprint (64+ lowercase hex chars)
export function validatePartyIdFormat(partyId: string): boolean {
  return /^[a-zA-Z0-9_-]+::[a-f0-9]{64,}$/.test(partyId)
}
