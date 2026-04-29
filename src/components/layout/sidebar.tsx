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
    <aside className="w-60 bg-sidebar border-r border-sidebar-border flex flex-col min-h-screen">
      <div className="px-4 py-3.5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-primary flex items-center justify-center shrink-0">
            <Building2 size={14} className="text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none mb-0.5">FlowLedger</p>
            <p className="text-sm font-medium text-foreground truncate">{orgName}</p>
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
                'flex items-center gap-2.5 px-3 py-2 text-sm transition-colors mb-px border-l-2',
                active
                  ? 'border-primary bg-primary/8 text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:bg-black/5 hover:text-foreground'
              )}
            >
              <Icon size={15} strokeWidth={active ? 2 : 1.5} />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="px-4 py-3 border-t border-sidebar-border">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
          Canton Network
        </p>
      </div>
    </aside>
  )
}
