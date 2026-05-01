import { prisma } from '@/lib/prisma'
import { RewardTracker } from '@/lib/canton/reward-tracker'
import type { ReactNode } from 'react'

function StatusBadge({ status, label }: { status: 'green' | 'amber' | 'red' | 'gray'; label: string }) {
  const colors = {
    green: 'bg-[#ebefe9] text-[#2d5a4f]',
    amber: 'bg-amber-50 text-amber-800',
    red:   'bg-red-50 text-red-700',
    gray:  'bg-zinc-100 text-zinc-500',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold tracking-wide ${colors[status]}`}>
      {label}
    </span>
  )
}

function Card({ label, value, sub }: { label: string; value: string | ReactNode; sub?: string | ReactNode }) {
  return (
    <div className="border border-zinc-200 rounded-md p-4 bg-white">
      <p className="text-[11px] text-zinc-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  )
}

export default async function AdminRewardsPage() {
  // ── Canton live data ────────────────────────────────────────────────────────
  let estimatedCCThisRound = 0
  let currentRound = 0
  let projectedMonthlyCC = 0
  let projectedMonthlyUSD = 0
  let networkTPS = 0
  try {
    const tracker = new RewardTracker()
    const [minting, estimate] = await Promise.all([
      tracker.getMintingStatus(),
      tracker.estimateMonthlyRewards(100),
    ])
    estimatedCCThisRound = minting.estimatedCCThisRound
    currentRound = minting.currentRound
    projectedMonthlyCC = estimate.projectedMonthlyCC
    projectedMonthlyUSD = estimate.projectedMonthlyUSD
    networkTPS = estimate.networkTPS
  } catch {
    // mock mode — no validator
  }

  // ── DB aggregates (all orgs) ────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let activityMarkerCount = 0
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activityMarkerCount = await (prisma.paymentReceipt as any).count({
      where: { activityMarkerContractId: { not: null } },
    })
  } catch { /* stale client */ }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let activeProxyCount = 0
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activeProxyCount = await (prisma.vendor as any).count({
      where: { walletProxyStatus: 'ACTIVE' },
    })
  } catch { /* stale client */ }

  const totalVendors = await prisma.vendor.count()
  const totalReceipts = await prisma.paymentReceipt.count()

  const featuredAppContractId = process.env.CANTON_FEATURED_APP_RIGHT_CONTRACT_ID ?? ''
  const featuredAppActive = !!featuredAppContractId

  // Reward history across all orgs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rewardSummaries: any[] = []
  try {
    rewardSummaries = await (prisma as any).rewardSummary.findMany({
      orderBy: { periodStart: 'desc' },
      take: 24,
      include: { organization: { select: { name: true, slug: true } } },
    })
  } catch { /* stale client */ }

  // All vendors with proxy status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vendors: any[] = await (prisma.vendor as any).findMany({
    orderBy: [{ walletProxyStatus: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      cantonPartyId: true,
      walletProxyStatus: true,
      walletProxyContractId: true,
      organization: { select: { name: true, slug: true } },
    },
  })

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">CC Rewards</h1>
        <p className="text-sm text-zinc-500 mt-1">
          FlowLedger featured app earnings across all customer orgs
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Card
          label="Estimated CC Earned This Round"
          value={estimatedCCThisRound > 0 ? estimatedCCThisRound.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'}
          sub={currentRound > 0 ? `Round ${currentRound} · 10-minute consensus round` : 'No validator connected — mock mode'}
        />
        <Card
          label="Activity Markers Created (all time)"
          value={activityMarkerCount.toLocaleString()}
          sub={`across ${totalReceipts.toLocaleString()} total payment receipts`}
        />
        <Card
          label="Active Wallet Proxies"
          value={activeProxyCount.toLocaleString()}
          sub={`of ${totalVendors.toLocaleString()} total vendors across all orgs`}
        />
        <Card
          label="Featured App Status"
          value={featuredAppActive ? <StatusBadge status="green" label="ACTIVE" /> : <StatusBadge status="amber" label="PENDING" />}
          sub={featuredAppActive
            ? <span className="font-mono text-[10px] text-zinc-400 break-all">{featuredAppContractId.slice(0, 40)}...</span>
            : <a href="https://canton.foundation/featured-app-request" target="_blank" rel="noopener noreferrer" className="text-[#2d5a4f] underline underline-offset-2">Apply at canton.foundation/featured-app-request</a>
          }
        />
      </div>

      {/* Network stats */}
      <div className="mb-8">
        <h2 className="text-sm font-bold text-zinc-900 mb-3 uppercase tracking-wider">Network Context</h2>
        <div className="border border-zinc-200 rounded-md p-5 bg-white">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">How It Works</p>
              <p className="text-xs text-zinc-600 leading-relaxed">
                62% of Canton Network rewards (~516M CC/month from Jan 2026) flow to featured apps.
                FlowLedger earns a share proportional to its transaction count vs total network activity.
              </p>
              <p className="text-xs text-zinc-600 leading-relaxed mt-2">
                Each batch execution creates FeaturedAppActivityMarker contracts via WalletUserProxy.
                The DSO counts these per 10-minute round and distributes CC to the provider party.
              </p>
              <p className="text-xs text-zinc-400 mt-3">
                Live CC rate:{' '}
                <a href="https://canton.thetie.io" target="_blank" rel="noopener noreferrer" className="text-[#2d5a4f] underline underline-offset-2">
                  canton.thetie.io
                </a>
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Projections (100 txns/month)</p>
              <div className="space-y-2">
                {[
                  ['Network TPS', networkTPS > 0 ? `${networkTPS.toFixed(2)} TPS` : 'N/A'],
                  ['Projected CC/month', projectedMonthlyCC > 0 ? projectedMonthlyCC.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A'],
                  ['Projected USD/month', projectedMonthlyUSD > 0 ? `$${projectedMonthlyUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : 'N/A'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">{label}</span>
                    <span className="font-mono text-xs text-zinc-700">{val}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-zinc-400 mt-3">USD estimate uses 0.004 USD/CC placeholder.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reward history */}
      <div className="mb-8">
        <h2 className="text-sm font-bold text-zinc-900 mb-3 uppercase tracking-wider">Reward History</h2>
        {rewardSummaries.length === 0 ? (
          <div className="border border-zinc-200 rounded-md p-6 bg-white text-center">
            <p className="text-sm text-zinc-500">No reward periods recorded yet. Accrues after first MainNet payment batch.</p>
          </div>
        ) : (
          <div className="border border-zinc-200 rounded-md overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  {['Period', 'Org', 'Transactions', 'Coupons', 'Est. CC', 'Est. USD'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rewardSummaries.map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700">
                      {new Date(s.periodStart).toLocaleDateString()} – {new Date(s.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-700">{s.organization?.name ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700">{s.totalTransactions.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700">{s.totalRewardCoupons.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700">{s.estimatedCCEarned.toLocaleString(undefined, { maximumFractionDigits: 4 })} CC</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700">${s.estimatedUSDValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vendor proxy status — all orgs */}
      <div>
        <h2 className="text-sm font-bold text-zinc-900 mb-3 uppercase tracking-wider">Vendor Wallet Proxy Status</h2>
        {vendors.length === 0 ? (
          <div className="border border-zinc-200 rounded-md p-6 bg-white text-center">
            <p className="text-sm text-zinc-500">No vendors yet.</p>
          </div>
        ) : (
          <div className="border border-zinc-200 rounded-md overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  {['Vendor', 'Org', 'Canton Party ID', 'Wallet Proxy', 'Proxy Contract'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendors.map((v, i) => {
                  const status = v.walletProxyStatus ?? 'PENDING'
                  const badge: 'green' | 'amber' | 'red' = status === 'ACTIVE' ? 'green' : status === 'EXPIRED' ? 'red' : 'amber'
                  return (
                    <tr key={v.id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}>
                      <td className="px-4 py-3 text-sm text-zinc-800 font-medium">{v.name}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{v.organization?.name ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400" title={v.cantonPartyId}>
                        {v.cantonPartyId.slice(0, 18)}…
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={badge} label={status} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                        {v.walletProxyContractId ? `${v.walletProxyContractId.slice(0, 18)}…` : <span className="text-zinc-300">—</span>}
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
