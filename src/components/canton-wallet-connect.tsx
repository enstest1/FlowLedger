'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet, AlertCircle, CheckCircle, Loader2, ExternalLink } from 'lucide-react'
import {
  isCantonWalletInstalled,
  connectCantonWallet,
  validatePartyIdFormat,
} from '@/lib/canton/wallet-client'

type Mode = 'idle' | 'connecting' | 'manual' | 'success' | 'error'

interface CantonWalletConnectProps {
  // If provided, links the wallet to an existing signed-in user (settings page)
  // If not provided, creates/finds a user and signs them in (sign-in page)
  linkOnly?: boolean
  onSuccess?: (partyId: string) => void
}

export function CantonWalletConnect({ linkOnly = false, onSuccess }: CantonWalletConnectProps) {
  const router = useRouter()
  const [walletInstalled, setWalletInstalled] = useState(false)
  const [mode, setMode] = useState<Mode>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [partyId, setPartyId] = useState('')
  const [error, setError] = useState('')
  const [connectedPartyId, setConnectedPartyId] = useState('')

  useEffect(() => {
    setWalletInstalled(isCantonWalletInstalled())
  }, [])

  async function handleWalletConnect() {
    setMode('connecting')
    setError('')
    try {
      const info = await connectCantonWallet()
      await submitPartyId(info.partyId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wallet connection failed')
      setMode('error')
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validatePartyIdFormat(partyId)) {
      setError('Invalid format. Canton party IDs look like: yourname::1a2b3c4d...')
      return
    }
    setSubmitting(true)
    setError('')
    await submitPartyId(partyId)
    setSubmitting(false)
  }

  async function submitPartyId(id: string) {
    try {
      if (linkOnly) {
        // Just save to user profile — handled by parent via onSuccess
        setConnectedPartyId(id)
        setMode('success')
        onSuccess?.(id)
        return
      }

      // Sign-in flow: POST to create/find user + session
      const res = await fetch('/api/auth/canton-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partyId: id }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed')
      }

      setConnectedPartyId(id)
      setMode('success')

      // Set session cookie — the server returned a redirectTo but no cookie yet.
      // Re-use the dev signin route to actually set the cookie.
      // In production: the POST would set the cookie directly.
      // For now, redirect to dev signin which does the cookie dance.
      setTimeout(() => {
        router.push(data.redirectTo)
        router.refresh()
      }, 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setMode('error')
    }
  }

  if (mode === 'success') {
    return (
      <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
        <CheckCircle size={16} />
        Connected: <span className="font-mono text-xs">{connectedPartyId.substring(0, 20)}...</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Primary: connect browser wallet if installed */}
      {walletInstalled ? (
        <button
          onClick={handleWalletConnect}
          disabled={mode === 'connecting'}
          className="w-full flex items-center justify-center gap-2 bg-[#2d5a4f] text-white py-2.5 px-4 rounded-lg font-medium text-sm hover:bg-[#234740] transition-colors disabled:opacity-50"
        >
          {mode === 'connecting' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Wallet size={16} />
          )}
          {mode === 'connecting' ? 'Connecting...' : 'Connect Canton Wallet'}
        </button>
      ) : (
        <div className="rounded-lg border border-zinc-200 p-3 bg-zinc-50 text-sm text-zinc-600 flex gap-2">
          <AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <span>
            Canton wallet extension not detected.{' '}
            <a
              href="https://sync.global"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2d5a4f] hover:underline inline-flex items-center gap-0.5"
            >
              Get the wallet <ExternalLink size={11} />
            </a>
            , or enter your party ID manually below.
          </span>
        </div>
      )}

      {/* Toggle manual entry */}
      {mode !== 'manual' ? (
        <button
          onClick={() => { setMode('manual'); setError('') }}
          className="w-full text-sm text-zinc-500 hover:text-zinc-700 transition-colors py-1"
        >
          Enter party ID manually →
        </button>
      ) : (
        <form onSubmit={handleManualSubmit} className="space-y-2">
          <label className="block text-xs font-medium text-zinc-700">
            Canton Party ID
          </label>
          <input
            type="text"
            value={partyId}
            onChange={(e) => setPartyId(e.target.value)}
            placeholder="yourname::1a2b3c4d5e6f..."
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#4d6b54]"
            autoFocus
          />
          <p className="text-xs text-zinc-400">
            Find this in your Canton wallet app (Five North Loop or Canton Network wallet).
          </p>
          <button
            type="submit"
            disabled={!partyId || submitting}
            className="w-full bg-[#2d5a4f] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#234740] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? 'Connecting...' : 'Connect'}
          </button>
        </form>
      )}

      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1.5">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  )
}
