import Link from 'next/link'
import { Shield, Zap, CheckCircle } from 'lucide-react'
import { FlowLedgerMark } from '@/components/flow-ledger-mark'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-zinc-100 px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <FlowLedgerMark size={28} />
          <span className="font-bold text-zinc-900 tracking-tight">FlowLedger</span>
        </div>
        <Link
          href="/auth/signin"
          className="bg-[#2d5a4f] text-white px-4 py-2 rounded-md text-sm font-bold hover:bg-[#234740] transition-colors"
        >
          Sign In
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 border border-[#b0c4b8] bg-[#ebefe9] text-[#2d5a4f] px-3 py-1 rounded text-xs font-bold mb-8 tracking-wider uppercase">
          <span className="w-1.5 h-1.5 bg-[#2d5a4f] rounded-full" />
          Powered by Canton Network
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 tracking-tight leading-snug mb-5">
          Invoice. Approve. Settle.{' '}
          <span className="text-[#2d5a4f]">Privately.</span>
        </h1>
        <p className="text-base text-zinc-500 max-w-xl mx-auto mb-10 leading-relaxed">
          Private invoice, approval, and batch payment workflow for Canton Network
          teams. Cryptographic proof of every transfer.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/auth/signin"
            className="bg-[#2d5a4f] text-white px-6 py-3 rounded-md font-bold hover:bg-[#234740] transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/auth/signin"
            className="border border-zinc-200 text-zinc-700 px-6 py-3 rounded-md font-bold hover:bg-zinc-50 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="border border-zinc-100 rounded-md p-6 bg-zinc-50">
            <div className="w-8 h-8 bg-[#ebefe9] rounded flex items-center justify-center mb-4">
              <Shield size={16} className="text-[#2d5a4f]" />
            </div>
            <h3 className="font-bold text-zinc-900 mb-2 text-sm">Private Invoicing</h3>
            <p className="text-zinc-500 text-xs leading-relaxed">
              Create and route invoices with Canton party IDs. Payment data stays
              private on the Canton ledger — visible only to counterparties.
            </p>
          </div>
          <div className="border border-zinc-100 rounded-md p-6 bg-zinc-50">
            <div className="w-8 h-8 bg-[#ebefe9] rounded flex items-center justify-center mb-4">
              <Zap size={16} className="text-[#2d5a4f]" />
            </div>
            <h3 className="font-bold text-zinc-900 mb-2 text-sm">Batch Payments</h3>
            <p className="text-zinc-500 text-xs leading-relaxed">
              Group approved invoices into payroll batches and settle multiple
              vendors in a single atomic operation on Canton Network.
            </p>
          </div>
          <div className="border border-zinc-100 rounded-md p-6 bg-zinc-50">
            <div className="w-8 h-8 bg-[#ebefe9] rounded flex items-center justify-center mb-4">
              <CheckCircle size={16} className="text-[#2d5a4f]" />
            </div>
            <h3 className="font-bold text-zinc-900 mb-2 text-sm">Proof of Transfer</h3>
            <p className="text-zinc-500 text-xs leading-relaxed">
              Every payment generates a Canton Update ID and cryptographic
              transfer object — immutable, auditable proof of settlement.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-100 py-6 text-center">
        <p className="text-xs text-zinc-400 tracking-wide">
          Powered by{' '}
          <span className="font-bold text-zinc-500">Canton Network</span>
          {' · '}FlowLedger MVP
        </p>
      </footer>
    </div>
  )
}
