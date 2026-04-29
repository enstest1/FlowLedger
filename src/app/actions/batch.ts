'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCantonAdapter } from '@/lib/canton'
import type { AssetId } from '@/lib/canton/types'

const CreateBatchSchema = z.object({
  name: z.string().min(1).max(100),
  invoiceIds: z.array(z.string()).min(1),
  assetId: z.enum(['USDCX', 'CC']),
})

export async function createBatch(orgId: string, data: unknown) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: orgId },
    include: { organization: true },
  })
  if (!membership || !['ADMIN', 'TREASURY'].includes(membership.role)) {
    return { error: 'Insufficient permissions' }
  }

  const parsed = CreateBatchSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Validation error' }

  const { name, invoiceIds, assetId } = parsed.data

  // Validate invoices
  const invoices = await prisma.invoice.findMany({
    where: {
      id: { in: invoiceIds },
      organizationId: orgId,
      status: 'APPROVED',
      assetId,
    },
  })

  if (invoices.length !== invoiceIds.length) {
    return { error: 'Some invoices are not approved or have a different asset' }
  }

  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0)

  try {
    const batch = await prisma.payrollBatch.create({
      data: {
        organizationId: orgId,
        name,
        assetId,
        totalAmount,
        itemCount: invoices.length,
        status: 'DRAFT',
        items: {
          create: invoices.map((inv) => ({
            invoiceId: inv.id,
            amount: inv.amount,
            status: 'PENDING',
          })),
        },
      },
    })

    // Mark invoices as IN_BATCH
    await prisma.invoice.updateMany({
      where: { id: { in: invoiceIds } },
      data: { status: 'IN_BATCH' },
    })

    await prisma.auditEvent.create({
      data: {
        organizationId: orgId,
        actorId: session.user.id,
        eventType: 'BATCH_CREATED',
        entityType: 'batch',
        entityId: batch.id,
        metadataJson: JSON.stringify({ name, totalAmount, itemCount: invoices.length }),
      },
    })

    const org = membership.organization
    revalidatePath(`/${org.slug}/batches`)
    revalidatePath(`/${org.slug}/invoices`)
    return { data: batch }
  } catch {
    return { error: 'Failed to create batch' }
  }
}

export async function executeBatch(batchId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const batch = await prisma.payrollBatch.findUnique({
    where: { id: batchId },
    include: {
      organization: true,
      items: {
        include: {
          invoice: {
            include: { vendor: true },
          },
        },
      },
    },
  })

  if (!batch) return { error: 'Batch not found' }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: batch.organizationId },
  })
  if (!membership || !['ADMIN', 'TREASURY'].includes(membership.role)) {
    return { error: 'Insufficient permissions' }
  }

  if (batch.status !== 'DRAFT') {
    return { error: 'Batch is not in DRAFT status' }
  }

  // Check all vendor pre-approvals
  for (const item of batch.items) {
    const vendor = item.invoice.vendor
    if (vendor.preApprovalStatus === 'EXPIRED') {
      return {
        error: `Vendor ${vendor.name} has an expired pre-approval. Please renew before executing.`,
      }
    }
  }

  try {
    const adapter = getCantonAdapter()
    const org = batch.organization

    // Set batch to PROCESSING
    await prisma.payrollBatch.update({
      where: { id: batchId },
      data: { status: 'PROCESSING' },
    })

    // Create batch contract
    const batchContract = await adapter.createBatchContract({
      batchId,
      orgId: org.id,
      treasuryPartyId: org.treasuryPartyId,
      invoiceIds: batch.items.map((i) => i.invoiceId),
      totalAmount: batch.totalAmount,
      assetId: batch.assetId as AssetId,
      featuredApp: true,
    })

    await prisma.payrollBatch.update({
      where: { id: batchId },
      data: { cantonContractId: batchContract.contractId },
    })

    let paidCount = 0
    let failedCount = 0

    // Execute transfers for each item
    for (const item of batch.items) {
      try {
        const vendor = item.invoice.vendor

        // Execute transfer
        const transfer = await adapter.executeTransfer({
          senderPartyId: org.treasuryPartyId,
          receiverPartyId: vendor.cantonPartyId,
          amount: item.amount,
          assetId: batch.assetId as AssetId,
          invoiceId: item.invoiceId,
          batchId,
          featuredApp: true,
        })

        // Create receipt
        await prisma.paymentReceipt.create({
          data: {
            invoiceId: item.invoiceId,
            batchId,
            payerParty: org.treasuryPartyId,
            payeeParty: vendor.cantonPartyId,
            amount: item.amount,
            assetId: batch.assetId,
            updateId: transfer.updateId,
            transferObjectJson: transfer.transferObjectJson,
            paidAt: transfer.completedAt,
          },
        })

        // Mark item as PAID
        await prisma.batchItem.update({
          where: { id: item.id },
          data: { status: 'PAID' },
        })

        // Mark invoice as PAID
        await prisma.invoice.update({
          where: { id: item.invoiceId },
          data: { status: 'PAID' },
        })

        paidCount++
      } catch {
        failedCount++
        await prisma.batchItem.update({
          where: { id: item.id },
          data: { status: 'FAILED' },
        })
        await prisma.invoice.update({
          where: { id: item.invoiceId },
          data: { status: 'APPROVED' }, // revert to approved for retry
        })
      }
    }

    // Determine final batch status
    let finalStatus = 'PAID'
    if (failedCount > 0 && paidCount > 0) finalStatus = 'PARTIAL'
    if (failedCount > 0 && paidCount === 0) finalStatus = 'FAILED'

    await prisma.payrollBatch.update({
      where: { id: batchId },
      data: {
        status: finalStatus,
        executedAt: new Date(),
      },
    })

    await prisma.auditEvent.create({
      data: {
        organizationId: org.id,
        actorId: session.user.id,
        eventType: 'BATCH_EXECUTED',
        entityType: 'batch',
        entityId: batchId,
        metadataJson: JSON.stringify({ paidCount, failedCount, finalStatus }),
      },
    })

    revalidatePath(`/${org.slug}/batches`)
    revalidatePath(`/${org.slug}/invoices`)
    revalidatePath(`/${org.slug}/receipts`)
    return { data: { status: finalStatus, paidCount, failedCount } }
  } catch {
    await prisma.payrollBatch.update({
      where: { id: batchId },
      data: { status: 'FAILED', failureReason: 'Execution failed' },
    })
    return { error: 'Failed to execute batch' }
  }
}
