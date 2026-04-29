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
  }

  const steps = [
    { n: 1, label: 'Organization' },
    { n: 2, label: 'Treasury' },
    { n: 3, label: 'Payments' },
    { n: 4, label: 'Review' },
  ]

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-7 h-7 bg-primary flex items-center justify-center">
            <Building2 size={14} className="text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground tracking-tight">FlowLedger</span>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 flex items-center justify-center text-xs font-medium transition-colors ${
                  step > s.n
                    ? 'bg-primary text-primary-foreground'
                    : step === s.n
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-border text-muted-foreground'
                }`}
              >
                {step > s.n ? <Check size={11} /> : s.n}
              </div>
              <span
                className={`text-xs ${step === s.n ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
              >
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <ChevronRight size={13} className="text-muted-foreground/50 mr-1" />
              )}
            </div>
          ))}
        </div>

        <div className="bg-card border border-border p-8">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 border border-red-200 mb-4">
              {error}
            </p>
          )}

          {/* Step 1: Org details */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">
                Name your organization
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                This will be your workspace in FlowLedger.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                    Organization name
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full px-3 py-2.5 border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                    Workspace URL
                  </label>
                  <div className="flex items-center border border-border overflow-hidden">
                    <span className="px-3 py-2.5 bg-muted text-muted-foreground text-sm border-r border-border">
                      flowledger.app/
                    </span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="acme-corp"
                      className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-background"
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!orgName || !slug}
                className="mt-6 w-full bg-primary text-primary-foreground py-2.5 font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Treasury */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">
                Treasury Canton Party ID
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                Your organization&apos;s Canton party that will send payments.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                    Party ID
                  </label>
                  <textarea
                    value={treasuryPartyId}
                    onChange={(e) => setTreasuryPartyId(e.target.value)}
                    placeholder="hint::fingerprint (hex)"
                    rows={3}
                    className="w-full px-3 py-2.5 border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Format: hint::hexfingerprint
                  </p>
                </div>
                <button
                  type="button"
                  onClick={generateTreasuryId}
                  className="text-sm text-primary hover:text-primary/80 font-medium"
                >
                  Generate a demo party ID
                </button>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 border border-border text-foreground py-2.5 font-medium hover:bg-black/5 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!treasuryPartyId}
                  className="flex-1 bg-primary text-primary-foreground py-2.5 font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payment defaults */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">
                Payment settings
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                Configure approval rules and default assets.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                    Default asset
                  </label>
                  <select
                    value={defaultAsset}
                    onChange={(e) =>
                      setDefaultAsset(e.target.value as 'USDCX' | 'CC')
                    }
                    className="w-full px-3 py-2.5 border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="USDCX">USDCX (USD-backed stablecoin)</option>
                    <option value="CC">CC (Canton Coin)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                    Approval threshold
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      {defaultAsset}
                    </span>
                    <input
                      type="number"
                      value={approvalThreshold}
                      onChange={(e) => setApprovalThreshold(e.target.value)}
                      className="w-full pl-16 pr-4 py-2.5 border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Invoices above this amount require approval
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="dualApproval"
                    checked={requireDualApproval}
                    onChange={(e) => setRequireDualApproval(e.target.checked)}
                    className="accent-primary"
                  />
                  <label
                    htmlFor="dualApproval"
                    className="text-sm text-foreground"
                  >
                    Require dual approval for all invoices
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 border border-border text-foreground py-2.5 font-medium hover:bg-black/5 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="flex-1 bg-primary text-primary-foreground py-2.5 font-medium hover:bg-primary/90 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">
                Ready to launch
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                Review your settings before creating your workspace.
              </p>
              <div className="bg-muted border border-border p-4 space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Organization</span>
                  <span className="font-medium text-foreground">{orgName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Workspace URL</span>
                  <span className="font-mono text-foreground">/{slug}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Default asset</span>
                  <span className="font-medium text-foreground">{defaultAsset}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Approval threshold</span>
                  <span className="font-medium text-foreground">
                    {approvalThreshold} {defaultAsset}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dual approval</span>
                  <span className="font-medium text-foreground">
                    {requireDualApproval ? 'Required' : 'Not required'}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  disabled={loading}
                  className="flex-1 border border-border text-foreground py-2.5 font-medium hover:bg-black/5 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-primary text-primary-foreground py-2.5 font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
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
