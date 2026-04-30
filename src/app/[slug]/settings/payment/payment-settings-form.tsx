'use client'
import { useState } from 'react'
import { updateOrgSettings } from '@/app/actions/org'
import { Loader2 } from 'lucide-react'

interface Props {
  orgId: string
  slug: string
  defaultAsset: string
  approvalThreshold: number
  requireDualApproval: boolean
  isAdmin: boolean
}

export function PaymentSettingsForm({
  orgId,
  defaultAsset,
  approvalThreshold: initialThreshold,
  requireDualApproval: initialDual,
  isAdmin,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const [threshold, setThreshold] = useState(initialThreshold.toString())
  const [dualApproval, setDualApproval] = useState(initialDual)
  const [asset, setAsset] = useState(defaultAsset)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    const result = await updateOrgSettings(orgId, {
      approvalThreshold: parseFloat(threshold),
      requireDualApproval: dualApproval,
      defaultAsset: asset,
    })

    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  return (
    <form
      onSubmit={handleSave}
      className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4"
    >
      <h2 className="font-semibold text-zinc-900">Approval Rules</h2>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
          Settings saved successfully
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1.5">
          Default Asset
        </label>
        <select
          value={asset}
          onChange={(e) => setAsset(e.target.value)}
          disabled={!isAdmin}
          className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b54] disabled:bg-zinc-50"
        >
          <option value="USDCX">USDCX</option>
          <option value="CC">CC</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1.5">
          Approval Threshold
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
            {asset}
          </span>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            disabled={!isAdmin}
            className="w-full pl-16 pr-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b54] disabled:bg-zinc-50"
          />
        </div>
        <p className="text-xs text-zinc-400 mt-1">
          Invoices above this amount require approval before payment
        </p>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="dualApproval"
          checked={dualApproval}
          onChange={(e) => setDualApproval(e.target.checked)}
          disabled={!isAdmin}
          className="rounded"
        />
        <label htmlFor="dualApproval" className="text-sm text-zinc-700">
          Require dual approval for all invoices
        </label>
      </div>

      {isAdmin && (
        <button
          type="submit"
          disabled={loading}
          className="bg-[#2d5a4f] text-white px-5 py-2.5 rounded-lg font-medium hover:bg-[#234740] transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      )}

      {!isAdmin && (
        <p className="text-sm text-zinc-400">
          Only admins can change payment settings.
        </p>
      )}
    </form>
  )
}
