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
        <h1 className="text-2xl font-bold text-zinc-900">Payment Settings</h1>
        <p className="text-zinc-500 text-sm mt-0.5">
          Treasury configuration and approval rules
        </p>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
        <h2 className="font-semibold text-zinc-900">Treasury</h2>
        <div>
          <p className="text-xs text-zinc-400 mb-1">Treasury Party ID</p>
          <p className="text-sm font-mono text-zinc-700 break-all">
            {org.treasuryPartyId}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-zinc-400 mb-1">Default Asset</p>
            <p className="text-sm font-medium text-zinc-900">{org.defaultAsset}</p>
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
