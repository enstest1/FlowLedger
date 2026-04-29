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
  ADMIN: 'bg-indigo-100 text-indigo-700',
  TREASURY: 'bg-sky-100 text-sky-700',
  APPROVER: 'bg-amber-100 text-amber-700',
  ACCOUNTANT: 'bg-zinc-100 text-zinc-700',
}

export function Topbar({ userName, userEmail, role, cantonPartyId }: TopbarProps) {
  return (
    <header className="h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            roleColors[role] ?? 'bg-zinc-100 text-zinc-700'
          }`}
        >
          {role}
        </span>
        <Link
          href="/profile"
          className="flex items-center gap-2 hover:bg-zinc-50 rounded-lg px-2 py-1 transition-colors"
          title="Profile & wallet settings"
        >
          <div className="relative">
            <div className="w-7 h-7 bg-zinc-200 rounded-full flex items-center justify-center">
              <User size={14} className="text-zinc-600" />
            </div>
            {cantonPartyId && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" title="Canton wallet connected" />
            )}
          </div>
          <span className="text-sm text-zinc-700">{userName || userEmail}</span>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          className="text-zinc-400 hover:text-zinc-700 transition-colors"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
