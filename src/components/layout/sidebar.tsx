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
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
      ? [
          {
            href: `${base}/approvals`,
            label: 'Approvals',
            icon: CheckSquare,
          },
        ]
      : []),
    { href: `${base}/batches`, label: 'Payroll Batches', icon: Package },
    { href: `${base}/receipts`, label: 'Receipts', icon: Receipt },
    { href: `${base}/exports`, label: 'Exports', icon: Download },
    { href: `${base}/settings`, label: 'Settings', icon: Settings },
  ]

  return (
    <aside className="w-60 bg-white border-r border-zinc-200 flex flex-col min-h-screen">
      <div className="p-4 border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Building2 size={16} className="text-white" />
          </div>
          <div>
            <p className="text-xs text-zinc-500">FlowLedger</p>
            <p className="text-sm font-medium text-zinc-900 truncate max-w-[140px]">
              {orgName}
            </p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const active =
            pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5',
                active
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-zinc-200">
        <p className="text-xs text-zinc-400 text-center">
          Powered by Canton Network
        </p>
      </div>
    </aside>
  )
}
