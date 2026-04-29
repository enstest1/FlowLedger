import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { StatusBadge } from '@/components/status-badge'
import { PartyId } from '@/components/party-id'
import { formatAmount } from '@/lib/utils'
import { format } from 'date-fns'
import Link from 'next/link'
import { ArrowLeft, Check, X, Package } from 'lucide-react'
import { approveInvoice, rejectInvoice, cancelInvoice } from '@/app/actions/invoice'

export default async function InvoiceDetailPage({
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

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      vendor: true,
      approvals: { include: { approver: true }, orderBy: { createdAt: 'asc' } },
      receipt: true,
    },
  })

  if (!invoice || invoice.organizationId !== membership.organizationId) notFound()

  const canApprove = ['ADMIN', 'APPROVER'].includes(membership.role)
  const canCancel = membership.role === 'ADMIN'
  const canAddToBatch =
    ['ADMIN', 'TREASURY'].includes(membership.role) &&
    invoice.status === 'APPROVED'

  const lineItems = invoice.lineItems
    ? JSON.parse(invoice.lineItems as string)
    : null

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/invoices`}
          className="text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">
              {invoice.invoiceNumber}
            </h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">{invoice.description}</p>
        </div>
      </div>

      {/* Actions */}
      {(canApprove && invoice.status === 'PENDING_APPROVAL') ||
      canCancel ||
      canAddToBatch ? (
        <div className="flex gap-2">
          {canApprove && invoice.status === 'PENDING_APPROVAL' && (
            <>
              <form
                action={async () => {
                  'use server'
                  await approveInvoice(id)
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
                  await rejectInvoice(id, 'Rejected by approver')
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
            </>
          )}
          {canAddToBatch && (
            <Link
              href={`/${slug}/batches/new?invoice=${id}`}
              className="flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors"
            >
              <Package size={14} />
              Add to Batch
            </Link>
          )}
          {canCancel && !['PAID', 'CANCELLED'].includes(invoice.status) && (
            <form
              action={async () => {
                'use server'
                await cancelInvoice(id)
              }}
            >
              <button
                type="submit"
                className="flex items-center gap-1.5 text-muted-foreground border border-border px-4 py-2 rounded-lg text-sm font-medium hover:bg-black/5 transition-colors"
              >
                Cancel Invoice
              </button>
            </form>
          )}
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Invoice details */}
        <div className="bg-card border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Invoice Details
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-muted-foreground/70">Vendor</dt>
              <dd className="text-sm font-medium text-foreground mt-0.5">
                {invoice.vendor.name}
              </dd>
              <dd className="text-xs text-muted-foreground/70">{invoice.vendor.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground/70">Amount</dt>
              <dd className="text-lg font-semibold text-foreground mt-0.5">
                {formatAmount(invoice.amount, invoice.assetId)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground/70">Due Date</dt>
              <dd className="text-sm text-foreground mt-0.5">
                {format(new Date(invoice.dueDate), 'MMMM d, yyyy')}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground/70">Created</dt>
              <dd className="text-sm text-foreground mt-0.5">
                {format(new Date(invoice.createdAt), 'MMMM d, yyyy h:mm a')}
              </dd>
            </div>
            {invoice.cantonContractId && (
              <div>
                <dt className="text-xs text-muted-foreground/70">Canton Contract ID</dt>
                <dd className="text-xs font-mono text-zinc-600 mt-0.5 break-all">
                  {invoice.cantonContractId}
                </dd>
              </div>
            )}
            {invoice.rejectionNote && (
              <div>
                <dt className="text-xs text-muted-foreground/70">Rejection Note</dt>
                <dd className="text-sm text-red-700 bg-red-50 px-2 py-1.5 rounded mt-0.5">
                  {invoice.rejectionNote}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Vendor Canton Party */}
        <div className="bg-card border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Canton Settlement
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-muted-foreground/70">Payee Party ID</dt>
              <dd className="mt-0.5">
                <PartyId id={invoice.vendor.cantonPartyId} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground/70">Pre-Approval Status</dt>
              <dd className="mt-0.5">
                <StatusBadge status={invoice.vendor.preApprovalStatus} />
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Line Items */}
      {lineItems && lineItems.length > 0 && (
        <div className="bg-card border border-border overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-semibold text-foreground">Line Items</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Description</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Qty</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Unit Price</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li: { description: string; quantity: number; unitPrice: number }, i: number) => (
                <tr key={i} className="border-b border-zinc-50">
                  <td className="px-4 py-3 text-sm text-foreground">{li.description}</td>
                  <td className="px-4 py-3 text-sm text-foreground text-right">{li.quantity}</td>
                  <td className="px-4 py-3 text-sm text-foreground text-right">{li.unitPrice.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-foreground text-right">
                    {(li.quantity * li.unitPrice).toFixed(2)} {invoice.assetId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approval History */}
      {invoice.approvals.length > 0 && (
        <div className="bg-card border border-border p-5">
          <h2 className="font-semibold text-foreground mb-4">Approval History</h2>
          <div className="space-y-3">
            {invoice.approvals.map((approval) => (
              <div
                key={approval.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted"
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    approval.decision === 'APPROVED'
                      ? 'bg-emerald-100'
                      : 'bg-red-100'
                  }`}
                >
                  {approval.decision === 'APPROVED' ? (
                    <Check size={12} className="text-emerald-600" />
                  ) : (
                    <X size={12} className="text-red-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {approval.approver.name || approval.approver.email}
                    <span className="font-normal text-muted-foreground ml-1.5">
                      {approval.decision.toLowerCase()}
                    </span>
                  </p>
                  {approval.note && (
                    <p className="text-xs text-muted-foreground mt-0.5">{approval.note}</p>
                  )}
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    {format(new Date(approval.createdAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Receipt */}
      {invoice.receipt && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-5">
          <h2 className="font-semibold text-teal-900 mb-3">Payment Receipt</h2>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-sm text-teal-700">Amount paid</dt>
              <dd className="text-sm font-bold text-teal-900">
                {formatAmount(invoice.receipt.amount, invoice.receipt.assetId)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-teal-700">Paid at</dt>
              <dd className="text-sm text-teal-900">
                {format(new Date(invoice.receipt.paidAt), 'MMM d, yyyy h:mm a')}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm text-teal-700">Canton Update ID</dt>
              <dd className="text-xs font-mono text-teal-700 max-w-xs truncate">
                {invoice.receipt.updateId}
              </dd>
            </div>
          </dl>
          <Link
            href={`/${slug}/receipts/${invoice.receipt.id}`}
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-teal-700 font-medium hover:text-teal-900"
          >
            View full receipt →
          </Link>
        </div>
      )}
    </div>
  )
}
