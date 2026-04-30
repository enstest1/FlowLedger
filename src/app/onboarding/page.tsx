'use client'
import { useState } from 'react'
import { Building2, ChevronRight, Loader2, Check } from 'lucide-react'
import { createOrg } from '@/app/actions/org'

type Step = 1 | 2 | 3 | 4

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
}

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [orgName, setOrgName] = useState('')
  const [slug, setSlug] = useState('')
  const [treasuryPartyId, setTreasuryPartyId] = useState('')
  const [defaultAsset, setDefaultAsset] = useState<'USDCX' | 'CC'>('USDCX')
  const [approvalThreshold, setApprovalThreshold] = useState('1000')
  const [requireDualApproval, setRequireDualApproval] = useState(false)

  const handleNameChange = (name: string) => {
    setOrgName(name)
    setSlug(slugify(name))
  }

  const generateTreasuryId = () => {
    const fingerprint = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')
    const hint = slug || 'treasury'
    setTreasuryPartyId(`${hint}::${fingerprint}`)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    const result = await createOrg({
      name: orgName,
      slug,
      treasuryPartyId,
      defaultAsset,
      approvalThreshold: parseFloat(approvalThreshold),
      requireDualApproval,
    })
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
    // On success, createOrg redirects
  }

  const steps = [
    { n: 1, label: 'Organization' },
    { n: 2, label: 'Treasury' },
    { n: 3, label: 'Payments' },
    { n: 4, label: 'Review' },
  ]

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-8 h-8 bg-[#2d5a4f] rounded-lg flex items-center justify-center">
            <Building2 size={16} className="text-white" />
          </div>
          <span className="font-semibold text-zinc-900">FlowLedger</span>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  step > s.n
                    ? 'bg-[#2d5a4f] text-white'
                    : step === s.n
                    ? 'bg-[#2d5a4f] text-white'
                    : 'bg-zinc-200 text-zinc-500'
                }`}
              >
                {step > s.n ? <Check size={12} /> : s.n}
              </div>
              <span
                className={`text-xs ${step === s.n ? 'text-zinc-700 font-medium' : 'text-zinc-400'}`}
              >
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <ChevronRight size={14} className="text-zinc-300 mr-1" />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">
              {error}
            </p>
          )}

          {/* Step 1: Org details */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-zinc-900 mb-1">
                Name your organization
              </h2>
              <p className="text-zinc-500 text-sm mb-6">
                This will be your workspace in FlowLedger.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                    Organization name
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b54]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                    Workspace URL
                  </label>
                  <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden">
                    <span className="px-3 py-2.5 bg-zinc-50 text-zinc-400 text-sm border-r border-zinc-200">
                      flowledger.app/
                    </span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="acme-corp"
                      className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!orgName || !slug}
                className="mt-6 w-full bg-[#2d5a4f] text-white py-2.5 rounded-lg font-medium hover:bg-[#234740] transition-colors disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Treasury */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-zinc-900 mb-1">
                Treasury Canton Party ID
              </h2>
              <p className="text-zinc-500 text-sm mb-6">
                This is your organization&apos;s Canton party that will send payments.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                    Party ID
                  </label>
                  <textarea
                    value={treasuryPartyId}
                    onChange={(e) => setTreasuryPartyId(e.target.value)}
                    placeholder="hint::fingerprint (hex)"
                    rows={3}
                    className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#4d6b54]"
                  />
                  <p className="text-xs text-zinc-400 mt-1">
                    Format: hint::hexfingerprint (e.g. acme-treasury::a1b2c3...)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={generateTreasuryId}
                  className="text-sm text-[#2d5a4f] hover:text-[#234740] font-medium"
                >
                  Generate a demo party ID
                </button>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 border border-zinc-200 text-zinc-700 py-2.5 rounded-lg font-medium hover:bg-zinc-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!treasuryPartyId}
                  className="flex-1 bg-[#2d5a4f] text-white py-2.5 rounded-lg font-medium hover:bg-[#234740] transition-colors disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payment defaults */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-zinc-900 mb-1">
                Payment settings
              </h2>
              <p className="text-zinc-500 text-sm mb-6">
                Configure approval rules and default assets.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                    Default asset
                  </label>
                  <select
                    value={defaultAsset}
                    onChange={(e) =>
                      setDefaultAsset(e.target.value as 'USDCX' | 'CC')
                    }
                    className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b54]"
                  >
                    <option value="USDCX">USDCX (USD-backed stablecoin)</option>
                    <option value="CC">CC (Canton Coin)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                    Approval threshold
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
                      {defaultAsset}
                    </span>
                    <input
                      type="number"
                      value={approvalThreshold}
                      onChange={(e) => setApprovalThreshold(e.target.value)}
                      className="w-full pl-16 pr-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b54]"
                    />
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    Invoices above this amount require approval
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="dualApproval"
                    checked={requireDualApproval}
                    onChange={(e) => setRequireDualApproval(e.target.checked)}
                    className="rounded"
                  />
                  <label
                    htmlFor="dualApproval"
                    className="text-sm text-zinc-700"
                  >
                    Require dual approval for all invoices
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 border border-zinc-200 text-zinc-700 py-2.5 rounded-lg font-medium hover:bg-zinc-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="flex-1 bg-[#2d5a4f] text-white py-2.5 rounded-lg font-medium hover:bg-[#234740] transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-zinc-900 mb-1">
                Ready to launch
              </h2>
              <p className="text-zinc-500 text-sm mb-6">
                Review your settings before creating your workspace.
              </p>
              <div className="bg-zinc-50 rounded-xl p-4 space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Organization</span>
                  <span className="font-medium text-zinc-900">{orgName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Workspace URL</span>
                  <span className="font-mono text-zinc-700">/{slug}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Default asset</span>
                  <span className="font-medium text-zinc-900">{defaultAsset}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Approval threshold</span>
                  <span className="font-medium text-zinc-900">
                    {approvalThreshold} {defaultAsset}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Dual approval</span>
                  <span className="font-medium text-zinc-900">
                    {requireDualApproval ? 'Required' : 'Not required'}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  disabled={loading}
                  className="flex-1 border border-zinc-200 text-zinc-700 py-2.5 rounded-lg font-medium hover:bg-zinc-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-[#2d5a4f] text-white py-2.5 rounded-lg font-medium hover:bg-[#234740] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {loading ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
