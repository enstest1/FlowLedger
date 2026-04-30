'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCantonAdapter } from '@/lib/canton'

const PARTY_ID_REGEX = /^.+::[a-f0-9]+$/

const CreateVendorSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  cantonPartyId: z.string().regex(PARTY_ID_REGEX, {
    message: 'Party ID must be in format hint::fingerprint (hex)',
  }),
  preferredAsset: z.enum(['USDCX', 'CC']).default('USDCX'),
  notes: z.string().optional(),
})

export async function createVendor(orgId: string, data: unknown) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: orgId },
  })
  if (!membership || !['ADMIN', 'TREASURY'].includes(membership.role)) {
    return { error: 'Insufficient permissions' }
  }

  const parsed = CreateVendorSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Validation error' }

  const { name, email, cantonPartyId, preferredAsset, notes } = parsed.data

  try {
    const adapter = getCantonAdapter()

    // Step 1 — Register party on the validator
    await adapter.registerExternalParty({ partyId: cantonPartyId, hint: name })

    // Step 2 — Set TransferPreApproval so vendor auto-receives payments
    const preApproval = await adapter.setTransferPreApproval(cantonPartyId)

    // Step 3 — Setup WalletUserProxy (MainNet reward earning)
    // Non-blocking: if this fails, vendor creation still succeeds.
    let walletProxyContractId: string | undefined
    let walletProxyStatus = 'PENDING'
    try {
      const { WalletProxyManager } = await import('@/lib/canton/wallet-proxy')
      const proxyManager = new WalletProxyManager()
      const contractId = await proxyManager.setupWalletProxy(cantonPartyId)
      walletProxyContractId = contractId || undefined
      if (walletProxyContractId) {
        walletProxyStatus = 'ACTIVE'
      }
    } catch (err) {
      console.warn('[Vendor] WalletProxy setup failed (non-blocking):', err)
    }

    const vendor = await prisma.vendor.create({
      data: {
        organizationId: orgId,
        name,
        email,
        cantonPartyId,
        preferredAsset,
        preApprovalStatus: 'ACTIVE',
        preApprovalExpiry: preApproval.expiresAt,
        status: 'ACTIVE',
        notes,
        ...(walletProxyContractId
          ? {
              walletProxyContractId,
              walletProxyStatus,
              walletProxyCreatedAt: new Date(),
            }
          : {}),
      },
    })

    await prisma.auditEvent.create({
      data: {
        organizationId: orgId,
        actorId: session.user.id,
        eventType: 'VENDOR_ADDED',
        entityType: 'vendor',
        entityId: vendor.id,
        metadataJson: JSON.stringify({ name, email, cantonPartyId }),
      },
    })

    // Audit event for WalletProxy creation (only if proxy was set up)
    if (walletProxyStatus === 'ACTIVE' && walletProxyContractId) {
      await prisma.auditEvent.create({
        data: {
          organizationId: orgId,
          actorId: session.user.id,
          eventType: 'WALLET_PROXY_CREATED',
          entityType: 'vendor',
          entityId: vendor.id,
          metadataJson: JSON.stringify({
            cantonPartyId,
            walletProxyContractId,
          }),
        },
      })
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    revalidatePath(`/${org?.slug}/vendors`)
    return { data: vendor }
  } catch {
    return { error: 'Failed to create vendor' }
  }
}

export async function updateVendor(vendorId: string, data: unknown) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } })
  if (!vendor) return { error: 'Vendor not found' }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: vendor.organizationId },
  })
  if (!membership || !['ADMIN', 'TREASURY'].includes(membership.role)) {
    return { error: 'Insufficient permissions' }
  }

  const parsed = CreateVendorSchema.partial().safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Validation error' }

  await prisma.vendor.update({ where: { id: vendorId }, data: parsed.data })

  const org = await prisma.organization.findUnique({
    where: { id: vendor.organizationId },
  })
  revalidatePath(`/${org?.slug}/vendors`)
  return { data: { success: true } }
}

export async function deactivateVendor(vendorId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } })
  if (!vendor) return { error: 'Vendor not found' }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: vendor.organizationId },
  })
  if (!membership || membership.role !== 'ADMIN') {
    return { error: 'Insufficient permissions' }
  }

  await prisma.vendor.update({
    where: { id: vendorId },
    data: { status: 'INACTIVE' },
  })

  const org = await prisma.organization.findUnique({
    where: { id: vendor.organizationId },
  })
  revalidatePath(`/${org?.slug}/vendors`)
  return { data: { success: true } }
}

export async function renewPreApproval(vendorId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } })
  if (!vendor) return { error: 'Vendor not found' }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: vendor.organizationId },
  })
  if (!membership || !['ADMIN', 'TREASURY'].includes(membership.role)) {
    return { error: 'Insufficient permissions' }
  }

  try {
    const adapter = getCantonAdapter()
    const result = await adapter.setTransferPreApproval(vendor.cantonPartyId)

    await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        preApprovalStatus: 'ACTIVE',
        preApprovalExpiry: result.expiresAt,
      },
    })

    await prisma.auditEvent.create({
      data: {
        organizationId: vendor.organizationId,
        actorId: session.user.id,
        eventType: 'VENDOR_PRE_APPROVAL_RENEWED',
        entityType: 'vendor',
        entityId: vendorId,
        metadataJson: JSON.stringify({ expiresAt: result.expiresAt }),
      },
    })

    const org = await prisma.organization.findUnique({
      where: { id: vendor.organizationId },
    })
    revalidatePath(`/${org?.slug}/vendors`)
    return { data: { success: true } }
  } catch {
    return { error: 'Failed to renew pre-approval' }
  }
}
