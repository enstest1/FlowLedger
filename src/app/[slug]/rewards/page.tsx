import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RewardTracker } from '@/lib/canton/reward-tracker'
import type { ReactNode } from 'react'

interface RewardsPageProps {
  params: Promise<{ slug: string }>
}

function StatusBadge({
  status,
  label,
}: {
  status: 'green' | 'amber' | 'red' | 'gray'
  label: string
}) {
  const colors = {
    green: 'bg-[#ebefe9] text-[#2d5a4f]',
    amber: 'bg-amber-50 text-amber-800',
    red: 'bg-red-50 text-red-700',
    gray: 'bg-zinc-100 text-zinc-500',
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-bold tracking-wide ${colors[status]}`}
    >
      {label}
    </span>
  )
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string | ReactNode
  sub?: string | ReactNode
}) {
  return (
    <div className="border border-zinc-200 rounded-md p-4 bg-white">
      <p className="text-[11px] text-zinc-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  )
}

export default async function RewardsPage({ params }: RewardsPageProps) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const org = await prisma.organization.findUnique({ where: { slug } })
  if (!org) redirect('/')

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: org.id },
  })
  if (!membership || !['ADMIN', 'TREASURY'].includes(membership.role)) {
    redirect(`/${slug}/dashboard`)
  }

  // ── Data fetches ──────────────────────────────────────────────────────────

  // Card 1: Estimated CC earned this month — from RewardTracker
  let estimatedCCThisRound = 0
  let currentRound = 0
  try {
    const rewardTracker = new RewardTracker()
    const mintingStatus = await rewardTracker.getMintingStatus()
    estimatedCCThisRound = mintingStatus.estimatedCCThisRound
    currentRound = mintingStatus.currentRound
  } catch {
    // Silently fall back to 0 — mock mode or no validator configured
  }

  // Card 2: Activity markers created in this org
  const activityMarkerCount = await prisma.paymentReceipt.count({
    where: {
      invoice: { organizationId: org.id },
      activityMarkerContractId: { not: null },
    },
  })

  // Card 3: Active wallet proxies in this org
  const activeProxyCount = await prisma.vendor.count({
    where: { organizationId: org.id, walletProxyStatus: 'ACTIVE' },
  })

  // Card 4: Featured App Status — from env
  const featuredAppContractId = process.env.CANTON_FEATURED_APP_RIGHT_CONTRACT_ID ?? ''
  const featuredAppActive = !!featuredAppContractId

  // Reward history
  const rewardSummaries = await prisma.rewardSummary.findMany({
    where: { organizationId: org.id },
    orderBy: { periodStart: 'desc' },
    take: 24,
  })

  // Network stats — estimated monthly rewards at 100 txns/month
  let projectedMonthlyCC = 0
  let projectedMonthlyUSD = 0
  let networkTPS = 0
  let appTransactionShare = 0
  try {
    const rewardTracker = new RewardTracker()
    const estimate = await rewardTracker.estimateMonthlyRewards(100)
    projectedMonthlyCC = estimate.projectedMonthlyCC
    projectedMonthlyUSD = estimate.projectedMonthlyUSD
    networkTPS = estimate.networkTPS
    appTransactionShare = estimate.appTransactionShare
  } catch {
    // Fall back to zeros in mock mode
  }

  // Vendor proxy status
  const vendors = await prisma.vendor.findMany({
    where: { organizationId: org.id },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      cantonPartyId: true,
      walletProxyStatus: true,
      walletProxyContractId: true,
      walletProxyCreatedAt: true,
    },
  })

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">CC Rewards</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Canton Network featured app reward earnings for {org.name}
        </p>
      </div>

      {/* Summary cards — 2x2 grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <SummaryCard
          label="Estimated CC Earned This Round"
          value={
            estimatedCCThisRound > 0
              ? estimatedCCThisRound.toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                })
              : '0'
          }
          sub={
            currentRound > 0
              ? `Round ${currentRound} · Canton consensus round`
              : 'No validator connected'
          }
        />

        <SummaryCard
          label="Activity Markers Created"
          value={activityMarkerCount.toLocaleString()}
          sub="FeaturedAppActivityMarker contracts on-chain"
        />

        <SummaryCard
          label="Active Wallet Proxies"
          value={activeProxyCount.toLocaleString()}
          sub={`of ${vendors.length} vendor${vendors.length !== 1 ? 's' : ''} total`}
        />

        <SummaryCard
          label="Featured App Status"
          value={
            featuredAppActive ? (
              <StatusBadge status="green" label="ACTIVE" />
            ) : (
              <StatusBadge status="amber" label="PENDING" />
            )
          }
          sub={
            featuredAppActive ? (
              <span className="font-mono text-[10px] text-zinc-400 break-all">
                {featuredAppContractId.slice(0, 32)}...
              </span>
            ) : (
              <a
                href="https://canton.foundation/featured-app-request"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2d5a4f] underline underline-offset-2"
              >
                Apply at canton.foundation/featured-app-request
              </a>
            )
          }
        />
      </div>

      {/* Reward History */}
      <div className="mb-8">
        <h2 className="text-sm font-bold text-zinc-900 mb-3 uppercase tracking-wider">
          Reward History
        </h2>
        {rewardSummaries.length === 0 ? (
          <div className="border border-zinc-200 rounded-md p-6 bg-white text-center">
            <p className="text-sm text-zinc-500">
              No reward periods recorded yet. Rewards begin accumulating after your first MainNet
              payment batch.
            </p>
          </div>
        ) : (
          <div className="border border-zinc-200 rounded-md overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Transactions
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Reward Coupons
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Est. CC Earned
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Est. USD Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {rewardSummaries.map((summary, i) => (
                  <tr
                    key={summary.id}
                    className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700">
                      {summary.periodStart.toLocaleDateString()} –{' '}
                      {summary.periodEnd.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-zinc-700">
                      {summary.totalTransactions.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-zinc-700">
                      {summary.totalRewardCoupons.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-zinc-700">
                      {summary.estimatedCCEarned.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}{' '}
                      CC
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-zinc-700">
                      ${summary.estimatedUSDValue.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Network Stats */}
      <div className="mb-8">
        <h2 className="text-sm font-bold text-zinc-900 mb-3 uppercase tracking-wider">
          Network Context
        </h2>
        <div className="border border-zinc-200 rounded-md p-5 bg-white">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">How Rewards Work</p>
              <p className="text-xs text-zinc-600 leading-relaxed">
                From January 2026, 62% of total Canton Network rewards (approx. 516 million CC/month)
                are distributed to featured apps proportionally based on transaction activity.
              </p>
              <p className="text-xs text-zinc-600 leading-relaxed mt-2">
                Each payment batch execution creates one or more FeaturedAppActivityMarker contracts
                on-chain. The Canton DSO counts these each consensus round and distributes CC rewards
                accordingly.
              </p>
              <p className="text-xs text-zinc-400 mt-3">
                Monitor live CC/USD rate at{' '}
                <a
                  href="https://canton.thetie.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2d5a4f] underline underline-offset-2"
                >
                  canton.thetie.io
                </a>
              </p>
            </div>

            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">
                Projected Earnings (example: 100 txns/month)
              </p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500">Network TPS</span>
                  <span className="font-mono text-xs text-zinc-700">
                    {networkTPS > 0 ? `${networkTPS.toFixed(2)} TPS` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500">App Share (100 txns/mo)</span>
                  <span className="font-mono text-xs text-zinc-700">
                    {appTransactionShare > 0
                      ? `${(appTransactionShare * 100).toExponential(2)}%`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500">Projected CC/month</span>
                  <span className="font-mono text-xs text-zinc-700">
                    {projectedMonthlyCC > 0
                      ? projectedMonthlyCC.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-zinc-100 pt-2">
                  <span className="text-xs text-zinc-500">Projected USD/month</span>
                  <span className="font-mono text-xs font-bold text-zinc-800">
                    {projectedMonthlyUSD > 0
                      ? `$${projectedMonthlyUSD.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}`
                      : 'N/A'}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-zinc-400 mt-3">
                USD estimate uses 0.004 USD/CC placeholder. Actual value depends on live CC rate.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Vendor Proxy Status */}
      <div>
        <h2 className="text-sm font-bold text-zinc-900 mb-3 uppercase tracking-wider">
          Vendor Wallet Proxy Status
        </h2>
        {vendors.length === 0 ? (
          <div className="border border-zinc-200 rounded-md p-6 bg-white text-center">
            <p className="text-sm text-zinc-500">No vendors yet.</p>
          </div>
        ) : (
          <div className="border border-zinc-200 rounded-md overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Canton Party ID
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Wallet Proxy
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Proxy Contract ID
                  </th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor, i) => {
                  const proxyStatus = vendor.walletProxyStatus ?? 'PENDING'
                  const badgeStatus: 'green' | 'amber' | 'red' | 'gray' =
                    proxyStatus === 'ACTIVE'
                      ? 'green'
                      : proxyStatus === 'EXPIRED'
                      ? 'red'
                      : 'amber'

                  const truncatedPartyId =
                    vendor.cantonPartyId.length > 20
                      ? `${vendor.cantonPartyId.slice(0, 20)}...`
                      : vendor.cantonPartyId

                  const truncatedContractId = vendor.walletProxyContractId
                    ? vendor.walletProxyContractId.length > 20
                      ? `${vendor.walletProxyContractId.slice(0, 20)}...`
                      : vendor.walletProxyContractId
                    : null

                  return (
                    <tr
                      key={vendor.id}
                      className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}
                    >
                      <td className="px-4 py-3 text-sm text-zinc-800 font-medium">
                        {vendor.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500" title={vendor.cantonPartyId}>
                        {truncatedPartyId}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={badgeStatus} label={proxyStatus} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                        {truncatedContractId ? (
                          <span title={vendor.walletProxyContractId ?? ''}>
                            {truncatedContractId}
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
