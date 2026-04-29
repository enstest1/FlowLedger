'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function linkCantonWallet(partyId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated' }

  if (!/^[a-zA-Z0-9_-]+::[a-f0-9]{64,}$/.test(partyId)) {
    return { error: 'Invalid Canton party ID format. Expected: hint::hexfingerprint' }
  }

  // Make sure no other user already has this party ID
  const existing = await prisma.user.findFirst({
    where: { cantonPartyId: partyId, NOT: { id: session.user.id } },
  })
  if (existing) {
    return { error: 'This party ID is already linked to another account' }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { cantonPartyId: partyId },
  })

  revalidatePath('/profile')
  return { success: true, partyId }
}

export async function updateUserProfile(data: { name?: string }) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated' }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: data.name },
  })

  revalidatePath('/profile')
  return { success: true }
}
