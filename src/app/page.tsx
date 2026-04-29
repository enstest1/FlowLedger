import Link from 'next/link'
import { Building2, Shield, Zap, CheckCircle } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border px-6 py-3.5 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary flex items-center justify-center">
            <Building2 size={14} className="text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground tracking-tight">FlowLedger</span>
        </div>
        <Link
          href="/auth/signin"
          className="bg-primary text-primary-foreground px-4 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Sign In
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1 text-xs font-medium uppercase tracking-widest mb-8">
          Powered by Canton Network
        </div>
        <h1 className="text-5xl font-semibold text-foreground tracking-tight leading-tight mb-6">
          Invoice. Approve. Settle.{' '}
          <span className="text-primary">Privately.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
          Private invoice, approval, and payment workflow for Canton Network teams.
          Issue invoices, route approvals, and settle in USDCX — with cryptographic
          proof of every transfer.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/auth/signin"
            className="bg-primary text-primary-foreground px-6 py-2.5 font-medium hover:bg-primary/90 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/auth/signin"
            className="border border-border text-foreground px-6 py-2.5 font-medium hover:bg-black/5 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-px bg-border">
          <div className="bg-card p-8">
            <div className="w-8 h-8 bg-purple-100 flex items-center justify-center mb-5">
              <Shield size={16} className="text-purple-700" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Private Invoicing</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Create and route invoices with Canton party IDs. All payment data
              stays private on the Canton ledger — visible only to counterparties.
            </p>
          </div>
          <div className="bg-card p-8">
            <div className="w-8 h-8 bg-purple-100 flex items-center justify-center mb-5">
              <Zap size={16} className="text-purple-700" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Batch Payments</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Group approved invoices into payroll batches and settle multiple
              vendors in a single atomic operation on Canton Network.
            </p>
          </div>
          <div className="bg-card p-8">
            <div className="w-8 h-8 bg-purple-100 flex items-center justify-center mb-5">
              <CheckCircle size={16} className="text-purple-700" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Proof of Transfer</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Every payment generates a Canton Update ID and cryptographic
              transfer object — immutable, auditable proof of settlement.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center">
        <p className="text-muted-foreground text-sm">
          Powered by{' '}
          <span className="font-medium text-foreground">Canton Network</span>{' '}
          · FlowLedger MVP
        </p>
      </footer>
    </div>
  )
}
