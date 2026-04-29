import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const receipt = await prisma.paymentReceipt.findUnique({
    where: { id },
    include: {
      invoice: {
        include: { vendor: true, organization: true },
      },
    },
  })

  if (!receipt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Check membership
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      organizationId: receipt.invoice.organizationId,
    },
  })

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(receipt)
}
