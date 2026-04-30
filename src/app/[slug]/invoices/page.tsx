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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Invoices</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <Link
            href={`/${slug}/invoices/new`}
            className="flex items-center gap-1.5 bg-[#2d5a4f] text-white px-4 py-2.5 rounded-md text-sm font-bold hover:bg-[#234740] transition-colors"
          >
            <Plus size={14} />
            New Invoice
          </Link>
        )}
      </div>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-md border border-zinc-200 p-16 text-center">
          <div className="w-10 h-10 bg-zinc-100 rounded flex items-center justify-center mx-auto mb-4">
            <FileText size={18} className="text-zinc-400" />
          </div>
          <h3 className="font-bold text-zinc-900 mb-1 text-sm">No invoices yet</h3>
          <p className="text-xs text-zinc-500 mb-5">
            Create your first invoice to start the payment workflow.
          </p>
          {canCreate && (
            <Link
              href={`/${slug}/invoices/new`}
              className="inline-flex items-center gap-1.5 bg-[#2d5a4f] text-white px-4 py-2.5 rounded-md text-sm font-bold hover:bg-[#234740] transition-colors"
            >
              <Plus size={14} />
              New Invoice
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-md border border-zinc-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Invoice
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Vendor
                </th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Due
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {invoices.map((inv) => {
                const isOverdue =
                  new Date(inv.dueDate) < new Date() && inv.status !== 'PAID'
                return (
                  <tr
                    key={inv.id}
                    className="hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-zinc-900">
                        {inv.invoiceNumber}
                      </p>
                      {inv.description && (
                        <p className="text-[10px] text-zinc-400 max-w-xs truncate mt-0.5">
                          {inv.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">
                      {inv.vendor.name}
                    </td>
                    {/* Numbers right-aligned — Jakob's Law: tabular data convention */}
                    <td className="px-4 py-3 text-xs font-bold text-zinc-900 text-right tabular-nums">
                      {formatAmount(inv.amount, inv.assetId)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span
                        className={`text-xs font-bold ${isOverdue ? 'text-red-600' : 'text-zinc-500'}`}
                      >
                        {format(new Date(inv.dueDate), 'MMM d, yyyy')}
                        {isOverdue && (
                          <span className="ml-1 text-[10px] text-red-500">OVERDUE</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/${slug}/invoices/${inv.id}`}
                        className="text-xs text-[#2d5a4f] hover:text-[#234740] font-bold"
                      >
                        View →
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
