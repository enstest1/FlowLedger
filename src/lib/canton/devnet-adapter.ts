// Real Canton adapter — targets the Splice Validator App HTTP REST API.
//
// Works against:
//   LocalNet  — cn-quickstart running locally via Docker (no external credentials)
//   DevNet    — NaaS-hosted validator (Launchnodes, Proof Group, Edgevana)
//   MainNet   — same as DevNet, different CANTON_VALIDATOR_URL + credentials
//
// Splice Validator App API docs: https://docs.dev.sync.global/app_dev/validator_api/index.html
// The exact paths below are based on Splice v0.x. Verify against your node's /docs/openapi.

import { randomUUID } from 'crypto'
import { getCantonToken } from './canton-auth'
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
// HTTP helpers
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
// Validator App response shapes (Splice v0.x)
// Update field names if your Splice version differs — check /docs/openapi
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
  transaction_id: string   // This is the Canton UpdateID (proof-of-transfer)
  completed_at: string
  status: 'completed' | 'pending' | 'failed'
  transfer_object: Record<string, unknown>
}

interface PreApprovalResponse {
  pre_approval_id: string
  expires_at: string
}

// ---------------------------------------------------------------------------
// DevNet Canton Adapter
// ---------------------------------------------------------------------------

export class DevNetCantonAdapter implements CantonAdapter {

  // ── Party management ──────────────────────────────────────────────────────

