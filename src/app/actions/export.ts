'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

export async function exportInvoicesCSV(
  orgId: string,
  filters: { status?: string; from?: string; to?: string }
) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: orgId },
  })
  if (!membership) return { error: 'Not a member' }

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    },
    include: { vendor: true },
    orderBy: { createdAt: 'desc' },
  })

  const rows = invoices.map((inv) => ({
    invoiceNumber: inv.invoiceNumber,
    vendor: inv.vendor.name,
    vendorEmail: inv.vendor.email,
    amount: inv.amount.toFixed(2),
    assetId: inv.assetId,
    description: inv.description,
    status: inv.status,
    dueDate: format(new Date(inv.dueDate), 'yyyy-MM-dd'),
    createdAt: format(new Date(inv.createdAt), 'yyyy-MM-dd'),
  }))

  // Build CSV manually since csv-writer requires file output
  const headers = [
    'Invoice Number',
    'Vendor',
    'Vendor Email',
    'Amount',
    'Asset',
    'Description',
    'Status',
    'Due Date',
    'Created At',
  ]

  const csvLines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.invoiceNumber,
        `"${r.vendor}"`,
        r.vendorEmail,
        r.amount,
        r.assetId,
        `"${r.description}"`,
        r.status,
        r.dueDate,
        r.createdAt,
      ].join(',')
    ),
  ]

  return { data: { csv: csvLines.join('\n'), count: rows.length } }
}

export async function exportReceiptsCSV(orgId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: orgId },
  })
  if (!membership) return { error: 'Not a member' }

  const receipts = await prisma.paymentReceipt.findMany({
    where: {
      invoice: { organizationId: orgId },
    },
    include: {
      invoice: { include: { vendor: true } },
    },
    orderBy: { paidAt: 'desc' },
  })

  const headers = [
    'Invoice Number',
    'Vendor',
    'Amount',
    'Asset',
    'Update ID',
    'Payer Party',
    'Payee Party',
    'Paid At',
  ]

  const rows = receipts.map((r) => [
    r.invoice.invoiceNumber,
    `"${r.invoice.vendor.name}"`,
    r.amount.toFixed(2),
    r.assetId,
    r.updateId,
    r.payerParty,
    r.payeeParty,
    format(new Date(r.paidAt), 'yyyy-MM-dd HH:mm:ss'),
  ])

  const csvLines = [headers.join(','), ...rows.map((r) => r.join(','))]

  return { data: { csv: csvLines.join('\n'), count: rows.length } }
}
