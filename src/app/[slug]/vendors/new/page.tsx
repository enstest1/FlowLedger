import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { NewVendorForm } from './new-vendor-form'

export default async function NewVendorPage({
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
    redirect(`/${slug}/vendors`)
  }

  return <NewVendorForm orgId={membership.organizationId} slug={slug} />
}
