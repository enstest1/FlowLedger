// RewardTracker — reads CC reward state from the Canton validator and Scan API.
//
// All methods are non-blocking: if the network call fails, they return safe defaults
// and log a warning. Never throw from a reward-tracking call.
//
// Validator API calls require auth. Scan API is public (no auth header needed).

import { getCantonToken } from './canton-auth'

export interface RewardCouponSummary {
  count: number
  estimatedCCValue: number
  oldestUnprocessed?: Date
}

export interface MintingStatus {
  currentRound: number
  isAutomationActive: boolean
  estimatedCCThisRound: number
}

export interface TrafficBalance {
  bytesRemaining: number
  estimatedTransactionsRemaining: number
  autoTopupConfigured: boolean
}

export interface RewardEstimate {
  projectedMonthlyCC: number
  projectedMonthlyUSD: number
  appTransactionShare: number
  networkTPS: number
}

// ---------------------------------------------------------------------------
// Internal response shapes
// ---------------------------------------------------------------------------

interface RewardCouponsResponse {
  reward_coupons: Array<{
    contract_id: string
    amount: string
    round?: number
    created_at?: string
  }>
  total_estimated_cc?: string
}

interface MintingStatusResponse {
  current_round: number
  is_automation_active: boolean
  estimated_cc_this_round?: string
}

interface TrafficBalanceResponse {
  bytes_remaining: number
  estimated_transactions_remaining?: number
  auto_topup_configured?: boolean
}

interface NetworkStatsResponse {
  tps?: number
  transactions_per_second?: number
  current_tps?: number
}

// ---------------------------------------------------------------------------
// RewardTracker
// ---------------------------------------------------------------------------

export class RewardTracker {
  private readonly validatorUrl: string
  private readonly scanUrl: string
  private readonly appProviderParty: string

  constructor() {
    this.validatorUrl = (process.env.CANTON_VALIDATOR_URL ?? '').replace(/\/$/, '')
    this.scanUrl = (process.env.CANTON_SCAN_URL ?? '').replace(/\/$/, '')
    this.appProviderParty = process.env.CANTON_APP_PROVIDER_PARTY ?? ''
  }

  // ── Internal HTTP helpers ────────────────────────────────────────────────

