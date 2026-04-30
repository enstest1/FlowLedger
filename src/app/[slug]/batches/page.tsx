import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { StatusBadge } from '@/components/status-badge'
import { formatAmount } from '@/lib/utils'
import { format } from 'date-fns'
import Link from 'next/link'
import { Plus, Package } from 'lucide-react'

export default async function BatchesPage({
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

  const batches = await prisma.payrollBatch.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: { createdAt: 'desc' },
  })

  const canCreate = ['ADMIN', 'TREASURY'].includes(membership.role)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Payroll Batches</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {batches.length} batch{batches.length !== 1 ? 'es' : ''}
          </p>
        </div>
        {canCreate && (
          <Link
            href={`/${slug}/batches/new`}
            className="flex items-center gap-1.5 bg-[#2d5a4f] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#234740] transition-colors"
          >
            <Plus size={14} />
            New Batch
          </Link>
        )}
      </div>

      {batches.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 p-16 text-center">
          <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package size={20} className="text-zinc-400" />
          </div>
          <h3 className="font-semibold text-zinc-900 mb-2">No batches yet</h3>
          <p className="text-sm text-zinc-500 mb-4">
            Create a payroll batch to settle multiple approved invoices at once.
          </p>
          {canCreate && (
            <Link
              href={`/${slug}/batches/new`}
              className="inline-flex items-center gap-1.5 bg-[#2d5a4f] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#234740] transition-colors"
            >
              <Plus size={14} />
              New Batch
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Batch
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Asset
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Executed
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr
                  key={batch.id}
                  className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-zinc-900">
                      {batch.name}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-700">
                    {batch.assetId}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                    {formatAmount(batch.totalAmount, batch.assetId)}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-700">
                    {batch.itemCount}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={batch.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {batch.executedAt
                      ? format(new Date(batch.executedAt), 'MMM d, yyyy')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/${slug}/batches/${batch.id}`}
                      className="text-xs text-[#2d5a4f] hover:text-[#234740] font-medium"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