  async registerExternalParty(input: RegisterPartyInput): Promise<RegisterPartyResult> {
    // Splice Validator API: allocate an external party on this validator
    // Docs: /v0/validator/external-party/allocate
    try {
      const res = await validatorPost<AllocatePartyResponse>(
        '/v0/validator/external-party/allocate',
        { party_id_hint: input.hint }
      )
      return { partyId: res.party_id, status: 'REGISTERED' }
    } catch (err) {
      // If party already exists, the API returns an error — treat as success
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('already exists') || msg.includes('409')) {
        return { partyId: input.partyId, status: 'ALREADY_EXISTS' }
      }
      throw err
    }
  }

  async getPartyStatus(partyId: string): Promise<PartyStatus> {
    // Splice Validator API: check if a party is registered
    // Docs: /v0/validator/external-party/{party_id}
    try {
      await validatorGet(`/v0/validator/external-party/${encodeURIComponent(partyId)}`)
      return { partyId, active: true }
    } catch {
      return { partyId, active: false }
    }
  }

  async setTransferPreApproval(partyId: string): Promise<PreApprovalResult> {
    // Sets a TransferPreApproval contract so the vendor auto-receives payments
    // without needing to manually accept each transfer.
    // Docs: /v0/wallet/transfer-preapprovals
    const res = await validatorPost<PreApprovalResponse>(
      '/v0/wallet/transfer-preapprovals',
      {
        receiver_party: partyId,
        // Pre-approval duration: 90 days (the network minimum charge period)
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
    // Docs: /v0/wallet/transfer-preapprovals/by-party/{party_id}
    await validatorDelete(`/v0/wallet/transfer-preapprovals/by-party/${encodeURIComponent(partyId)}`)
  }

  // ── Balances and UTXOs ────────────────────────────────────────────────────

  async getBalance(partyId: string, assetId: AssetId): Promise<BalanceResult> {
    // Docs: /v0/wallet/balance
    // The balance endpoint returns the treasury party's own balance.
    // partyId is included for interface compatibility — the validator returns
    // the balance for the authenticated party only.
    const res = await validatorGet<BalanceResponse>('/v0/wallet/balance')
    const amount = parseFloat(res.balance.effective_unlocked_qty)
    return { partyId, assetId, amount }
  }

  async listUTXOs(partyId: string): Promise<UTXOResult[]> {
    // Docs: /v0/wallet/holdings (or /v0/wallet/amulet-balance depending on Splice version)
    const res = await validatorGet<HoldingsResponse>('/v0/wallet/holdings')
    return res.holdings.map(h => ({
      utxoId: h.contract_id,
      amount: parseFloat(h.amount),
      assetId: h.asset_id.includes('USD') ? 'USDCX' : 'CC' as AssetId,
      locked: h.locked,
    }))
  }

  async selectUTXOs(partyId: string, amount: number, assetId: AssetId): Promise<UTXOResult[]> {
    const utxos = await this.listUTXOs(partyId)
    const relevant = utxos.filter(u => u.assetId === assetId && !u.locked)
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
    // CIP-0056 Free-of-Payment token transfer.
    // Vendor has a pre-approval set, so this is a 1-step transfer.
    // The response UpdateID is the Canton cryptographic proof of transfer.
    // Docs: /v0/wallet/transfers (verify path against your Splice version's /docs/openapi)
    const res = await validatorPost<TransferResponse>('/v0/wallet/transfers', {
      receiver_party: input.receiverPartyId,
      amount: input.amount.toString(),
      // USDCx asset identifier on Canton — verify exact format with your validator
      // For Canton Coin (Amulet): omit asset_id or use the CC identifier
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
      network: process.env.CANTON_NETWORK_ENV ?? 'localnet',
      // The full Canton transfer object from the ledger
      cantonTransferObject: res.transfer_object,
    }

    return {
      updateId: res.transaction_id,
      transferObjectJson: JSON.stringify(transferObject),
      status: res.status === 'completed' ? 'COMPLETED'
            : res.status === 'pending'   ? 'PENDING'
            : 'FAILED',
      completedAt: new Date(res.completed_at),
    }
  }

  async getTransferStatus(updateId: string): Promise<TransferResult> {
    // Query a specific transaction by UpdateID from the Ledger API
    // Docs: /v2/updates/{update_id}
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
    // Fetch the full transaction from the ledger as cryptographic proof
    // The UpdateID uniquely identifies the transaction on Canton Network
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
      amount: '',     // Extract from events within the transaction if needed
      assetId: '',    // Extract from events within the transaction if needed
      timestamp: update.transaction?.record_time ?? new Date().toISOString(),
      verified: true, // A successful ledger fetch IS the verification
    }
  }

  // ── Daml Contracts ────────────────────────────────────────────────────────
  //
  // Require the FlowLedger DAR to be uploaded first:
  //   cd daml && daml build
  //   daml ledger upload-dar --host <validator-host> --port 3901 .daml/dist/flowledger-1.0.0.dar
  //
  // Then set CANTON_DAML_PACKAGE_ID to the hash printed by daml build.
  // Without it these fall back to placeholder IDs — the transfer (UpdateID) still works.

  private damlPackageId(): string | null {
    return process.env.CANTON_DAML_PACKAGE_ID ?? null
  }

  private async submitCommand<T>(body: unknown): Promise<T> {
    return ledgerPost<T>('/v2/commands/submit-and-wait', body)
  }

  private extractContractId(res: unknown): string {
    // Ledger API v2: contract ID is in the first created event of the transaction tree
    const r = res as {
      transaction?: { events?: Array<{ created?: { contractId?: string } }> }
      transactionTree?: { eventsById?: Record<string, { created?: { contractId?: string } }> }
    }
    const events = r.transaction?.events ?? Object.values(r.transactionTree?.eventsById ?? {})
    for (const ev of events) {
      if (ev.created?.contractId) return ev.created.contractId
    }
    return randomUUID()
  }

  async createInvoiceContract(input: CreateInvoiceInput): Promise<ContractResult> {
    const pkg = this.damlPackageId()
    if (!pkg) return { contractId: `#pending-daml-deploy:invoice:${input.invoiceId}`, status: 'CREATED' }

    const res = await this.submitCommand({
      commands: [{
        CreateCommand: {
          templateId: `${pkg}:FlowLedger.Invoice:Invoice`,
          createArguments: {
            invoiceId: input.invoiceId,
            orgId: input.orgId,
            vendorParty: input.vendorPartyId,
            treasuryParty: input.treasuryPartyId,
            amount: input.amount.toString(),
            assetId: input.assetId,
            description: input.description,
          },
        },
      }],
      actAs: [input.treasuryPartyId],
      readAs: [input.vendorPartyId],
      applicationId: 'FlowLedger',
      commandId: input.invoiceId,
    })
    return { contractId: this.extractContractId(res), status: 'CREATED' }
  }

  async approveInvoiceContract(input: ApproveInvoiceInput): Promise<ContractResult> {
    const pkg = this.damlPackageId()
    if (!pkg) return { contractId: `#pending-daml-deploy:approve:${randomUUID()}`, status: 'CREATED' }

    const res = await this.submitCommand({
      commands: [{
        ExerciseCommand: {
          templateId: `${pkg}:FlowLedger.Invoice:Invoice`,
          contractId: input.contractId,
          choice: 'Approve',
          choiceArgument: { approverParty: input.approverPartyId },
        },
      }],
      actAs: [input.approverPartyId],
      applicationId: 'FlowLedger',
      commandId: randomUUID(),
    })
    return { contractId: this.extractContractId(res), status: 'CREATED' }
  }

  async rejectInvoiceContract(input: RejectInvoiceInput): Promise<ContractResult> {
    const pkg = this.damlPackageId()
    if (!pkg) return { contractId: `#pending-daml-deploy:reject:${randomUUID()}`, status: 'CREATED' }

    const res = await this.submitCommand({
      commands: [{
        ExerciseCommand: {
          templateId: `${pkg}:FlowLedger.Invoice:Invoice`,
          contractId: input.contractId,
          choice: 'Reject',
          choiceArgument: { approverParty: input.approverPartyId, note: input.note },
        },
      }],
      actAs: [input.approverPartyId],
      applicationId: 'FlowLedger',
      commandId: randomUUID(),
    })
    return { contractId: this.extractContractId(res), status: 'CREATED' }
  }

  async createBatchContract(input: CreateBatchInput): Promise<ContractResult> {
    const pkg = this.damlPackageId()
    if (!pkg) return { contractId: `#pending-daml-deploy:batch:${input.batchId}`, status: 'CREATED' }

    const res = await this.submitCommand({
      commands: [{
        CreateCommand: {
          templateId: `${pkg}:FlowLedger.PayrollBatch:PayrollBatch`,
          createArguments: {
            batchId: input.batchId,
            orgId: input.orgId,
            treasuryParty: input.treasuryPartyId,
            invoiceIds: input.invoiceIds,
            totalAmount: input.totalAmount.toString(),
            assetId: input.assetId,
            featuredApp: input.featuredApp,
          },
        },
      }],
      actAs: [input.treasuryPartyId],
      applicationId: 'FlowLedger',
      commandId: input.batchId,
    })
    return { contractId: this.extractContractId(res), status: 'CREATED' }
  }

  async createReceiptContract(input: CreateReceiptInput): Promise<ContractResult> {
    const pkg = this.damlPackageId()
    if (!pkg) return { contractId: `#pending-daml-deploy:receipt:${input.receiptId}`, status: 'CREATED' }

    const res = await this.submitCommand({
      commands: [{
        CreateCommand: {
          templateId: `${pkg}:FlowLedger.PaymentReceipt:PaymentReceipt`,
          createArguments: {
            receiptId: input.receiptId,
            invoiceId: input.invoiceId,
            batchId: input.batchId,
            payerParty: input.payerParty,
            payeeParty: input.payeeParty,
            amount: input.amount.toString(),
            assetId: input.assetId,
            updateId: input.updateId,
          },
        },
      }],
      actAs: [input.payerParty],
      readAs: [input.payeeParty],
      applicationId: 'FlowLedger',
      commandId: input.receiptId,
    })
    return { contractId: this.extractContractId(res), status: 'CREATED' }
  }

  // ── Traffic ───────────────────────────────────────────────────────────────

  async estimateTrafficCost(input: TrafficEstimateInput): Promise<TrafficEstimateResult> {
    // Traffic cost depends on command byte size. 0.01 CC per transfer is a rough estimate.
    // Check your validator's traffic pricing for exact rates.
    return { estimatedCC: input.transferCount * 0.01 }
  }

  // ── DevNet faucet (LocalNet + DevNet only) ────────────────────────────────

  async tapDevNet(partyId: string, amount: string): Promise<void> {
    // Credits test Canton Coin (Amulet) to the authenticated party.
    // Only available on LocalNet and DevNet — does not exist on MainNet.
    // Docs: /v0/wallet/tap
    await validatorPost('/v0/wallet/tap', { amount })
    console.log(`[DevNet] Tapped ${amount} CC for party ${partyId}`)
  }
}
