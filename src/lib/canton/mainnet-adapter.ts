// MainNet Canton adapter — targets the Splice Validator App HTTP REST API on MainNet.
//
// Identical to DevNetCantonAdapter EXCEPT:
//   1. No tapDevNet method (no faucet on MainNet — real money only)
//   2. Instantiates WalletProxyManager for activity marker reward earning
//   3. executeTransfer tries proxied transfer first for FeaturedAppActivityMarker creation
//   4. Additional methods: checkFeaturedAppStatus, getFeaturedAppRight
//
// The reward earning path is always non-blocking. If proxy transfer fails,
// we fall back to direct transfer. A reward failure never blocks a payment.

import { randomUUID } from 'crypto'
import { getCantonToken } from './canton-auth'
import { WalletProxyManager } from './wallet-proxy'
import type {
  CantonAdapter,
  RegisterPartyInput,
  RegisterPartyResult,
  PartyStatus,
  PreApprovalResult,
  BalanceResult,
  UTXOResult,
  ExecuteTransferInput,
  TransferResult,
  ProofOfTransferResult,
  ContractResult,
  TrafficEstimateInput,
  TrafficEstimateResult,
  CreateInvoiceInput,
  ApproveInvoiceInput,
  RejectInvoiceInput,
  CreateBatchInput,
  CreateReceiptInput,
  AssetId,
} from './types'

// ---------------------------------------------------------------------------
// HTTP helpers — identical to devnet-adapter
// ---------------------------------------------------------------------------

function validatorBase(): string {
  const url = process.env.CANTON_VALIDATOR_URL
  if (!url) throw new Error('CANTON_VALIDATOR_URL is not set')
  return url.replace(/\/$/, '')
}

function ledgerBase(): string {
  const url = process.env.CANTON_LEDGER_URL
  if (!url) throw new Error('CANTON_LEDGER_URL is not set')
  return url.replace(/\/$/, '')
}

