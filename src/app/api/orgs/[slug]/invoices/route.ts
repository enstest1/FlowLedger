import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
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

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: membership.organizationId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search } },
              { description: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      vendor: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(invoices)
}
