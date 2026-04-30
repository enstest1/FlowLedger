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

const roleMeta: Record<string, { label: string; cls: string }> = {
  ADMIN: { label: 'Admin', cls: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  TREASURY: { label: 'Treasury', cls: 'bg-sky-50 text-sky-700 border border-sky-200' },
  APPROVER: { label: 'Approver', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  ACCOUNTANT: { label: 'Accountant', cls: 'bg-zinc-100 text-zinc-600 border border-zinc-200' },
}

export function Topbar({ userName, userEmail, role, cantonPartyId }: TopbarProps) {
  const meta = roleMeta[role] ?? { label: role, cls: 'bg-zinc-100 text-zinc-600 border border-zinc-200' }

  return (
    <header className="h-12 bg-white border-b border-zinc-200 flex items-center justify-end px-5 gap-3 shrink-0">
      {/* Role badge — Von Restorff: distinct shape signals permission level */}
      <span className={`text-xs font-bold px-2 py-1 rounded ${meta.cls}`}>
        {meta.label}
      </span>

      {/* User profile link — Fitts's Law: generous tap target */}
      <Link
        href="/profile"
        className="flex items-center gap-2 hover:bg-zinc-50 rounded-md px-2 py-1.5 transition-colors"
        title="Profile & wallet settings"
      >
        <div className="relative">
          <div className="w-6 h-6 bg-zinc-100 rounded-full flex items-center justify-center border border-zinc-200">
            <User size={12} className="text-zinc-500" />
          </div>
          {cantonPartyId && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-white"
              title="Canton wallet connected"
            />
          )}
        </div>
        <span className="text-xs text-zinc-600 max-w-[140px] truncate">
          {userName || userEmail}
        </span>
      </Link>

      <button
        onClick={() => signOut({ callbackUrl: '/auth/signin' })}
        className="text-zinc-400 hover:text-zinc-700 transition-colors p-1 rounded"
        title="Sign out"
      >
        <LogOut size={14} />
      </button>
    </header>
  )
}
