import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { NewInvoiceForm } from './new-invoice-form'

export default async function NewInvoicePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organization: { slug } },
    include: { organization: true },
  })
  if (!membership) redirect('/')
  if (!['ADMIN', 'TREASURY'].includes(membership.role)) {
    redirect(`/${slug}/invoices`)
  }

  const vendors = await prisma.vendor.findMany({
    where: {
      organizationId: membership.organizationId,
      status: 'ACTIVE',
    },
    orderBy: { name: 'asc' },
  })

  const existingNumbers = await prisma.invoice.findMany({
    where: { organizationId: membership.organizationId },
    select: { invoiceNumber: true },
  })

  return (
    <NewInvoiceForm
      orgId={membership.organizationId}
      slug={slug}
      vendors={vendors.map((v) => ({ id: v.id, name: v.name, email: v.email }))}
      approvalThreshold={membership.organization.approvalThreshold}
      defaultAsset={membership.organization.defaultAsset}
      existingInvoiceNumbers={existingNumbers.map((i) => i.invoiceNumber)}
    />
  )
}
