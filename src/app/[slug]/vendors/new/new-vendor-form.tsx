'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createVendor } from '@/app/actions/vendor'
import { ArrowLeft, Info, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Props {
  orgId: string
  slug: string
}

export function NewVendorForm({ orgId, slug }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [cantonPartyId, setCantonPartyId] = useState('')
  const [preferredAsset, setPreferredAsset] = useState<'USDCX' | 'CC'>('USDCX')
  const [notes, setNotes] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await createVendor(orgId, {
      name,
      email,
      cantonPartyId,
      preferredAsset,
      notes,
    })
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push(`/${slug}/vendors`)
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/vendors`}
          className="text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Add Vendor</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            Register a new vendor on Canton Network
          </p>
        </div>
      </div>

      <div className="bg-[#ebefe9] border border-[#d6dcd2] rounded-xl p-4 flex gap-3">
        <Info size={16} className="text-[#2d5a4f] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[#1a332d] mb-0.5">
            Canton Pre-Approval
          </p>
          <p className="text-xs text-[#234740]">
            When you add a vendor, FlowLedger automatically registers their
            party on Canton and sets up a transfer pre-approval valid for 90
            days. This enables seamless payments without per-transaction
            confirmations.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4"
      >
        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Full name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b54]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b54]"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            Canton Party ID *
          </label>
          <input
            type="text"
            value={cantonPartyId}
            onChange={(e) => setCantonPartyId(e.target.value)}
            placeholder="alice::a1b2c3d4..."
            required
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#4d6b54]"
          />
          <p className="text-xs text-zinc-400 mt-1">
            Format: hint::hexfingerprint
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            Preferred asset
          </label>
          <select
            value={preferredAsset}
            onChange={(e) =>
              setPreferredAsset(e.target.value as 'USDCX' | 'CC')
            }
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b54]"
          >
            <option value="USDCX">USDCX</option>
            <option value="CC">CC</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b54]"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Link
            href={`/${slug}/vendors`}
            className="flex-1 text-center border border-zinc-200 text-zinc-700 py-2.5 rounded-lg font-medium hover:bg-zinc-50 transition-colors text-sm"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !name || !email || !cantonPartyId}
            className="flex-1 bg-[#2d5a4f] text-white py-2.5 rounded-lg font-medium hover:bg-[#234740] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Adding...' : 'Add Vendor'}
          </button>
        </div>
      </form>
    </div>
  )
}
