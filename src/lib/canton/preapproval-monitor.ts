import { prisma } from '@/lib/prisma'

export interface PreApprovalReport {
  active: number
  expiringWithin14Days: number
  expired: number
  vendors: Array<{
    id: string
    name: string
    orgName: string
    orgSlug: string
    cantonPartyId: string
    preApprovalStatus: string
    preApprovalExpiry: Date | null
    daysUntilExpiry: number | null
  }>
}

export async function checkPreApprovals(orgId?: string): Promise<PreApprovalReport> {
  const now = new Date()
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  const vendors = await prisma.vendor.findMany({
    where: {
      status: 'ACTIVE',
      ...(orgId ? { organizationId: orgId } : {}),
    },
    include: { organization: { select: { name: true, slug: true } } },
    orderBy: { preApprovalExpiry: 'asc' },
  })

  const rows = vendors.map((v) => {
    const expiry = v.preApprovalExpiry
    const daysUntilExpiry = expiry
      ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null
    return {
      id: v.id,
      name: v.name,
      orgName: v.organization.name,
      orgSlug: v.organization.slug,
      cantonPartyId: v.cantonPartyId,
      preApprovalStatus: v.preApprovalStatus,
      preApprovalExpiry: expiry,
      daysUntilExpiry,
    }
  })

  const active = rows.filter(
    (v) => v.preApprovalStatus === 'ACTIVE' && (v.daysUntilExpiry === null || v.daysUntilExpiry > 14)
  ).length

  const expiringWithin14Days = rows.filter(
    (v) => v.preApprovalStatus === 'ACTIVE' && v.daysUntilExpiry !== null && v.daysUntilExpiry <= 14 && v.daysUntilExpiry >= 0
  ).length

  const expired = rows.filter(
    (v) => v.preApprovalStatus === 'EXPIRED' || (v.daysUntilExpiry !== null && v.daysUntilExpiry < 0)
  ).length

  // Auto-update status for any that have passed expiry but are still marked ACTIVE
  const nowExpired = rows.filter(
    (v) => v.preApprovalStatus === 'ACTIVE' && v.daysUntilExpiry !== null && v.daysUntilExpiry < 0
  )
  if (nowExpired.length > 0) {
    await prisma.vendor.updateMany({
      where: { id: { in: nowExpired.map((v) => v.id) } },
      data: { preApprovalStatus: 'EXPIRED' },
    })
  }

  return { active, expiringWithin14Days, expired, vendors: rows }
}
