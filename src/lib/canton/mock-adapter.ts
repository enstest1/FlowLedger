import { randomUUID } from 'crypto'
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

function generatePartyFingerprint(): string {
  return Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('')
}

function generateUpdateId(): string {
  return Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('')
}

function generateContractId(): string {
  return '#' + randomUUID().replace(/-/g, '').substring(0, 32) + ':0'
}

export class MockCantonAdapter implements CantonAdapter {
  private balanceStore: Map<string, Map<string, number>> = new Map()

  private getBalanceValue(partyId: string, assetId: string): number {
    return this.balanceStore.get(partyId)?.get(assetId) ?? 50000
  }

  async registerExternalParty(
    input: RegisterPartyInput
  ): Promise<RegisterPartyResult> {
    await new Promise((r) => setTimeout(r, 200))
    return { partyId: input.partyId, status: 'REGISTERED' }
  }

  async getPartyStatus(partyId: string): Promise<PartyStatus> {
    return { partyId, active: true }
  }

  async setTransferPreApproval(partyId: string): Promise<PreApprovalResult> {
    await new Promise((r) => setTimeout(r, 300))
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    return { partyId, expiresAt, status: 'ACTIVE' }
  }

  async cancelTransferPreApproval(_partyId: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 200))
  }

  async getBalance(partyId: string, assetId: AssetId): Promise<BalanceResult> {
    await new Promise((r) => setTimeout(r, 150))
    return {
      partyId,
      assetId,
      amount: this.getBalanceValue(partyId, assetId),
    }
  }

  async listUTXOs(partyId: string): Promise<UTXOResult[]> {
    await new Promise((r) => setTimeout(r, 200))
    void partyId
    return [
      { utxoId: randomUUID(), amount: 10000, assetId: 'USDCX', locked: false },
      { utxoId: randomUUID(), amount: 10000, assetId: 'USDCX', locked: false },
      { utxoId: randomUUID(), amount: 10000, assetId: 'USDCX', locked: false },
      { utxoId: randomUUID(), amount: 10000, assetId: 'USDCX', locked: false },
      { utxoId: randomUUID(), amount: 10000, assetId: 'USDCX', locked: false },
      { utxoId: randomUUID(), amount: 2000, assetId: 'CC', locked: false },
    ]
  }

  async selectUTXOs(
    partyId: string,
    amount: number,
    assetId: AssetId
  ): Promise<UTXOResult[]> {
    const utxos = await this.listUTXOs(partyId)
    const relevant = utxos.filter((u) => u.assetId === assetId && !u.locked)
    let total = 0
    const selected: UTXOResult[] = []
    for (const utxo of relevant) {
      selected.push(utxo)
      total += utxo.amount
      if (total >= amount) break
    }
    return selected
  }

  async executeTransfer(input: ExecuteTransferInput): Promise<TransferResult> {
    await new Promise((r) => setTimeout(r, 500))
    const updateId = generateUpdateId()
    const transferObject = {
      updateId,
      recordTime: new Date().toISOString(),
      sender: input.senderPartyId,
      receiver: input.receiverPartyId,
      amount: input.amount.toString(),
      assetId: input.assetId,
      invoiceId: input.invoiceId,
      batchId: input.batchId,
      featuredApp: input.featuredApp,
      network: process.env.CANTON_NETWORK_ENV ?? 'devnet',
    }
    return {
      updateId,
      transferObjectJson: JSON.stringify(transferObject),
      status: 'COMPLETED',
      completedAt: new Date(),
    }
  }

  async getTransferStatus(updateId: string): Promise<TransferResult> {
    return {
      updateId,
      transferObjectJson: JSON.stringify({ updateId, status: 'COMPLETED' }),
      status: 'COMPLETED',
      completedAt: new Date(),
    }
  }

  async getProofOfTransfer(updateId: string): Promise<ProofOfTransferResult> {
    return {
      updateId,
      transferObjectJson: JSON.stringify({ updateId, verified: true }),
      payerParty: 'treasury::' + generatePartyFingerprint(),
      payeeParty: 'vendor::' + generatePartyFingerprint(),
      amount: '0',
      assetId: 'USDCX',
      timestamp: new Date().toISOString(),
      verified: true,
    }
  }

  async createInvoiceContract(
    _input: CreateInvoiceInput
  ): Promise<ContractResult> {
    await new Promise((r) => setTimeout(r, 300))
    return { contractId: generateContractId(), status: 'CREATED' }
  }

  async approveInvoiceContract(
    _input: ApproveInvoiceInput
  ): Promise<ContractResult> {
    await new Promise((r) => setTimeout(r, 300))
    return { contractId: generateContractId(), status: 'CREATED' }
  }

  async rejectInvoiceContract(
    _input: RejectInvoiceInput
  ): Promise<ContractResult> {
    await new Promise((r) => setTimeout(r, 300))
    return { contractId: generateContractId(), status: 'CREATED' }
  }

  async createBatchContract(
    _input: CreateBatchInput
  ): Promise<ContractResult> {
    await new Promise((r) => setTimeout(r, 400))
    return { contractId: generateContractId(), status: 'CREATED' }
  }

  async createReceiptContract(
    _input: CreateReceiptInput
  ): Promise<ContractResult> {
    await new Promise((r) => setTimeout(r, 200))
    return { contractId: generateContractId(), status: 'CREATED' }
  }

  async estimateTrafficCost(
    input: TrafficEstimateInput
  ): Promise<TrafficEstimateResult> {
    return { estimatedCC: input.transferCount * 0.01 }
  }

  async tapDevNet(partyId: string, amount: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 1000))
    const balances = this.balanceStore.get(partyId) ?? new Map()
    balances.set('USDCX', (balances.get('USDCX') ?? 0) + Number(amount))
    this.balanceStore.set(partyId, balances)
  }
}
