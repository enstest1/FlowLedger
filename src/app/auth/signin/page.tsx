'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { Building2, Mail, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { CantonWalletConnect } from '@/components/canton-wallet-connect'

type Tab = 'email' | 'wallet'

export default function SignInPage() {
  const [tab, setTab] = useState<Tab>('wallet')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError('')
    try {
      const result = await signIn('email', { email, redirect: false, callbackUrl: '/' })
      if (result?.error) {
        setError('Failed to send magic link. Please try again.')
      } else {
        setSent(true)
      }
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border p-8">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-7 h-7 bg-primary flex items-center justify-center">
              <Building2 size={14} className="text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground tracking-tight">FlowLedger</span>
          </div>

          <h1 className="text-xl font-semibold text-foreground mb-1">Sign in</h1>
          <p className="text-muted-foreground mb-6 text-sm">
            Connect your Canton wallet or use an email link.
          </p>

          {/* Tab switcher */}
          <div className="flex border border-border mb-6">
            <button
              onClick={() => setTab('wallet')}
              className={`flex-1 text-sm py-2 font-medium transition-colors ${
                tab === 'wallet'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/5'
              }`}
            >
              Canton Wallet
            </button>
            <button
              onClick={() => setTab('email')}
              className={`flex-1 text-sm py-2 font-medium transition-colors border-l border-border ${
                tab === 'email'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/5'
              }`}
            >
              Email Link
            </button>
          </div>

          {tab === 'wallet' && (
            <CantonWalletConnect />
          )}

          {tab === 'email' && (
            <>
              {!sent ? (
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-9 pr-4 py-2.5 border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 px-3 py-2 border border-red-200">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full bg-primary text-primary-foreground py-2.5 font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 size={15} className="animate-spin" />}
                    {loading ? 'Sending...' : 'Send Magic Link'}
                  </button>
                </form>
              ) : (
                <div className="text-center py-4">
                  <div className="w-10 h-10 bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <Mail size={18} className="text-emerald-600" />
                  </div>
                  <p className="font-medium text-foreground mb-2">Check your inbox</p>
                  <p className="text-sm text-muted-foreground">
                    We sent a magic link to <strong>{email}</strong>.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Dev shortcuts */}
          <div className="mt-6 pt-5 border-t border-border">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">
              Dev shortcuts
            </p>
            <div className="flex gap-2">
              <a
                href="/api/dev/signin?email=admin@moltmoon.io"
                className="flex-1 text-center text-xs bg-purple-50 text-purple-700 py-2 hover:bg-purple-100 transition-colors font-medium border border-purple-200"
              >
                Admin
              </a>
              <a
                href="/api/dev/signin?email=approver@moltmoon.io"
                className="flex-1 text-center text-xs bg-muted text-zinc-600 py-2 hover:bg-border transition-colors font-medium border border-border"
              >
                Approver
              </a>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          <Link href="/" className="hover:text-foreground transition-colors">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}
