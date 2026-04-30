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

  // Get treasury balance from Canton adapter
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
      label: 'Pending Invoices',
      value: pendingInvoices.length.toString(),
      sub: formatAmount(pendingTotal, org.defaultAsset),
      icon: FileText,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Awaiting Approval',
      value: awaitingApproval.length.toString(),
      sub: `${awaitingApproval.length} invoice${awaitingApproval.length !== 1 ? 's' : ''}`,
      icon: CheckSquare,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Paid This Month',
      value: formatAmount(paidTotal, org.defaultAsset),
      sub: `${paidThisMonth.length} payment${paidThisMonth.length !== 1 ? 's' : ''}`,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Treasury Balance',
      value: formatAmount(balance, org.defaultAsset),
      sub: 'Available to pay',
      icon: Wallet,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            Welcome back,{' '}
            {session.user.name || session.user.email?.split('@')[0]}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/${slug}/invoices/new`}
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={14} />
            New Invoice
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.label}
              className="bg-white rounded-xl border border-zinc-200 p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center`}>
                  <Icon size={18} className={s.color} />
                </div>
              </div>
              <p className="text-2xl font-bold text-zinc-900">{s.value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
              <p className="text-xs text-zinc-400 mt-1">{s.sub}</p>
            </div>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming Due Dates */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <h2 className="font-semibold text-zinc-900 mb-4">Upcoming Due Dates</h2>
          {upcomingDue.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-8">
              No invoices due in the next 14 days
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingDue.map((inv) => {
                const isOverdue = new Date(inv.dueDate) < now
                return (
                  <Link
                    key={inv.id}
                    href={`/${slug}/invoices/${inv.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isOverdue && (
                        <AlertCircle size={14} className="text-red-500 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-zinc-900">
                          {inv.invoiceNumber}
                        </p>
                        <p className="text-xs text-zinc-400">{inv.vendor.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-zinc-900">
                        {formatAmount(inv.amount, inv.assetId)}
                      </p>
                      <p
                        className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-zinc-400'}`}
                      >
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
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <h2 className="font-semibold text-zinc-900 mb-4">Recent Activity</h2>
          {recentAuditEvents.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-8">
              No activity yet
            </p>
          ) : (
            <div className="space-y-2">
              {recentAuditEvents.map((event) => {
                const labels: Record<string, string> = {
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
                  <div key={event.id} className="flex items-center gap-3 py-2">
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-700 truncate">
                        {labels[event.eventType] ?? event.eventType}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {event.actor?.name || event.actor?.email || 'System'} ·{' '}
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
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
