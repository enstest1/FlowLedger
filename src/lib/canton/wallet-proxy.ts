// WalletProxyManager — wraps WalletUserProxy template from splice-util-featured-app-proxies.
//
// On MainNet: setupWalletProxy and executeProxiedTransfer ensure every payment
// automatically creates a FeaturedAppActivityMarker for the FlowLedger provider party.
// On DevNet/mock: methods succeed but activityMarkerContractId will be undefined.
//
// The proxy layer is entirely non-blocking. If any proxy call fails, we fall back
// to direct transfers. A proxy failure never blocks a payment.

import { getCantonToken } from './canton-auth'

export interface ProxiedTransferInput {
  senderPartyId: string
  receiverPartyId: string
  amount: number
  assetId: string
  invoiceId: string
  batchId: string
}

export interface ProxiedTransferResult {
  updateId: string
  transferObjectJson: string
  activityMarkerContractId?: string
  status: 'COMPLETED' | 'PENDING' | 'FAILED'
  completedAt: Date
}

export interface ProxyStatus {
  active: boolean
  contractId?: string
  expiresAt?: Date
}

// ---------------------------------------------------------------------------
// Internal response shapes
// ---------------------------------------------------------------------------

interface SetupProxyResponse {
  contract_id: string
  status?: string
}

interface ProxiedTransferResponse {
  transaction_id: string
  completed_at: string
  status: 'completed' | 'pending' | 'failed'
  transfer_object: Record<string, unknown>
  activity_marker_contract_id?: string
}

interface ProxyStatusResponse {
  active: boolean
  contract_id?: string
  expires_at?: string
}

// ---------------------------------------------------------------------------
// WalletProxyManager
// ---------------------------------------------------------------------------

export class WalletProxyManager {
  private readonly validatorUrl: string
  private readonly appProviderParty: string
  private readonly walletProxyTemplateId: string

  constructor() {
    this.validatorUrl = (process.env.CANTON_VALIDATOR_URL ?? '').replace(/\/$/, '')
    this.appProviderParty = process.env.CANTON_APP_PROVIDER_PARTY ?? ''
    this.walletProxyTemplateId = process.env.CANTON_WALLET_PROXY_TEMPLATE_ID ?? ''
  }

  // ── Internal HTTP helpers ────────────────────────────────────────────────

  private async post<T>(path: string, body: unknown): Promise<T> {
    const token = await getCantonToken()
    const res = await fetch(`${this.validatorUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`WalletProxy POST ${path} failed ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  private async get<T>(path: string): Promise<T> {
    const token = await getCantonToken()
    const res = await fetch(`${this.validatorUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`WalletProxy GET ${path} failed ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  // ── Public methods ───────────────────────────────────────────────────────

  /**
   * setupWalletProxy — creates a WalletUserProxy contract for a vendor party,
   * enabling the FlowLedger provider party to submit transfers on their behalf
   * while automatically recording FeaturedAppActivityMarkers for reward earning.
   *
   * Non-blocking: if setup fails, we log and return empty string. Vendor creation
   * is never blocked by proxy setup failure.
   */
  async setupWalletProxy(vendorPartyId: string): Promise<string> {
    try {
      if (!this.validatorUrl) {
        console.warn('[WalletProxy] CANTON_VALIDATOR_URL not set — skipping proxy setup')
        return ''
      }
      if (!this.appProviderParty) {
        console.warn('[WalletProxy] CANTON_APP_PROVIDER_PARTY not set — skipping proxy setup')
        return ''
      }

      const res = await this.post<SetupProxyResponse>('/v0/wallet/user-proxy/setup', {
        vendor_party: vendorPartyId,
        provider_party: this.appProviderParty,
        template_id: this.walletProxyTemplateId || undefined,
      })

      console.log(`[WalletProxy] Proxy set up for ${vendorPartyId}: ${res.contract_id}`)
      return res.contract_id
    } catch (err) {
      console.warn('[WalletProxy] setupWalletProxy failed (non-blocking):', err)
      return ''
    }
  }

  /**
   * executeProxiedTransfer — submits a token transfer via the WalletUserProxy,
   * which automatically emits a FeaturedAppActivityMarker. The marker is what
   * earns CC rewards for the FlowLedger provider party.
   *
   * Falls back to a simulated direct-transfer result if the proxy endpoint
   * is unavailable (e.g. not on MainNet or proxy not yet set up).
   */
  async executeProxiedTransfer(input: ProxiedTransferInput): Promise<ProxiedTransferResult> {
    try {
      if (!this.validatorUrl) {
        throw new Error('CANTON_VALIDATOR_URL not set')
      }

      const res = await this.post<ProxiedTransferResponse>('/v0/wallet/user-proxy/transfer', {
        sender_party: input.senderPartyId,
        receiver_party: input.receiverPartyId,
        amount: input.amount.toString(),
        ...(input.assetId === 'USDCX' ? { asset_id: 'USDCx' } : {}),
        invoice_id: input.invoiceId,
        batch_id: input.batchId,
        description: `FlowLedger invoice payment — invoice ${input.invoiceId}`,
        application_id: 'FlowLedger',
        provider_party: this.appProviderParty || undefined,
      })

      const transferObject = {
        updateId: res.transaction_id,
        sender: input.senderPartyId,
        receiver: input.receiverPartyId,
        amount: input.amount,
        assetId: input.assetId,
        invoiceId: input.invoiceId,
        batchId: input.batchId,
        completedAt: res.completed_at,
        network: process.env.CANTON_NETWORK_ENV ?? 'mainnet',
        cantonTransferObject: res.transfer_object,
        activityMarkerContractId: res.activity_marker_contract_id,
        proxied: true,
      }

      return {
        updateId: res.transaction_id,
        transferObjectJson: JSON.stringify(transferObject),
        activityMarkerContractId: res.activity_marker_contract_id,
        status: res.status === 'completed' ? 'COMPLETED'
              : res.status === 'pending'   ? 'PENDING'
              : 'FAILED',
        completedAt: new Date(res.completed_at),
      }
    } catch (err) {
      console.warn('[WalletProxy] executeProxiedTransfer failed — will fall back to direct transfer:', err)
      // Re-throw so caller can fall back to direct transfer
      throw err
    }
  }

  /**
   * getProxyStatus — returns the current status of the WalletUserProxy contract
   * for a vendor party. Used by the rewards dashboard to show per-vendor proxy status.
   */
  async getProxyStatus(vendorPartyId: string): Promise<ProxyStatus> {
    try {
      const res = await this.get<ProxyStatusResponse>(
        `/v0/wallet/user-proxy/status/${encodeURIComponent(vendorPartyId)}`
      )
      return {
        active: res.active,
        contractId: res.contract_id,
        expiresAt: res.expires_at ? new Date(res.expires_at) : undefined,
      }
    } catch (err) {
      console.warn('[WalletProxy] getProxyStatus failed:', err)
      return { active: false }
    }
  }

  /**
   * renewProxy — renews the WalletUserProxy contract for a vendor party.
   * Proxy contracts may expire — call this before batch execution if needed.
   */
  async renewProxy(vendorPartyId: string): Promise<void> {
    try {
      await this.post('/v0/wallet/user-proxy/renew', {
        vendor_party: vendorPartyId,
        provider_party: this.appProviderParty || undefined,
      })
      console.log(`[WalletProxy] Proxy renewed for ${vendorPartyId}`)
    } catch (err) {
      console.warn('[WalletProxy] renewProxy failed (non-blocking):', err)
    }
  }
}
