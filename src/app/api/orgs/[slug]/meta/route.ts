import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

  return NextResponse.json({
    id: membership.organization.id,
    slug: membership.organization.slug,
    name: membership.organization.name,
    role: membership.role,
  })
}
