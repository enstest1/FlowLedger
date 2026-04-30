import Link from 'next/link'
import { Building2, Shield, Zap, CheckCircle } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-zinc-100 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Building2 size={16} className="text-white" />
          </div>
          <span className="font-semibold text-zinc-900">FlowLedger</span>
        </div>
        <Link
          href="/auth/signin"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Sign In
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium mb-6">
          <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
          Powered by Canton Network
        </div>
        <h1 className="text-5xl font-bold text-zinc-900 tracking-tight leading-tight mb-6">
          Invoice. Approve. Settle.{' '}
          <span className="text-indigo-600">Privately.</span>
        </h1>
        <p className="text-xl text-zinc-500 max-w-2xl mx-auto mb-10">
          FlowLedger is the private invoice, approval, and payment workflow built
          for Canton Network teams. Issue invoices, route approvals, and settle
          in USDCX — with cryptographic proof of every transfer.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/auth/signin"
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors text-lg"
          >
            Get Started
          </Link>
          <Link
            href="/auth/signin"
            className="border border-zinc-200 text-zinc-700 px-6 py-3 rounded-lg font-medium hover:bg-zinc-50 transition-colors text-lg"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-zinc-50 rounded-2xl p-6">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
              <Shield size={20} className="text-indigo-600" />
            </div>
            <h3 className="font-semibold text-zinc-900 mb-2">Private Invoicing</h3>
            <p className="text-zinc-500 text-sm">
              Create and route invoices with Canton party IDs. All payment data
              stays private on the Canton ledger — visible only to counterparties.
            </p>
          </div>
          <div className="bg-zinc-50 rounded-2xl p-6">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
              <Zap size={20} className="text-indigo-600" />
            </div>
            <h3 className="font-semibold text-zinc-900 mb-2">Batch Payments</h3>
            <p className="text-zinc-500 text-sm">
              Group approved invoices into payroll batches and settle multiple
              vendors in a single atomic operation on Canton Network.
            </p>
          </div>
          <div className="bg-zinc-50 rounded-2xl p-6">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
              <CheckCircle size={20} className="text-indigo-600" />
            </div>
            <h3 className="font-semibold text-zinc-900 mb-2">Proof of Transfer</h3>
            <p className="text-zinc-500 text-sm">
              Every payment generates a Canton Update ID and cryptographic
              transfer object — immutable, auditable proof of settlement.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 py-8 text-center">
        <p className="text-zinc-400 text-sm">
          Powered by{' '}
          <span className="font-medium text-zinc-600">Canton Network</span> ·
          FlowLedger MVP
        </p>
      </footer>
    </div>
  )
}
