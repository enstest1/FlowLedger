import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getCantonAdapter } from '@/lib/canton'
import { formatAmount } from '@/lib/utils'
import { StatusBadge } from '@/components/status-badge'
import { format } from 'date-fns'
import Link from 'next/link'
import {
  FileText,
  CheckSquare,
  TrendingUp,
  Wallet,
  Plus,
  AlertCircle,
} from 'lucide-react'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organization: { slug } },
    include: { organization: true },
  })
  if (!membership) redirect('/')

  const org = membership.organization
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [pendingInvoices, awaitingApproval, paidThisMonth, recentAuditEvents, upcomingDue] =
    await Promise.all([
      prisma.invoice.findMany({
        where: { organizationId: org.id, status: { notIn: ['PAID', 'CANCELLED'] } },
      }),
      prisma.invoice.findMany({
        where: { organizationId: org.id, status: 'PENDING_APPROVAL' },
      }),
      prisma.invoice.findMany({
        where: {
          organizationId: org.id,
          status: 'PAID',
          updatedAt: { gte: startOfMonth },
        },
      }),
      prisma.auditEvent.findMany({
        where: { organizationId: org.id },
        include: { actor: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.invoice.findMany({
        where: {
          organizationId: org.id,
          status: { notIn: ['PAID', 'CANCELLED', 'REJECTED'] },
          dueDate: { lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
        },
        include: { vendor: true },
        orderBy: { dueDate: 'asc' },
      }),
    ])

  const adapter = getCantonAdapter()
  let balance = 0
  try {
    const bal = await adapter.getBalance(org.treasuryPartyId, org.defaultAsset as 'USDCX' | 'CC')
    balance = bal.amount
  } catch {
    balance = 0
  }

  const pendingTotal = pendingInvoices.reduce((sum, i) => sum + i.amount, 0)
  const paidTotal = paidThisMonth.reduce((sum, i) => sum + i.amount, 0)

  const stats = [
    {
      label: 'Pending',
      value: pendingInvoices.length.toString(),
      sub: formatAmount(pendingTotal, org.defaultAsset),
      icon: FileText,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
    },
    {
      label: 'Awaiting Approval',
      value: awaitingApproval.length.toString(),
      sub: `${awaitingApproval.length} invoice${awaitingApproval.length !== 1 ? 's' : ''}`,
      icon: CheckSquare,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-100',
    },
    {
      label: 'Paid This Month',
      value: formatAmount(paidTotal, org.defaultAsset),
      sub: `${paidThisMonth.length} payment${paidThisMonth.length !== 1 ? 's' : ''}`,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
    },
    {
      label: 'Treasury Balance',
      value: formatAmount(balance, org.defaultAsset),
      sub: 'Available',
      icon: Wallet,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      border: 'border-sky-100',
    },
  ]

  const auditLabels: Record<string, string> = {
    ORG_CREATED: 'Organization created',
    VENDOR_ADDED: 'Vendor added',
    INVOICE_SUBMITTED: 'Invoice submitted',
    INVOICE_APPROVED: 'Invoice approved',
    INVOICE_REJECTED: 'Invoice rejected',
    INVOICE_CANCELLED: 'Invoice cancelled',
    BATCH_CREATED: 'Batch created',
    BATCH_EXECUTED: 'Batch executed',
    VENDOR_PRE_APPROVAL_RENEWED: 'Pre-approval renewed',
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Dashboard</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {session.user.name || session.user.email?.split('@')[0]}
          </p>
        </div>
        {/* Von Restorff + Fitts's Law: primary CTA is visually dominant */}
        <Link
          href={`/${slug}/invoices/new`}
          className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2.5 rounded-md text-sm font-bold hover:bg-indigo-700 transition-colors"
        >
          <Plus size={14} />
          New Invoice
        </Link>
      </div>

      {/* Stats — Miller's Law: exactly 4 chunks, each bounded (Law of Common Region) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.label}
              className={`bg-white rounded-md border ${s.border} p-4`}
            >
              <div className={`w-8 h-8 ${s.bg} rounded flex items-center justify-center mb-3`}>
                <Icon size={16} className={s.color} />
              </div>
              <p className="text-xl font-bold text-zinc-900 leading-none">{s.value}</p>
              <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-wider">{s.label}</p>
              <p className="text-xs text-zinc-500 mt-1">{s.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Panels — Law of Common Region: two clearly bounded panels */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Upcoming Due Dates */}
        <div className="bg-white rounded-md border border-zinc-200 p-5">
          <h2 className="text-sm font-bold text-zinc-900 mb-4">Upcoming Due</h2>
          {upcomingDue.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-8">
              No invoices due in the next 14 days
            </p>
          ) : (
            <div className="space-y-1">
              {upcomingDue.map((inv) => {
                const isOverdue = new Date(inv.dueDate) < now
                return (
                  /* Fitts's Law: full-row click target */
                  <Link
                    key={inv.id}
                    href={`/${slug}/invoices/${inv.id}`}
                    className="flex items-center justify-between px-2 py-2.5 rounded hover:bg-zinc-50 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isOverdue && (
                        <AlertCircle size={12} className="text-red-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-900 truncate">
                          {inv.invoiceNumber}
                        </p>
                        <p className="text-[10px] text-zinc-400 truncate">{inv.vendor.name}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-xs font-bold text-zinc-900">
                        {formatAmount(inv.amount, inv.assetId)}
                      </p>
                      <p className={`text-[10px] font-bold ${isOverdue ? 'text-red-500' : 'text-zinc-400'}`}>
                        {isOverdue ? 'OVERDUE' : format(new Date(inv.dueDate), 'MMM d')}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-md border border-zinc-200 p-5">
          <h2 className="text-sm font-bold text-zinc-900 mb-4">Recent Activity</h2>
          {recentAuditEvents.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-8">No activity yet</p>
          ) : (
            <div className="space-y-1">
              {recentAuditEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 px-2 py-2.5">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-700 truncate">
                      {auditLabels[event.eventType] ?? event.eventType}
                    </p>
                    <p className="text-[10px] text-zinc-400 truncate">
                      {event.actor?.name || event.actor?.email || 'System'}
                      {' · '}
                      {format(new Date(event.createdAt), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <StatusBadge
                    status={
                      event.eventType.includes('APPROVED')
                        ? 'APPROVED'
                        : event.eventType.includes('REJECTED')
                        ? 'REJECTED'
                        : event.eventType.includes('PAID')
                        ? 'PAID'
                        : 'ACTIVE'
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