async function validatorGet<T>(path: string): Promise<T> {
  const token = await getCantonToken()
  const res = await fetch(`${validatorBase()}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Canton GET ${path} failed ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

async function validatorPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getCantonToken()
  const res = await fetch(`${validatorBase()}${path}`, {
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
    throw new Error(`Canton POST ${path} failed ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

async function validatorDelete(path: string): Promise<void> {
  const token = await getCantonToken()
  const res = await fetch(`${validatorBase()}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Canton DELETE ${path} failed ${res.status}: ${text}`)
  }
}

async function ledgerPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getCantonToken()
  const res = await fetch(`${ledgerBase()}${path}`, {
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
    throw new Error(`Canton Ledger POST ${path} failed ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Validator App response shapes — identical to devnet-adapter
// ---------------------------------------------------------------------------

interface AllocatePartyResponse {
  party_id: string
}

interface BalanceResponse {
  balance: {
    effective_unlocked_qty: string
    effective_locked_qty: string
    round: number
  }
}

interface HoldingsResponse {
  holdings: Array<{
    contract_id: string
    amount: string
    asset_id: string
    locked: boolean
  }>
}

interface TransferResponse {
  transaction_id: string
  completed_at: string
  status: 'completed' | 'pending' | 'failed'
  transfer_object: Record<string, unknown>
}

interface PreApprovalResponse {
  pre_approval_id: string
  expires_at: string
}

interface FeaturedAppStatusResponse {
  featured_app_right_contract_id?: string
  status?: string
  active?: boolean
}

// ---------------------------------------------------------------------------
// MainNet Canton Adapter
// ---------------------------------------------------------------------------

export class MainNetCantonAdapter implements CantonAdapter {
  private readonly walletProxyManager: WalletProxyManager

  constructor() {
    this.walletProxyManager = new WalletProxyManager()
  }

  // ── Party management ──────────────────────────────────────────────────────

  async registerExternalParty(input: RegisterPartyInput): Promise<RegisterPartyResult> {
    try {
      const res = await validatorPost<AllocatePartyResponse>(
        '/v0/validator/external-party/allocate',
        { party_id_hint: input.hint }
      )
      return { partyId: res.party_id, status: 'REGISTERED' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('already exists') || msg.includes('409')) {
        return { partyId: input.partyId, status: 'ALREADY_EXISTS' }
      }
      throw err
    }
  }

  async getPartyStatus(partyId: string): Promise<PartyStatus> {
    try {
      await validatorGet(`/v0/validator/external-party/${encodeURIComponent(partyId)}`)
      return { partyId, active: true }
    } catch {
      return { partyId, active: false }
    }
  }

  async setTransferPreApproval(partyId: string): Promise<PreApprovalResult> {
    const res = await validatorPost<PreApprovalResponse>(
      '/v0/wallet/transfer-preapprovals',
      {
        receiver_party: partyId,
        expiry_duration_seconds: 90 * 24 * 60 * 60,
      }
    )
    return {
      partyId,
      expiresAt: new Date(res.expires_at),
      status: 'ACTIVE',
    }
  }

  async cancelTransferPreApproval(partyId: string): Promise<void> {
    await validatorDelete(
      `/v0/wallet/transfer-preapprovals/by-party/${encodeURIComponent(partyId)}`
    )
  }

  // ── Balances and UTXOs ────────────────────────────────────────────────────

  async getBalance(partyId: string, assetId: AssetId): Promise<BalanceResult> {
    const res = await validatorGet<BalanceResponse>('/v0/wallet/balance')
    const amount = parseFloat(res.balance.effective_unlocked_qty)
    return { partyId, assetId, amount }
  }

  async listUTXOs(partyId: string): Promise<UTXOResult[]> {
    const res = await validatorGet<HoldingsResponse>('/v0/wallet/holdings')
    return res.holdings.map((h) => ({
      utxoId: h.contract_id,
      amount: parseFloat(h.amount),
      assetId: h.asset_id.includes('USD') ? 'USDCX' : ('CC' as AssetId),
      locked: h.locked,
    }))
  }

  async selectUTXOs(partyId: string, amount: number, assetId: AssetId): Promise<UTXOResult[]> {
    const utxos = await this.listUTXOs(partyId)
    const relevant = utxos.filter((u) => u.assetId === assetId && !u.locked)
    let total = 0
    const selected: UTXOResult[] = []
    for (const u of relevant) {
      selected.push(u)
      total += u.amount
      if (total >= amount) break
    }
    if (total < amount) {
      throw new Error(`Insufficient ${assetId} balance. Have ${total}, need ${amount}`)
    }
    return selected
  }

  // ── Transfers ─────────────────────────────────────────────────────────────

  async executeTransfer(input: ExecuteTransferInput): Promise<TransferResult> {
    // Try proxied transfer first — this creates a FeaturedAppActivityMarker
    // which earns CC rewards for the FlowLedger provider party.
    // If the proxy fails for any reason, fall back to direct transfer.
    try {
      const proxiedResult = await this.walletProxyManager.executeProxiedTransfer({
        senderPartyId: input.senderPartyId,
        receiverPartyId: input.receiverPartyId,
        amount: input.amount,
        assetId: input.assetId,
        invoiceId: input.invoiceId,
        batchId: input.batchId,
      })

      // Embed activityMarkerContractId in the transfer object JSON so batch.ts
      // can extract it and persist it on the PaymentReceipt record.
      const transferObj = JSON.parse(proxiedResult.transferObjectJson) as Record<string, unknown>
      if (proxiedResult.activityMarkerContractId) {
        transferObj.activityMarkerContractId = proxiedResult.activityMarkerContractId
      }

      return {
        updateId: proxiedResult.updateId,
        transferObjectJson: JSON.stringify(transferObj),
        status: proxiedResult.status,
        completedAt: proxiedResult.completedAt,
      }
    } catch (proxyErr) {
      console.warn('[MainNet] Proxied transfer failed — falling back to direct transfer:', proxyErr)
    }

    // Direct transfer fallback — same as DevNetCantonAdapter
    const res = await validatorPost<TransferResponse>('/v0/wallet/transfers', {
      receiver_party: input.receiverPartyId,
      amount: input.amount.toString(),
      ...(input.assetId === 'USDCX' ? { asset_id: 'USDCx' } : {}),
      description: `FlowLedger invoice payment — invoice ${input.invoiceId}`,
      application_id: 'FlowLedger',
      featured_app: input.featuredApp,
    })

    const transferObject = {
      updateId: res.transaction_id,
      sender: input.senderPartyId,
      receiver: input.receiverPartyId,
      amount: input.amount,
      assetId: input.assetId,
      invoiceId: input.invoiceId,
      batchId: input.batchId,
      featuredApp: input.featuredApp,
      completedAt: res.completed_at,
      network: process.env.CANTON_NETWORK_ENV ?? 'mainnet',
      cantonTransferObject: res.transfer_object,
      proxied: false,
    }

    return {
      updateId: res.transaction_id,
      transferObjectJson: JSON.stringify(transferObject),
      status:
        res.status === 'completed'
          ? 'COMPLETED'
          : res.status === 'pending'
          ? 'PENDING'
          : 'FAILED',
      completedAt: new Date(res.completed_at),
    }
  }

  async getTransferStatus(updateId: string): Promise<TransferResult> {
    const res = await ledgerPost<{ update: Record<string, unknown> }>(
      `/v2/updates/${encodeURIComponent(updateId)}`,
      {}
    )
    return {
      updateId,
      transferObjectJson: JSON.stringify(res.update),
      status: 'COMPLETED',
      completedAt: new Date(),
    }
  }

  async getProofOfTransfer(updateId: string): Promise<ProofOfTransferResult> {
    const res = await ledgerPost<{ update: Record<string, unknown> }>(
      `/v2/updates/${encodeURIComponent(updateId)}`,
      {}
    )
    const update = res.update as {
      transaction?: {
        act_as?: string[]
        read_as?: string[]
        record_time?: string
      }
    }
    return {
      updateId,
      transferObjectJson: JSON.stringify(res.update),
      payerParty: update.transaction?.act_as?.[0] ?? '',
      payeeParty: update.transaction?.read_as?.[0] ?? '',
      amount: '',
      assetId: '',
      timestamp: update.transaction?.record_time ?? new Date().toISOString(),
      verified: true,
    }
  }

  // ── Daml Contracts ────────────────────────────────────────────────────────

  async createInvoiceContract(input: CreateInvoiceInput): Promise<ContractResult> {
    return { contractId: `#pending-daml-deploy:invoice:${input.invoiceId}`, status: 'CREATED' }
  }

  async approveInvoiceContract(input: ApproveInvoiceInput): Promise<ContractResult> {
    return { contractId: `#pending-daml-deploy:approve:${randomUUID()}`, status: 'CREATED' }
  }

  async rejectInvoiceContract(input: RejectInvoiceInput): Promise<ContractResult> {
    return { contractId: `#pending-daml-deploy:reject:${randomUUID()}`, status: 'CREATED' }
  }

  async createBatchContract(input: CreateBatchInput): Promise<ContractResult> {
    return { contractId: `#pending-daml-deploy:batch:${input.batchId}`, status: 'CREATED' }
  }

  async createReceiptContract(input: CreateReceiptInput): Promise<ContractResult> {
    return { contractId: `#pending-daml-deploy:receipt:${input.receiptId}`, status: 'CREATED' }
  }

  // ── Traffic ───────────────────────────────────────────────────────────────

  async estimateTrafficCost(input: TrafficEstimateInput): Promise<TrafficEstimateResult> {
    return { estimatedCC: input.transferCount * 0.01 }
  }

  // ── MainNet-only: Featured App status ─────────────────────────────────────

  /**
   * checkFeaturedAppStatus — verifies that the FlowLedger provider party has
   * an active FeaturedAppRight contract on MainNet. Without this contract, activity
   * markers are created but do NOT earn CC rewards.
   *
   * Called at startup from index.ts. Returns true if active.
   */
  async checkFeaturedAppStatus(): Promise<boolean> {
    try {
      const res = await validatorGet<FeaturedAppStatusResponse>(
        '/v0/validator/featured-app-status'
      )

      const isActive =
        res.active === true ||
        res.status === 'active' ||
        !!res.featured_app_right_contract_id

      if (!isActive) {
        const providerParty = process.env.CANTON_APP_PROVIDER_PARTY ?? '(not set)'
        console.warn(
          `[MainNet] WARNING: No FeaturedAppRight contract found for party ${providerParty}. ` +
            'Activity markers will be created but rewards will not be earned until featured app ' +
            'status is approved. Apply at canton.foundation/featured-app-request'
        )
      }

      return isActive
    } catch (err) {
      console.warn('[MainNet] checkFeaturedAppStatus failed:', err)
      return false
    }
  }

  /**
   * getFeaturedAppRight — returns the FeaturedAppRight contract ID.
   * Reads from CANTON_FEATURED_APP_RIGHT_CONTRACT_ID env var first.
   * Falls back to fetching from the validator if not set.
   */
  async getFeaturedAppRight(): Promise<string | null> {
    const envContractId = process.env.CANTON_FEATURED_APP_RIGHT_CONTRACT_ID
    if (envContractId) return envContractId

    try {
      const res = await validatorGet<FeaturedAppStatusResponse>(
        '/v0/validator/featured-app-status'
      )
      return res.featured_app_right_contract_id ?? null
    } catch (err) {
      console.warn('[MainNet] getFeaturedAppRight failed:', err)
      return null
    }
  }
}
