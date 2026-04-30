import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { WalletLinkSection } from './wallet-link-section'
import { PartyId } from '@/components/party-id'
import { User, Mail } from 'lucide-react'

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      memberships: { include: { organization: true } },
    },
  })
  if (!user) redirect('/auth/signin')

  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Profile</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage your account and Canton wallet connection.</p>
        </div>

        {/* Basic info */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">Account</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#d6dcd2] rounded-full flex items-center justify-center">
              <User size={18} className="text-[#2d5a4f]" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-900">{user.name || 'Unnamed user'}</p>
              <p className="text-xs text-zinc-500 flex items-center gap-1">
                <Mail size={11} /> {user.email}
              </p>
            </div>
          </div>

          {user.memberships.length > 0 && (
            <div className="pt-2 border-t border-zinc-100">
              <p className="text-xs font-medium text-zinc-500 mb-2">Organizations</p>
              <div className="space-y-1">
                {user.memberships.map(m => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <a
                      href={`/${m.organization.slug}/dashboard`}
                      className="text-[#2d5a4f] hover:underline"
                    >
                      {m.organization.name}
                    </a>
                    <span className="text-xs text-zinc-400">{m.role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Canton wallet */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Canton Wallet</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Your Canton party ID is where USDCx and CC payments are received.
            </p>
          </div>

          {user.cantonPartyId ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                  ● Connected
                </span>
              </div>
              <div className="bg-zinc-50 rounded-lg px-3 py-2">
                <p className="text-xs text-zinc-500 mb-1">Party ID</p>
                <PartyId id={user.cantonPartyId} chars={12} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                No Canton wallet connected. Connect one to receive payments.
              </div>
              <WalletLinkSection />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
