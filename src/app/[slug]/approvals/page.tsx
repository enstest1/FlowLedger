import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { StatusBadge } from '@/components/status-badge'
import { formatAmount } from '@/lib/utils'
import { format } from 'date-fns'
import Link from 'next/link'
import { CheckSquare, Check, X, AlertCircle } from 'lucide-react'
import { approveInvoice, rejectInvoice } from '@/app/actions/invoice'

export default async function ApprovalsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organization: { slug } },
  })
  if (!membership) redirect('/')
  if (!['ADMIN', 'APPROVER'].includes(membership.role)) {
    redirect(`/${slug}/dashboard`)
  }

  const pendingInvoices = await prisma.invoice.findMany({
    where: {
      organizationId: membership.organizationId,
      status: 'PENDING_APPROVAL',
    },
    include: { vendor: true },
    orderBy: [{ dueDate: 'asc' }, { amount: 'desc' }],
  })

  const now = new Date()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Approvals</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {pendingInvoices.length} invoice{pendingInvoices.length !== 1 ? 's' : ''} pending approval
        </p>
      </div>

      {pendingInvoices.length === 0 ? (
        <div className="bg-card border border-border p-16 text-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckSquare size={20} className="text-emerald-500" />
          </div>
          <h3 className="font-semibold text-foreground mb-2">All caught up!</h3>
          <p className="text-sm text-muted-foreground">
            No invoices waiting for approval.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingInvoices.map((invoice) => {
            const isOverdue = new Date(invoice.dueDate) < now
            return (
              <div
                key={invoice.id}
                className="bg-card border border-border p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/${slug}/invoices/${invoice.id}`}
                        className="text-base font-semibold text-foreground hover:text-purple-600 transition-colors"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                      <StatusBadge status={invoice.status} />
                      {isOverdue && (
                        <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                          <AlertCircle size={11} />
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {invoice.description}
                    </p>
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground/70 text-xs">Vendor</span>
                        <p className="font-medium text-foreground">
                          {invoice.vendor.name}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground/70 text-xs">Amount</span>
                        <p className="font-semibold text-foreground">
                          {formatAmount(invoice.amount, invoice.assetId)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground/70 text-xs">Due</span>
                        <p
                          className={`font-medium ${isOverdue ? 'text-red-600' : 'text-foreground'}`}
                        >
                          {format(new Date(invoice.dueDate), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <form
                      action={async () => {
                        'use server'
                        await approveInvoice(invoice.id)
                      }}
                    >
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                      >
                        <Check size={14} />
                        Approve
                      </button>
                    </form>
                    <form
                      action={async () => {
                        'use server'
                        await rejectInvoice(invoice.id, 'Rejected')
                      }}
                    >
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                      >
                        <X size={14} />
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
