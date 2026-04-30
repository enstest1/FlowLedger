'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { Mail, Loader2 } from 'lucide-react'
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
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-md border border-zinc-200 p-8">
          {/* Brand */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-7 h-7 bg-indigo-600 rounded-sm flex items-center justify-center">
              <span className="text-white text-xs font-bold">FL</span>
            </div>
            <span className="font-bold text-zinc-900 tracking-tight">FlowLedger</span>
          </div>

          <h1 className="text-xl font-bold text-zinc-900 mb-1">Sign in</h1>
          <p className="text-zinc-500 mb-6 text-xs leading-relaxed">
            Connect your Canton wallet or use an email magic link.
          </p>

          {/* Tab switcher — Hick's Law: two clear options, no more */}
          <div className="flex gap-1 bg-zinc-100 rounded p-1 mb-6">
            <button
              onClick={() => setTab('wallet')}
              className={`flex-1 text-xs py-2 rounded font-bold transition-colors ${
                tab === 'wallet'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Canton Wallet
            </button>
            <button
              onClick={() => setTab('email')}
              className={`flex-1 text-xs py-2 rounded font-bold transition-colors ${
                tab === 'email'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Email Link
            </button>
          </div>

          {tab === 'wallet' && <CantonWalletConnect />}

          {tab === 'email' && (
            <>
              {!sent ? (
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-9 pr-4 py-2.5 border border-zinc-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded">
                      {error}
                    </p>
                  )}

                  {/* Fitts's Law: full-width, generous height primary button */}
                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full bg-indigo-600 text-white py-3 rounded-md font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 size={14} className="animate-spin" />}
                    {loading ? 'Sending…' : 'Send Magic Link'}
                  </button>
                </form>
              ) : (
                <div className="text-center py-4">
                  <div className="w-10 h-10 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail size={18} className="text-emerald-600" />
                  </div>
                  <p className="font-bold text-zinc-900 mb-1 text-sm">Check your inbox</p>
                  <p className="text-xs text-zinc-500">
                    We sent a magic link to <span className="font-bold">{email}</span>.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Dev shortcuts */}
          <div className="mt-6 pt-5 border-t border-zinc-100">
            <p className="text-[10px] text-zinc-400 mb-2.5 text-center tracking-wider uppercase">
              Dev shortcuts
            </p>
            <div className="flex gap-2">
              <a
                href="/api/dev/signin?email=admin@moltmoon.io"
                className="flex-1 text-center text-xs bg-indigo-50 text-indigo-700 py-2.5 rounded-md hover:bg-indigo-100 transition-colors font-bold border border-indigo-100"
              >
                Admin
              </a>
              <a
                href="/api/dev/signin?email=approver@moltmoon.io"
                className="flex-1 text-center text-xs bg-zinc-100 text-zinc-600 py-2.5 rounded-md hover:bg-zinc-200 transition-colors font-bold border border-zinc-200"
              >
                Approver
              </a>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-400 mt-4">
          <Link href="/" className="hover:text-zinc-600 transition-colors">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}