  private async validatorGet<T>(path: string): Promise<T> {
    const token = await getCantonToken()
    const res = await fetch(`${this.validatorUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`RewardTracker GET ${path} failed ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  private async scanGet<T>(path: string): Promise<T> {
    // Scan API is public — no auth required
    const res = await fetch(`${this.scanUrl}${path}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`RewardTracker Scan GET ${path} failed ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  // ── Public methods ───────────────────────────────────────────────────────

  /**
   * getAppRewardCoupons — returns the count and estimated CC value of all
   * AppRewardCoupon contracts currently held by the provider party. These
   * coupons are created by the Canton network each consensus round and are
   * redeemed automatically by the validator's reward automation.
   */
  async getAppRewardCoupons(): Promise<RewardCouponSummary> {
    try {
      if (!this.validatorUrl) {
        return { count: 0, estimatedCCValue: 0 }
      }

      const res = await this.validatorGet<RewardCouponsResponse>('/v0/wallet/reward-coupons')

      const count = res.reward_coupons?.length ?? 0

      // Use server-provided total if available; otherwise sum from individual coupons
      let estimatedCCValue = 0
      if (res.total_estimated_cc) {
        estimatedCCValue = parseFloat(res.total_estimated_cc)
      } else if (res.reward_coupons?.length) {
        estimatedCCValue = res.reward_coupons.reduce(
          (sum, c) => sum + parseFloat(c.amount ?? '0'),
          0
        )
      }

      // Find oldest unprocessed coupon
      let oldestUnprocessed: Date | undefined
      if (res.reward_coupons?.length) {
        const dates = res.reward_coupons
          .filter((c) => c.created_at)
          .map((c) => new Date(c.created_at!))
        if (dates.length > 0) {
          oldestUnprocessed = new Date(Math.min(...dates.map((d) => d.getTime())))
        }
      }

      return { count, estimatedCCValue, oldestUnprocessed }
    } catch (err) {
      console.warn('[RewardTracker] getAppRewardCoupons failed:', err)
      return { count: 0, estimatedCCValue: 0 }
    }
  }

  /**
   * getMintingStatus — returns the current consensus round, automation status,
   * and estimated CC that will be earned this round. Automation must be active
   * for coupons to be automatically redeemed into the treasury wallet.
   */
  async getMintingStatus(): Promise<MintingStatus> {
    try {
      if (!this.validatorUrl) {
        return { currentRound: 0, isAutomationActive: false, estimatedCCThisRound: 0 }
      }

      const res = await this.validatorGet<MintingStatusResponse>('/v0/wallet/minting-status')

      return {
        currentRound: res.current_round ?? 0,
        isAutomationActive: res.is_automation_active ?? false,
        estimatedCCThisRound: res.estimated_cc_this_round
          ? parseFloat(res.estimated_cc_this_round)
          : 0,
      }
    } catch (err) {
      console.warn('[RewardTracker] getMintingStatus failed:', err)
      return { currentRound: 0, isAutomationActive: false, estimatedCCThisRound: 0 }
    }
  }

  /**
   * getTrafficBalance — returns the current traffic budget remaining. Canton
   * transactions consume traffic bytes, which are funded by CC. If the balance
   * drops too low, transactions may fail. Auto-topup can be configured on the
   * validator to automatically purchase traffic when it runs low.
   */
  async getTrafficBalance(): Promise<TrafficBalance> {
    try {
      if (!this.validatorUrl) {
        return { bytesRemaining: 0, estimatedTransactionsRemaining: 0, autoTopupConfigured: false }
      }

      const res = await this.validatorGet<TrafficBalanceResponse>('/v0/wallet/traffic-balance')

      return {
        bytesRemaining: res.bytes_remaining ?? 0,
        estimatedTransactionsRemaining: res.estimated_transactions_remaining ?? 0,
        autoTopupConfigured: res.auto_topup_configured ?? false,
      }
    } catch (err) {
      console.warn('[RewardTracker] getTrafficBalance failed:', err)
      return { bytesRemaining: 0, estimatedTransactionsRemaining: 0, autoTopupConfigured: false }
    }
  }

  /**
   * estimateMonthlyRewards — estimates projected CC earnings for the month
   * based on expected transaction volume and current network TPS.
   *
   * Formula: (app_txns_per_month / total_network_txns_per_month) * 516_000_000 CC
   *
   * 516M CC/month = 62% of ~833M total CC minted per month distributed to
   * featured apps proportionally by transaction share (from Jan 2026 tokenomics).
   *
   * If the Scan API is unreachable, falls back to conservative TPS assumption of 10.
   */
  async estimateMonthlyRewards(monthlyTransactionCount: number): Promise<RewardEstimate> {
    const FEATURED_APP_POOL_CC_PER_MONTH = 516_000_000
    const FALLBACK_TPS = 10
    const SECONDS_PER_MONTH = 60 * 60 * 24 * 30

    let networkTPS = FALLBACK_TPS

    try {
      if (this.scanUrl) {
        const stats = await this.scanGet<NetworkStatsResponse>('/api/v0/network/stats')
        networkTPS =
          stats.tps ?? stats.transactions_per_second ?? stats.current_tps ?? FALLBACK_TPS
      }
    } catch (err) {
      console.warn('[RewardTracker] Scan API unavailable — using fallback TPS assumption:', err)
    }

    const networkTxnsPerMonth = networkTPS * SECONDS_PER_MONTH
    const appTransactionShare =
      networkTxnsPerMonth > 0 ? monthlyTransactionCount / networkTxnsPerMonth : 0

    const projectedMonthlyCC = appTransactionShare * FEATURED_APP_POOL_CC_PER_MONTH

    // Estimate USD value: CC (Amulet) has variable price. Use 0.004 USD/CC as a
    // conservative placeholder — monitor actual price at canton.thetie.io.
    const CC_USD_ESTIMATE = 0.004
    const projectedMonthlyUSD = projectedMonthlyCC * CC_USD_ESTIMATE

    return {
      projectedMonthlyCC,
      projectedMonthlyUSD,
      appTransactionShare,
      networkTPS,
    }
  }
}
