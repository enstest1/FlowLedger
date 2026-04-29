'use client'
import { signOut } from 'next-auth/react'
import { LogOut, User } from 'lucide-react'
import Link from 'next/link'

interface TopbarProps {
  userName?: string | null
  userEmail?: string | null
  role: string
  cantonPartyId?: string | null
}

const roleColors: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  TREASURY: 'bg-sky-100 text-sky-700',
  APPROVER: 'bg-amber-100 text-amber-700',
  ACCOUNTANT: 'bg-muted text-zinc-600',
}

export function Topbar({ userName, userEmail, role, cantonPartyId }: TopbarProps) {
  return (
    <header className="h-12 bg-card border-b border-border flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-3">
        <span
          className={`text-[11px] font-medium uppercase tracking-wide px-1.5 py-0.5 ${
            roleColors[role] ?? 'bg-muted text-zinc-600'
          }`}
        >
          {role}
        </span>
        <Link
          href="/profile"
          className="flex items-center gap-2 hover:bg-black/5 px-2 py-1 transition-colors"
          title="Profile & wallet settings"
        >
          <div className="relative">
            <div className="w-6 h-6 bg-border flex items-center justify-center">
              <User size={13} className="text-zinc-600" />
            </div>
            {cantonPartyId && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-white" title="Canton wallet connected" />
            )}
          </div>
          <span className="text-sm text-foreground">{userName || userEmail}</span>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Sign out"
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  )
}
