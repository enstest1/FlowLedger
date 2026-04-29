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
        <h1 className="text-xl font-semibold text-foreground">Receipts</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {receipts.length} payment receipt{receipts.length !== 1 ? 's' : ''}
        </p>
      </div>

      {receipts.length === 0 ? (
        <div className="bg-card border border-border p-16 text-center">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Receipt size={20} className="text-muted-foreground/70" />
          </div>
          <h3 className="font-semibold text-foreground mb-2">No receipts yet</h3>
          <p className="text-sm text-muted-foreground">
            Receipts are generated when invoices are paid via a batch.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Invoice
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Vendor
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Canton Update ID
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Paid At
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr
                  key={receipt.id}
                  className="border-b border-zinc-50 hover:bg-black/5 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/${slug}/invoices/${receipt.invoiceId}`}
                      className="text-sm font-medium text-purple-600 hover:text-purple-700"
                    >
                      {receipt.invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {receipt.invoice.vendor.name}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-foreground text-right">
                    {formatAmount(receipt.amount, receipt.assetId)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-muted-foreground max-w-xs block truncate">
                      {receipt.updateId}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {format(new Date(receipt.paidAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/${slug}/receipts/${receipt.id}`}
                      className="text-xs text-purple-600 hover:text-purple-700 font-medium"
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
