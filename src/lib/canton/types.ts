export type AssetId = 'USDCX' | 'CC'

export interface RegisterPartyInput {
  partyId: string
  hint: string
}

export interface RegisterPartyResult {
  partyId: string
  status: 'REGISTERED' | 'ALREADY_EXISTS'
}

export interface PartyStatus {
  partyId: string
  active: boolean
}

export interface PreApprovalResult {
  partyId: string
  expiresAt: Date
  status: 'ACTIVE'
}

export interface BalanceResult {
  partyId: string
  assetId: AssetId
  amount: number
}

export interface UTXOResult {
  utxoId: string
  amount: number
  assetId: AssetId
  locked: boolean
}

export interface ExecuteTransferInput {
  senderPartyId: string
  receiverPartyId: string
  amount: number
  assetId: AssetId
  invoiceId: string
  batchId: string
  featuredApp: boolean
}

export interface TransferResult {
  updateId: string
  transferObjectJson: string
  status: 'COMPLETED' | 'PENDING' | 'FAILED'
  completedAt: Date
}

export interface ProofOfTransferResult {
  updateId: string
  transferObjectJson: string
  payerParty: string
  payeeParty: string
  amount: string
  assetId: string
  timestamp: string
  verified: boolean
}

export interface ContractResult {
  contractId: string
  status: 'CREATED'
}

export interface TrafficEstimateInput {
  transferCount: number
  totalAmount: number
  assetId: AssetId
}

export interface TrafficEstimateResult {
  estimatedCC: number
}

export interface CreateInvoiceInput {
  invoiceId: string
  orgId: string
  vendorPartyId: string
  treasuryPartyId: string
  amount: number
  assetId: AssetId
  description: string
}

export interface ApproveInvoiceInput {
  contractId: string
  approverPartyId: string
}

export interface RejectInvoiceInput {
  contractId: string
  approverPartyId: string
  note: string
}

export interface CreateBatchInput {
  batchId: string
  orgId: string
  treasuryPartyId: string
  invoiceIds: string[]
  totalAmount: number
  assetId: AssetId
  featuredApp: boolean
}

export interface CreateReceiptInput {
  receiptId: string
  invoiceId: string
  batchId: string
  payerParty: string
  payeeParty: string
  amount: number
  assetId: AssetId
  updateId: string
  transferObjectJson: string
}

export interface CantonAdapter {
  registerExternalParty(input: RegisterPartyInput): Promise<RegisterPartyResult>
  getPartyStatus(partyId: string): Promise<PartyStatus>
  setTransferPreApproval(partyId: string): Promise<PreApprovalResult>
  cancelTransferPreApproval(partyId: string): Promise<void>
  getBalance(partyId: string, assetId: AssetId): Promise<BalanceResult>
  listUTXOs(partyId: string): Promise<UTXOResult[]>
  selectUTXOs(partyId: string, amount: number, assetId: AssetId): Promise<UTXOResult[]>
  executeTransfer(input: ExecuteTransferInput): Promise<TransferResult>
  getTransferStatus(updateId: string): Promise<TransferResult>
  getProofOfTransfer(updateId: string): Promise<ProofOfTransferResult>
  createInvoiceContract(input: CreateInvoiceInput): Promise<ContractResult>
  approveInvoiceContract(input: ApproveInvoiceInput): Promise<ContractResult>
  rejectInvoiceContract(input: RejectInvoiceInput): Promise<ContractResult>
  createBatchContract(input: CreateBatchInput): Promise<ContractResult>
  createReceiptContract(input: CreateReceiptInput): Promise<ContractResult>
  estimateTrafficCost(input: TrafficEstimateInput): Promise<TrafficEstimateResult>
  tapDevNet?(partyId: string, amount: string): Promise<void>
}
