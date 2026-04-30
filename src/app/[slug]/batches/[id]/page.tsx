import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { StatusBadge } from '@/components/status-badge'
import { formatAmount } from '@/lib/utils'
import { format } from 'date-fns'
import Link from 'next/link'
import { ArrowLeft, Zap } from 'lucide-react'
import { BatchExecuteButton } from './batch-execute-button'

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organization: { slug } },
  })
  if (!membership) redirect('/')

  const batch = await prisma.payrollBatch.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          invoice: { include: { vendor: true, receipt: true } },
        },
      },
    },
  })

  if (!batch || batch.organizationId !== membership.organizationId) notFound()

  const canExecute =
    ['ADMIN', 'TREASURY'].includes(membership.role) &&
    batch.status === 'DRAFT'

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/batches`}
          className="text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900">{batch.name}</h1>
            <StatusBadge status={batch.status} />
          </div>
          <p className="text-zinc-500 text-sm mt-0.5">
            {batch.itemCount} invoice{batch.itemCount !== 1 ? 's' : ''} ·{' '}
            {formatAmount(batch.totalAmount, batch.assetId)}
          </p>
        </div>
      </div>

      {/* Batch details */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <p className="text-xs text-zinc-400 mb-1">Total Amount</p>
          <p className="text-xl font-bold text-zinc-900">
            {formatAmount(batch.totalAmount, batch.assetId)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <p className="text-xs text-zinc-400 mb-1">Created</p>
          <p className="text-sm font-medium text-zinc-900">
            {format(new Date(batch.createdAt), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <p className="text-xs text-zinc-400 mb-1">
            {batch.executedAt ? 'Executed' : 'Status'}
          </p>
          <p className="text-sm font-medium text-zinc-900">
            {batch.executedAt
              ? format(new Date(batch.executedAt), 'MMM d, yyyy h:mm a')
              : batch.status}
          </p>
        </div>
      </div>

      {/* Execute button */}
      {canExecute && (
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-zinc-900">Execute Batch</h2>
              <p className="text-sm text-zinc-500 mt-0.5">
                This will settle {batch.itemCount} invoice{batch.itemCount !== 1 ? 's' : ''} on the Canton Network.
              </p>
            </div>
            <BatchExecuteButton batchId={batch.id} slug={slug} />
          </div>
        </div>
      )}

      {batch.failureReason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-medium text-red-700">Failure Reason</p>
          <p className="text-sm text-red-600 mt-0.5">{batch.failureReason}</p>
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="p-5 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Batch Items</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Invoice
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Vendor
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Status
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Receipt
              </th>
            </tr>
          </thead>
          <tbody>
            {batch.items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/${slug}/invoices/${item.invoiceId}`}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    {item.invoice.invoiceNumber}
                  </Link>
                  <p className="text-xs text-zinc-400 max-w-xs truncate">
                    {item.invoice.description}
                  </p>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-700">
                  {item.invoice.vendor.name}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-zinc-900 text-right">
                  {formatAmount(item.amount, batch.assetId)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {item.invoice.receipt && (
                    <Link
                      href={`/${slug}/receipts/${item.invoice.receipt.id}`}
                      className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                    >
                      View
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Canton Contract */}
      {batch.cantonContractId && (
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <h2 className="text-sm font-semibold text-zinc-700 mb-2">
            Canton Batch Contract
          </h2>
          <p className="text-xs font-mono text-zinc-600 break-all">
            {batch.cantonContractId}
          </p>
        </div>
      )}
    </div>
  )
}
