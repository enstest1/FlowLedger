'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCantonAdapter } from '@/lib/canton'
import { generateInvoiceNumber } from '@/lib/utils'

const CreateInvoiceSchema = z.object({
  vendorId: z.string(),
  amount: z.number().positive(),
  assetId: z.enum(['USDCX', 'CC']),
  description: z.string().min(1).max(500),
  dueDate: z.string(),
  lineItems: z.string().optional(),
})

export async function createInvoice(orgId: string, data: unknown) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: orgId },
    include: { organization: true },
  })
  if (!membership || !['ADMIN', 'TREASURY'].includes(membership.role)) {
    return { error: 'Insufficient permissions' }
  }

  const parsed = CreateInvoiceSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Validation error' }

  const { vendorId, amount, assetId, description, dueDate, lineItems } =
    parsed.data

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } })
  if (!vendor) return { error: 'Vendor not found' }

  // Generate invoice number
  const existing = await prisma.invoice.findMany({
    where: { organizationId: orgId },
    select: { invoiceNumber: true },
  })
  const invoiceNumber = generateInvoiceNumber(existing.map((i) => i.invoiceNumber))

  try {
    const adapter = getCantonAdapter()
    const org = membership.organization
    const needsApproval = amount >= org.approvalThreshold

    // Create Daml contract
    const tmpId = `${orgId}-${Date.now()}`
    const contract = await adapter.createInvoiceContract({
      invoiceId: tmpId,
      orgId,
      vendorPartyId: vendor.cantonPartyId,
      treasuryPartyId: org.treasuryPartyId,
      amount,
      assetId,
      description,
    })

    const invoice = await prisma.invoice.create({
      data: {
        organizationId: orgId,
        vendorId,
        invoiceNumber,
        amount,
        assetId,
        description,
        dueDate: new Date(dueDate),
        lineItems,
        status: needsApproval ? 'PENDING_APPROVAL' : 'APPROVED',
        cantonContractId: contract.contractId,
      },
    })

    await prisma.auditEvent.create({
      data: {
        organizationId: orgId,
        actorId: session.user.id,
        eventType: 'INVOICE_SUBMITTED',
        entityType: 'invoice',
        entityId: invoice.id,
        metadataJson: JSON.stringify({ invoiceNumber, amount, assetId }),
      },
    })

    revalidatePath(`/${org.slug}/invoices`)
    return { data: invoice }
  } catch {
    return { error: 'Failed to create invoice' }
  }
}

export async function approveInvoice(invoiceId: string, note?: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { organization: true },
  })
  if (!invoice) return { error: 'Invoice not found' }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: invoice.organizationId },
  })
  if (!membership || !['ADMIN', 'APPROVER'].includes(membership.role)) {
    return { error: 'Insufficient permissions' }
  }

  if (invoice.status !== 'PENDING_APPROVAL') {
    return { error: 'Invoice is not pending approval' }
  }

  try {
    const adapter = getCantonAdapter()

    if (invoice.cantonContractId) {
      await adapter.approveInvoiceContract({
        contractId: invoice.cantonContractId,
        approverPartyId: session.user.id,
      })
    }

    await prisma.invoiceApproval.create({
      data: {
        invoiceId,
        approverId: session.user.id,
        decision: 'APPROVED',
        note,
      },
    })

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'APPROVED' },
    })

    await prisma.auditEvent.create({
      data: {
        organizationId: invoice.organizationId,
        actorId: session.user.id,
        eventType: 'INVOICE_APPROVED',
        entityType: 'invoice',
        entityId: invoiceId,
        metadataJson: JSON.stringify({ note }),
      },
    })

    revalidatePath(`/${invoice.organization.slug}/invoices`)
    revalidatePath(`/${invoice.organization.slug}/approvals`)
    return { data: { success: true } }
  } catch {
    return { error: 'Failed to approve invoice' }
  }
}

export async function rejectInvoice(invoiceId: string, note: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { organization: true },
  })
  if (!invoice) return { error: 'Invoice not found' }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: invoice.organizationId },
  })
  if (!membership || !['ADMIN', 'APPROVER'].includes(membership.role)) {
    return { error: 'Insufficient permissions' }
  }

  if (invoice.status !== 'PENDING_APPROVAL') {
    return { error: 'Invoice is not pending approval' }
  }

  try {
    const adapter = getCantonAdapter()

    if (invoice.cantonContractId) {
      await adapter.rejectInvoiceContract({
        contractId: invoice.cantonContractId,
        approverPartyId: session.user.id,
        note,
      })
    }

    await prisma.invoiceApproval.create({
      data: {
        invoiceId,
        approverId: session.user.id,
        decision: 'REJECTED',
        note,
      },
    })

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'REJECTED', rejectionNote: note },
    })

    await prisma.auditEvent.create({
      data: {
        organizationId: invoice.organizationId,
        actorId: session.user.id,
        eventType: 'INVOICE_REJECTED',
        entityType: 'invoice',
        entityId: invoiceId,
        metadataJson: JSON.stringify({ note }),
      },
    })

    revalidatePath(`/${invoice.organization.slug}/invoices`)
    revalidatePath(`/${invoice.organization.slug}/approvals`)
    return { data: { success: true } }
  } catch {
    return { error: 'Failed to reject invoice' }
  }
}

export async function cancelInvoice(invoiceId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { organization: true },
  })
  if (!invoice) return { error: 'Invoice not found' }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: invoice.organizationId },
  })
  if (!membership || membership.role !== 'ADMIN') {
    return { error: 'Insufficient permissions' }
  }

  if (invoice.status === 'PAID') {
    return { error: 'Cannot cancel a paid invoice' }
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'CANCELLED' },
  })

  await prisma.auditEvent.create({
    data: {
      organizationId: invoice.organizationId,
      actorId: session.user.id,
      eventType: 'INVOICE_CANCELLED',
      entityType: 'invoice',
      entityId: invoiceId,
      metadataJson: JSON.stringify({}),
    },
  })

  revalidatePath(`/${invoice.organization.slug}/invoices`)
  return { data: { success: true } }
}
