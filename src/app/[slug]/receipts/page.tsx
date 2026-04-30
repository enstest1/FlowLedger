import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { formatAmount } from '@/lib/utils'
import { format } from 'date-fns'
import Link from 'next/link'
import { Receipt } from 'lucide-react'

export default async function ReceiptsPage({
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

  const receipts = await prisma.paymentReceipt.findMany({
    where: {
      invoice: { organizationId: membership.organizationId },
    },
    include: {
      invoice: { include: { vendor: true } },
    },
    orderBy: { paidAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Receipts</h1>
        <p className="text-zinc-500 text-sm mt-0.5">
          {receipts.length} payment receipt{receipts.length !== 1 ? 's' : ''}
        </p>
      </div>

      {receipts.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 p-16 text-center">
          <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Receipt size={20} className="text-zinc-400" />
          </div>
          <h3 className="font-semibold text-zinc-900 mb-2">No receipts yet</h3>
          <p className="text-sm text-zinc-500">
            Receipts are generated when invoices are paid via a batch.
          </p>
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
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Canton Update ID
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Paid At
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr
                  key={receipt.id}
                  className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/${slug}/invoices/${receipt.invoiceId}`}
                      className="text-sm font-medium text-[#2d5a4f] hover:text-[#234740]"
                    >
                      {receipt.invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-700">
                    {receipt.invoice.vendor.name}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900 text-right">
                    {formatAmount(receipt.amount, receipt.assetId)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-zinc-500 max-w-xs block truncate">
                      {receipt.updateId}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {format(new Date(receipt.paidAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/${slug}/receipts/${receipt.id}`}
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
