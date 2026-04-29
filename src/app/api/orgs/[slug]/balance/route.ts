import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCantonAdapter } from '@/lib/canton'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      organization: { slug },
    },
    include: { organization: true },
  })

  if (!membership) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const adapter = getCantonAdapter()
  const balance = await adapter.getBalance(
    membership.organization.treasuryPartyId,
    membership.organization.defaultAsset as 'USDCX' | 'CC'
  )

  return NextResponse.json(balance)
}
