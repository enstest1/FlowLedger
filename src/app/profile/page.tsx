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
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-lg mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your account and Canton wallet connection.</p>
        </div>

        {/* Basic info */}
        <div className="bg-card border border-border p-6 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Account</h2>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-100 flex items-center justify-center shrink-0">
              <User size={16} className="text-purple-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{user.name || 'Unnamed user'}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail size={11} /> {user.email}
              </p>
            </div>
          </div>

          {user.memberships.length > 0 && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">Organizations</p>
              <div className="space-y-1.5">
                {user.memberships.map(m => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <a
                      href={`/${m.organization.slug}/dashboard`}
                      className="text-primary hover:underline"
                    >
                      {m.organization.name}
                    </a>
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">{m.role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Canton wallet */}
        <div className="bg-card border border-border p-6 space-y-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Canton Wallet</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Your Canton party ID is where USDCx and CC payments are received.
            </p>
          </div>

          {user.cantonPartyId ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 font-medium uppercase tracking-wide border border-emerald-200">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  Connected
                </span>
              </div>
              <div className="bg-muted border border-border px-3 py-2">
                <p className="text-xs text-muted-foreground mb-1">Party ID</p>
                <PartyId id={user.cantonPartyId} chars={12} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2">
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
