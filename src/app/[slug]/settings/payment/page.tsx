import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { PaymentSettingsForm } from './payment-settings-form'

export default async function PaymentSettingsPage({
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

  const org = membership.organization
  const isAdmin = membership.role === 'ADMIN'

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Payment Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Treasury configuration and approval rules
        </p>
      </div>

      <div className="bg-card border border-border p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Treasury</h2>
        <div>
          <p className="text-xs text-muted-foreground/70 mb-1">Treasury Party ID</p>
          <p className="text-sm font-mono text-foreground break-all">
            {org.treasuryPartyId}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground/70 mb-1">Default Asset</p>
            <p className="text-sm font-medium text-foreground">{org.defaultAsset}</p>
          </div>
        </div>
      </div>

      <PaymentSettingsForm
        orgId={org.id}
        slug={slug}
        defaultAsset={org.defaultAsset}
        approvalThreshold={org.approvalThreshold}
        requireDualApproval={org.requireDualApproval}
        isAdmin={isAdmin}
      />
    </div>
  )
}
