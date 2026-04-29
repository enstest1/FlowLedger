import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { NewBatchWizard } from './new-batch-wizard'
import { getCantonAdapter } from '@/lib/canton'

export default async function NewBatchPage({
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
    redirect(`/${slug}/batches`)
  }

  const org = membership.organization

  const approvedInvoices = await prisma.invoice.findMany({
    where: {
      organizationId: membership.organizationId,
      status: 'APPROVED',
    },
    include: { vendor: true },
    orderBy: { dueDate: 'asc' },
  })

  // Get treasury balance
  const adapter = getCantonAdapter()
  let balance = 50000
  try {
    const bal = await adapter.getBalance(
      org.treasuryPartyId,
      org.defaultAsset as 'USDCX' | 'CC'
    )
    balance = bal.amount
  } catch {
    balance = 50000
  }

  return (
    <NewBatchWizard
      orgId={org.id}
      slug={slug}
      defaultAsset={org.defaultAsset}
      treasuryBalance={balance}
      approvedInvoices={approvedInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        vendorName: inv.vendor.name,
        vendorPartyId: inv.vendor.cantonPartyId,
        vendorPreApprovalStatus: inv.vendor.preApprovalStatus,
        amount: inv.amount,
        assetId: inv.assetId,
        description: inv.description,
      }))}
    />
  )
}
