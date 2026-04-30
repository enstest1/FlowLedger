// startup-check.ts — runs on app boot in testnet/mainnet mode.
//
// Called from index.ts after adapter initialization. Checks five critical
// system requirements and logs clear warnings for any issues found.
//
// All checks are wrapped in try/catch. A failed check NEVER throws — it only
// logs a warning. Startup checks are advisory only.

import type { CantonAdapter } from './types'

// ---------------------------------------------------------------------------
// runStartupChecks
// ---------------------------------------------------------------------------

/**
 * runStartupChecks — performs five boot-time checks and logs a summary.
 *
 * Check 1: Featured App Status — verifies FeaturedAppRight contract exists
 * Check 2: Wallet Proxy Template — verifies WalletUserProxy template available
 * Check 3: Treasury Balance — warns if USDCX < 100 or CC < 50
 * Check 4: Traffic Balance — warns if < 10MB remaining
 * Check 5: Pre-approval Status — logs counts of active/expiring/expired vendors
 *
 * @param adapter  The active CantonAdapter instance
 * @param prismaClient  Optional Prisma client (falls back to @/lib/prisma singleton)
 */
export async function runStartupChecks(
  adapter?: CantonAdapter,
  prismaClient?: import('@prisma/client').PrismaClient
): Promise<void> {
  console.log('[Startup] Running Canton startup checks...')

  const results: Record<string, 'OK' | 'WARN' | 'SKIP'> = {}

  // ── Check 1: Featured App Status ──────────────────────────────────────────

  try {
    const { MainNetCantonAdapter } = await import('./mainnet-adapter')
    const isMainNet = adapter instanceof MainNetCantonAdapter

    if (isMainNet) {
      const mainNetAdapter = adapter as InstanceType<typeof MainNetCantonAdapter>
      const isActive = await mainNetAdapter.checkFeaturedAppStatus()

      if (!isActive) {
        const providerParty = process.env.CANTON_APP_PROVIDER_PARTY ?? '(not set)'
        console.warn(
          `[Startup] WARNING: No FeaturedAppRight contract found for party ${providerParty}. ` +
            'Activity markers will be created but rewards will not be earned until featured app ' +
            'status is approved at canton.foundation/featured-app-request'
        )
        results['featured-app-status'] = 'WARN'
      } else {
        console.log('[Startup] Featured App Status: ACTIVE')
        results['featured-app-status'] = 'OK'
      }
    } else {
      results['featured-app-status'] = 'SKIP'
    }
  } catch (err) {
    console.warn('[Startup] Check 1 (Featured App Status) failed:', err)
    results['featured-app-status'] = 'WARN'
  }

  // ── Check 2: Wallet Proxy Template ────────────────────────────────────────

  try {
    const validatorUrl = (process.env.CANTON_VALIDATOR_URL ?? '').replace(/\/$/, '')
    const templateId = process.env.CANTON_WALLET_PROXY_TEMPLATE_ID

    if (!validatorUrl) {
      results['wallet-proxy-template'] = 'SKIP'
    } else {
      const { getCantonToken } = await import('./canton-auth')
      const token = await getCantonToken()

      const res = await fetch(`${validatorUrl}/v0/validator/templates`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })

      let templateAvailable = false

      if (res.ok) {
        const data = (await res.json()) as { templates?: string[] }
        const templates: string[] = data.templates ?? []
        if (templateId) {
          templateAvailable = templates.some((t) => t.includes(templateId) || t.includes('WalletUserProxy'))
        } else {
          templateAvailable = templates.some((t) => t.includes('WalletUserProxy'))
        }
      }

      if (!templateAvailable) {
        console.warn(
          '[Startup] WARNING: WalletUserProxy template not available. ' +
            'Proxied transfers will fall back to direct transfers without reward markers.'
        )
        results['wallet-proxy-template'] = 'WARN'
      } else {
        console.log('[Startup] WalletUserProxy template: AVAILABLE')
        results['wallet-proxy-template'] = 'OK'
      }
    }
  } catch (err) {
    console.warn('[Startup] Check 2 (Wallet Proxy Template) failed:', err)
    results['wallet-proxy-template'] = 'WARN'
  }

  // ── Check 3: Treasury Balance ─────────────────────────────────────────────

  try {
    const partyId = process.env.CANTON_PARTY_ID

    if (!adapter || !partyId) {
      results['treasury-balance'] = 'SKIP'
    } else {
      const [usdcxBalance, ccBalance] = await Promise.all([
        adapter.getBalance(partyId, 'USDCX'),
        adapter.getBalance(partyId, 'CC'),
      ])

      const lowUSDCX = usdcxBalance.amount < 100
      const lowCC = ccBalance.amount < 50

      if (lowUSDCX || lowCC) {
        console.warn(
          `[Startup] WARNING: Low treasury balance. ` +
            `USDCX: ${usdcxBalance.amount.toFixed(2)}, CC: ${ccBalance.amount.toFixed(4)}. ` +
            'Top up before executing batches.'
        )
        results['treasury-balance'] = 'WARN'
      } else {
        console.log(
          `[Startup] Treasury Balance: USDCX ${usdcxBalance.amount.toFixed(2)}, CC ${ccBalance.amount.toFixed(4)}`
        )
        results['treasury-balance'] = 'OK'
      }
    }
  } catch (err) {
    console.warn('[Startup] Check 3 (Treasury Balance) failed:', err)
    results['treasury-balance'] = 'WARN'
  }

  // ── Check 4: Traffic Balance ──────────────────────────────────────────────

  try {
    const validatorUrl = process.env.CANTON_VALIDATOR_URL

    if (!validatorUrl) {
      results['traffic-balance'] = 'SKIP'
    } else {
      const { RewardTracker } = await import('./reward-tracker')
      const tracker = new RewardTracker()
      const traffic = await tracker.getTrafficBalance()

      const TEN_MB = 10_000_000

      if (traffic.bytesRemaining < TEN_MB) {
        const mbRemaining = (traffic.bytesRemaining / 1_000_000).toFixed(2)
        console.warn(
          `[Startup] WARNING: Low traffic balance (${mbRemaining}MB remaining). ` +
            'Transactions may fail. Top up CC to increase traffic budget.'
        )
        results['traffic-balance'] = 'WARN'
      } else {
        const mbRemaining = (traffic.bytesRemaining / 1_000_000).toFixed(2)
        console.log(`[Startup] Traffic Balance: ${mbRemaining}MB remaining`)
        results['traffic-balance'] = 'OK'
      }
    }
  } catch (err) {
    console.warn('[Startup] Check 4 (Traffic Balance) failed:', err)
    results['traffic-balance'] = 'WARN'
  }

  // ── Check 5: Pre-approval Status ──────────────────────────────────────────

  try {
    // Use provided client or fall back to the shared singleton
    let prisma = prismaClient
    if (!prisma) {
      const mod = await import('@/lib/prisma')
      prisma = mod.prisma as unknown as import('@prisma/client').PrismaClient
    }

    const now = new Date()
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

    // Active pre-approvals
    const activeCount = await (prisma as unknown as { vendor: { count: (args: unknown) => Promise<number> } }).vendor.count({
      where: { preApprovalStatus: 'ACTIVE', preApprovalExpiry: { gt: fourteenDaysFromNow } },
    })

    // Expiring soon (active but within 14 days)
    const expiringCount = await (prisma as unknown as { vendor: { count: (args: unknown) => Promise<number> } }).vendor.count({
      where: {
        preApprovalStatus: 'ACTIVE',
        preApprovalExpiry: { gt: now, lte: fourteenDaysFromNow },
      },
    })

    // Expired
    const expiredCount = await (prisma as unknown as { vendor: { count: (args: unknown) => Promise<number> } }).vendor.count({
      where: {
        OR: [
          { preApprovalStatus: 'EXPIRED' },
          { preApprovalStatus: 'ACTIVE', preApprovalExpiry: { lte: now } },
        ],
      },
    })

    console.log(
      `[Startup] Pre-approval Status: ${activeCount} active, ` +
        `${expiringCount} expiring within 14 days, ${expiredCount} expired`
    )

    if (expiredCount > 0 || expiringCount > 0) {
      results['pre-approval-status'] = 'WARN'
    } else {
      results['pre-approval-status'] = 'OK'
    }
  } catch (err) {
    console.warn('[Startup] Check 5 (Pre-approval Status) failed:', err)
    results['pre-approval-status'] = 'WARN'
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const okCount = Object.values(results).filter((v) => v === 'OK').length
  const warnCount = Object.values(results).filter((v) => v === 'WARN').length
  const skipCount = Object.values(results).filter((v) => v === 'SKIP').length

  console.log(
    `[Startup] Startup checks complete: ${okCount} OK, ${warnCount} WARN, ${skipCount} SKIP`
  )

  if (warnCount > 0) {
    console.log('[Startup] Review warnings above before processing live payments.')
  } else if (okCount > 0) {
    console.log('[Startup] All checks passed. FlowLedger Canton integration ready.')
  }
}
