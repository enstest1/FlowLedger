import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { StatusBadge } from '@/components/status-badge'
import { formatAmount } from '@/lib/utils'
import { format } from 'date-fns'
import Link from 'next/link'
import { Plus, FileText } from 'lucide-react'

export default async function InvoicesPage({
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

  const invoices = await prisma.invoice.findMany({
    where: { organizationId: membership.organizationId },
    include: { vendor: true },
    orderBy: { createdAt: 'desc' },
  })

  const canCreate = ['ADMIN', 'TREASURY'].includes(membership.role)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Invoices</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <Link
            href={`/${slug}/invoices/new`}
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={14} />
            New Invoice
          </Link>
        )}
      </div>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 p-16 text-center">
          <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText size={20} className="text-zinc-400" />
          </div>
          <h3 className="font-semibold text-zinc-900 mb-2">No invoices yet</h3>
          <p className="text-sm text-zinc-500 mb-4">
            Create your first invoice to start the payment workflow.
          </p>
          {canCreate && (
            <Link
              href={`/${slug}/invoices/new`}
              className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus size={14} />
              New Invoice
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const isOverdue =
                  new Date(inv.dueDate) < new Date() && inv.status !== 'PAID'
                return (
                  <tr
                    key={inv.id}
                    className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">
                          {inv.invoiceNumber}
                        </p>
                        <p className="text-xs text-zinc-400 max-w-xs truncate">
                          {inv.description}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      {inv.vendor.name}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                      {formatAmount(inv.amount, inv.assetId)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-zinc-500'}`}
                      >
                        {format(new Date(inv.dueDate), 'MMM d, yyyy')}
                        {isOverdue && ' (Overdue)'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/${slug}/invoices/${inv.id}`}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
