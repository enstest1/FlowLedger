import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const [membership, user] = await Promise.all([
    prisma.organizationMember.findFirst({
      where: { userId: session.user.id, organization: { slug } },
      include: { organization: true },
    }),
    prisma.user.findUnique({ where: { id: session.user.id } }),
  ])

  if (!membership) redirect('/')

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        slug={slug}
        orgName={membership.organization.name}
        role={membership.role}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          userName={session.user.name}
          userEmail={session.user.email}
          role={membership.role}
          cantonPartyId={user?.cantonPartyId}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
