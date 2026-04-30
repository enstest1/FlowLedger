'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBatch } from '@/app/actions/batch'
import { ArrowLeft, AlertCircle, Loader2, CheckCircle, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { formatAmount } from '@/lib/utils'

interface InvoiceOption {
  id: string
  invoiceNumber: string
  vendorName: string
  vendorPartyId: string
  vendorPreApprovalStatus: string
  amount: number
  assetId: string
  description: string
}

interface Props {
  orgId: string
  slug: string
  defaultAsset: string
  treasuryBalance: number
  approvedInvoices: InvoiceOption[]
}

type Step = 1 | 2 | 3

export function NewBatchWizard({
  orgId,
  slug,
  defaultAsset,
  treasuryBalance,
  approvedInvoices,
}: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [assetFilter, setAssetFilter] = useState(defaultAsset)
  const [batchName, setBatchName] = useState('')

  const filteredInvoices = approvedInvoices.filter(
    (inv) => inv.assetId === assetFilter
  )

  const selectedInvoices = filteredInvoices.filter((inv) =>
    selectedIds.includes(inv.id)
  )

  const total = selectedInvoices.reduce((sum, inv) => sum + inv.amount, 0)
  const hasExpiredApprovals = selectedInvoices.some(
    (inv) => inv.vendorPreApprovalStatus === 'EXPIRED'
  )
  const hasInsufficientBalance = total > treasuryBalance

  const toggleInvoice = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    if (selectedIds.length === filteredInvoices.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredInvoices.map((i) => i.id))
    }
  }

  const handleCreate = async () => {
    if (!batchName) return
    setLoading(true)
    setError('')

    const result = await createBatch(orgId, {
      name: batchName,
      invoiceIds: selectedIds,
      assetId: assetFilter,
    })

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push(`/${slug}/batches/${result.data?.id}`)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/batches`}
          className="text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">New Payroll Batch</h1>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2">
        {([1, 2, 3] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                step > s
                  ? 'bg-[#2d5a4f] text-white'
                  : step === s
                  ? 'bg-[#2d5a4f] text-white'
                  : 'bg-zinc-200 text-zinc-500'
              }`}
            >
              {step > s ? <CheckCircle size={14} /> : s}
            </div>
            <span className={`text-xs ${step === s ? 'text-zinc-700 font-medium' : 'text-zinc-400'}`}>
              {s === 1 ? 'Select' : s === 2 ? 'Review' : 'Pre-flight'}
            </span>
            {i < 2 && <ChevronRight size={14} className="text-zinc-300 mr-1" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Select invoices */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900">Select Invoices</h2>
            <select
              value={assetFilter}
              onChange={(e) => {
                setAssetFilter(e.target.value)
                setSelectedIds([])
              }}
              className="text-sm border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none"
            >
              <option value="USDCX">USDCX</option>
              <option value="CC">CC</option>
            </select>
          </div>

          {filteredInvoices.length === 0 ? (
            <p className="text-sm text-zinc-400 py-4 text-center">
              No approved invoices with asset {assetFilter}
            </p>
          ) : (
            <>
              <div className="border border-zinc-100 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50">
                      <th className="px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === filteredInvoices.length}
                          onChange={toggleAll}
                          className="rounded"
                        />
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">
                        Invoice
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">
                        Vendor
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer"
                        onClick={() => toggleInvoice(inv.id)}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(inv.id)}
                            onChange={() => {}}
                            className="rounded"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="text-sm font-medium text-zinc-900">
                            {inv.invoiceNumber}
                          </p>
                          <p className="text-xs text-zinc-400 max-w-xs truncate">
                            {inv.description}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="text-sm text-zinc-700">{inv.vendorName}</p>
                          {inv.vendorPreApprovalStatus === 'EXPIRED' && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle size={10} />
                              Pre-approval expired
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm font-medium text-zinc-900">
                          {formatAmount(inv.amount, inv.assetId)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                <span className="text-sm text-zinc-500">
                  {selectedIds.length} selected
                </span>
                <span className="text-base font-bold text-zinc-900">
                  {formatAmount(total, assetFilter)}
                </span>
              </div>
            </>
          )}

          <button
            onClick={() => setStep(2)}
            disabled={selectedIds.length === 0}
            className="w-full bg-[#2d5a4f] text-white py-2.5 rounded-lg font-medium hover:bg-[#234740] transition-colors disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
          <h2 className="font-semibold text-zinc-900">Review Batch</h2>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Batch name *
            </label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder={`${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()} Payroll`}
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b54]"
            />
          </div>

          <div className="bg-zinc-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Invoices</span>
              <span className="font-medium text-zinc-900">
                {selectedInvoices.length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Asset</span>
              <span className="font-medium text-zinc-900">{assetFilter}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-zinc-200 pt-2 mt-2">
              <span className="font-semibold text-zinc-700">Total</span>
              <span className="font-bold text-zinc-900">
                {formatAmount(total, assetFilter)}
              </span>
            </div>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedInvoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between py-2 border-b border-zinc-50 text-sm"
              >
                <div>
                  <p className="font-medium text-zinc-900">{inv.invoiceNumber}</p>
                  <p className="text-xs text-zinc-400">{inv.vendorName}</p>
                </div>
                <span className="font-medium text-zinc-900">
                  {formatAmount(inv.amount, inv.assetId)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 border border-zinc-200 text-zinc-700 py-2.5 rounded-lg font-medium hover:bg-zinc-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!batchName}
              className="flex-1 bg-[#2d5a4f] text-white py-2.5 rounded-lg font-medium hover:bg-[#234740] transition-colors disabled:opacity-50"
            >
              Pre-flight Check
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Pre-flight */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
          <h2 className="font-semibold text-zinc-900">Pre-flight Check</h2>

          <div className="space-y-3">
            {/* Balance check */}
            <div
              className={`flex items-center gap-3 p-3 rounded-lg ${
                hasInsufficientBalance
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-emerald-50 border border-emerald-200'
              }`}
            >
              {hasInsufficientBalance ? (
                <AlertCircle size={16} className="text-red-600 shrink-0" />
              ) : (
                <CheckCircle size={16} className="text-emerald-600 shrink-0" />
              )}
              <div>
                <p
                  className={`text-sm font-medium ${hasInsufficientBalance ? 'text-red-700' : 'text-emerald-700'}`}
                >
                  Treasury Balance
                </p>
                <p
                  className={`text-xs ${hasInsufficientBalance ? 'text-red-600' : 'text-emerald-600'}`}
                >
                  Available: {formatAmount(treasuryBalance, assetFilter)} · Need:{' '}
                  {formatAmount(total, assetFilter)}
                  {hasInsufficientBalance && ' — Insufficient!'}
                </p>
              </div>
            </div>

            {/* Pre-approval check */}
            <div
              className={`flex items-center gap-3 p-3 rounded-lg ${
                hasExpiredApprovals
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-emerald-50 border border-emerald-200'
              }`}
            >
              {hasExpiredApprovals ? (
                <AlertCircle size={16} className="text-red-600 shrink-0" />
              ) : (
                <CheckCircle size={16} className="text-emerald-600 shrink-0" />
              )}
              <div>
                <p
                  className={`text-sm font-medium ${hasExpiredApprovals ? 'text-red-700' : 'text-emerald-700'}`}
                >
                  Vendor Pre-Approvals
                </p>
                <p
                  className={`text-xs ${hasExpiredApprovals ? 'text-red-600' : 'text-emerald-600'}`}
                >
                  {hasExpiredApprovals
                    ? 'Some vendors have expired pre-approvals. Renew before executing.'
                    : 'All vendor pre-approvals are active'}
                </p>
              </div>
            </div>

            {/* Invoice count */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCircle size={16} className="text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-700">
                  Invoices Ready
                </p>
                <p className="text-xs text-emerald-600">
                  {selectedInvoices.length} approved invoice{selectedInvoices.length !== 1 ? 's' : ''} queued
                </p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-50 rounded-xl p-4 flex justify-between">
            <span className="text-sm font-semibold text-zinc-700">
              Total to settle
            </span>
            <span className="text-base font-bold text-zinc-900">
              {formatAmount(total, assetFilter)}
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              disabled={loading}
              className="flex-1 border border-zinc-200 text-zinc-700 py-2.5 rounded-lg font-medium hover:bg-zinc-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={
                loading || hasExpiredApprovals || hasInsufficientBalance
              }
              className="flex-1 bg-[#2d5a4f] text-white py-2.5 rounded-lg font-medium hover:bg-[#234740] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Creating...' : 'Create Batch'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
