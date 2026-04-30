'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  FileText,
  CheckSquare,
  Package,
  Receipt,
  Download,
  Settings,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlobeLoader } from '@/components/globe-loader'
import { FlowLedgerMark } from '@/components/flow-ledger-mark'

interface SidebarProps {
  slug: string
  orgName: string
  role: string
}

export function Sidebar({ slug, orgName, role }: SidebarProps) {
  const pathname = usePathname()
  const base = `/${slug}`

  const navItems = [
    { href: `${base}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
    { href: `${base}/vendors`, label: 'Vendors', icon: Users },
    { href: `${base}/invoices`, label: 'Invoices', icon: FileText },
    ...(role === 'APPROVER' || role === 'ADMIN'
      ? [{ href: `${base}/approvals`, label: 'Approvals', icon: CheckSquare }]
      : []),
    { href: `${base}/batches`, label: 'Payroll Batches', icon: Package },
    { href: `${base}/receipts`, label: 'Receipts', icon: Receipt },
    { href: `${base}/exports`, label: 'Exports', icon: Download },
    ...(role === 'ADMIN' || role === 'TREASURY'
      ? [{ href: `${base}/rewards`, label: 'Rewards', icon: TrendingUp }]
      : []),
    { href: `${base}/settings`, label: 'Settings', icon: Settings },
  ]

  return (
    <aside className="w-[200px] bg-white border-r border-zinc-200 flex flex-col min-h-screen shrink-0">
      {/* Brand header */}
      <div className="px-4 py-4 border-b border-zinc-200 flex items-center gap-2.5">
        <FlowLedgerMark size={24} />
        <p className="text-sm font-bold text-zinc-900 tracking-tight">
          FlowLedger
        </p>
      </div>

      {/* Navigation — Fitts's Law: full-width targets with generous py */}
      <nav className="flex-1 py-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const active =
            pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 mx-2 px-3 py-2.5 rounded-md text-sm transition-colors mb-px',
                active
                  ? 'bg-[#ebefe9] text-[#2d5a4f] font-bold'
                  : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
              )}
            >
              <Icon
                size={15}
                className={active ? 'text-[#2d5a4f]' : 'text-zinc-400'}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Globe + footer */}
      <div className="border-t border-zinc-100 pt-3 pb-2 flex flex-col items-center gap-2">
        <GlobeLoader />
        <p className="text-[10px] text-zinc-400 tracking-wider uppercase pb-1">
          Canton Network
        </p>
      </div>
    </aside>
  )
}
