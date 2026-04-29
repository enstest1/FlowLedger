'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCantonAdapter } from '@/lib/canton'

const CreateOrgSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  treasuryPartyId: z.string().min(5),
  defaultAsset: z.enum(['USDCX', 'CC']).default('USDCX'),
  approvalThreshold: z.number().min(0).default(1000),
  requireDualApproval: z.boolean().default(false),
})

export async function createOrg(data: unknown) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Unauthorized' }
  }

  const parsed = CreateOrgSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Validation error' }
  }

  const { name, slug, treasuryPartyId, defaultAsset, approvalThreshold, requireDualApproval } =
    parsed.data

  // Check slug uniqueness
  const existing = await prisma.organization.findUnique({ where: { slug } })
  if (existing) {
    return { error: 'Slug already taken' }
  }

  try {
    const adapter = getCantonAdapter()
    // Register treasury party
    await adapter.registerExternalParty({
      partyId: treasuryPartyId,
      hint: `${slug}-treasury`,
    })

    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        treasuryPartyId,
        defaultAsset,
        approvalThreshold,
        requireDualApproval,
        members: {
          create: {
            userId: session.user.id,
            role: 'ADMIN',
          },
        },
      },
    })

    await prisma.auditEvent.create({
      data: {
        organizationId: org.id,
        actorId: session.user.id,
        eventType: 'ORG_CREATED',
        entityType: 'org',
        entityId: org.id,
        metadataJson: JSON.stringify({ name, slug }),
      },
    })

    revalidatePath('/')
    redirect(`/${slug}/dashboard`)
  } catch (err) {
    if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err
    return { error: 'Failed to create organization' }
  }
}

const UpdateOrgSettingsSchema = z.object({
  approvalThreshold: z.number().min(0),
  requireDualApproval: z.boolean(),
  defaultAsset: z.enum(['USDCX', 'CC']),
})

export async function updateOrgSettings(orgId: string, data: unknown) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const parsed = UpdateOrgSettingsSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.message }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: orgId },
  })
  if (!membership || membership.role !== 'ADMIN') {
    return { error: 'Insufficient permissions' }
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: parsed.data,
  })

  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  revalidatePath(`/${org?.slug}/settings`)
  return { data: { success: true } }
}

export async function inviteMember(orgId: string, email: string, role: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: orgId },
  })
  if (!membership || membership.role !== 'ADMIN') {
    return { error: 'Insufficient permissions' }
  }

  // Find or create user
  const invitee = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  })

  // Check existing membership
  const existingMembership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: invitee.id } },
  })
  if (existingMembership) {
    return { error: 'User is already a member' }
  }

  await prisma.organizationMember.create({
    data: { organizationId: orgId, userId: invitee.id, role },
  })

  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  revalidatePath(`/${org?.slug}/settings/members`)
  return { data: { success: true } }
}
