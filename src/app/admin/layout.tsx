import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

const ADMIN_EMAILS = (process.env.FLOWLEDGER_ADMIN_EMAILS ?? 'admin@flowledger.io')
  .split(',')
  .map((e) => e.trim().toLowerCase())

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.email) redirect('/auth/signin')

  if (!ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white px-6 py-3 flex items-center gap-3">
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
          FlowLedger
        </span>
        <span className="text-zinc-200">·</span>
        <span className="text-xs font-bold text-[#2d5a4f] uppercase tracking-widest">
          Operator Console
        </span>
        <div className="ml-auto">
          <span className="text-[10px] text-zinc-400">{session.user.email}</span>
        </div>
      </div>
      {children}
    </div>
  )
}
