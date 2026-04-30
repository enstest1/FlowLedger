'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createInvoice } from '@/app/actions/invoice'
import { ArrowLeft, Plus, Trash2, Loader2, Info } from 'lucide-react'
import Link from 'next/link'
import { generateInvoiceNumber } from '@/lib/utils'

interface Vendor {
  id: string
  name: string
  email: string
}

interface LineItem {
  description: string
  quantity: number
  unitPrice: number
}

interface Props {
  orgId: string
  slug: string
  vendors: Vendor[]
  approvalThreshold: number
  defaultAsset: string
  existingInvoiceNumbers: string[]
}

export function NewInvoiceForm({
  orgId,
  slug,
  vendors,
  approvalThreshold,
  defaultAsset,
  existingInvoiceNumbers,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? '')
  const [description, setDescription] = useState('')
  const [assetId, setAssetId] = useState<'USDCX' | 'CC'>(
    defaultAsset as 'USDCX' | 'CC'
  )
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  })
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0 },
  ])

  const totalAmount = lineItems.reduce(
    (sum, li) => sum + li.quantity * li.unitPrice,
    0
  )

  const suggestedInvoiceNumber = generateInvoiceNumber(existingInvoiceNumbers)
  const needsApproval = totalAmount >= approvalThreshold

  const addLineItem = () =>
    setLineItems([
      ...lineItems,
      { description: '', quantity: 1, unitPrice: 0 },
    ])

  const removeLineItem = (idx: number) =>
    setLineItems(lineItems.filter((_, i) => i !== idx))

  const updateLineItem = (idx: number, field: keyof LineItem, value: string | number) => {
    setLineItems(
      lineItems.map((li, i) =>
        i === idx ? { ...li, [field]: value } : li
      )
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (totalAmount <= 0) {
      setError('Invoice total must be greater than 0')
      return
    }
    setLoading(true)
    setError('')

    const result = await createInvoice(orgId, {
      vendorId,
      amount: totalAmount,
      assetId,
      description,
      dueDate,
      lineItems: JSON.stringify(lineItems),
    })

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push(`/${slug}/invoices`)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/invoices`}
          className="text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">New Invoice</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            Invoice #{suggestedInvoiceNumber}
          </p>
        </div>
      </div>

      {needsApproval && totalAmount > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
          <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            This invoice ({assetId} {totalAmount.toLocaleString()}) exceeds the approval
            threshold of {assetId} {approvalThreshold.toLocaleString()} and will require
            approval before payment.
          </p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5"
      >
        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Vendor *
            </label>
            {vendors.length === 0 ? (
              <p className="text-sm text-zinc-400">
                <Link href={`/${slug}/vendors/new`} className="text-[#2d5a4f]">
                  Add a vendor first
                </Link>
              </p>
            ) : (
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b54]"
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Asset
            </label>
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value as 'USDCX' | 'CC')}
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b54]"
            >
              <option value="USDCX">USDCX</option>
              <option value="CC">CC</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={2}
            placeholder="Frontend development — April 2024"
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b54]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            Due date *
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b54]"
          />
        </div>

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-zinc-700">
              Line Items
            </label>
            <button
              type="button"
              onClick={addLineItem}
              className="text-xs text-[#2d5a4f] hover:text-[#234740] font-medium flex items-center gap-1"
            >
              <Plus size={12} />
              Add line
            </button>
          </div>
          <div className="space-y-2">
            {lineItems.map((li, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <input
                  type="text"
                  value={li.description}
                  onChange={(e) =>
                    updateLineItem(idx, 'description', e.target.value)
                  }
                  placeholder="Description"
                  className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b54]"
                />
                <input
                  type="number"
                  value={li.quantity}
                  onChange={(e) =>
                    updateLineItem(idx, 'quantity', Number(e.target.value))
                  }
                  min={1}
                  placeholder="Qty"
                  className="w-16 px-2 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b54]"
                />
                <input
                  type="number"
                  value={li.unitPrice || ''}
                  onChange={(e) =>
                    updateLineItem(idx, 'unitPrice', Number(e.target.value))
                  }
                  min={0}
                  step="0.01"
                  placeholder="Price"
                  className="w-24 px-2 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b54]"
                />
                {lineItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLineItem(idx)}
                    className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="pt-3 border-t border-zinc-100 flex justify-between items-center">
          <span className="text-sm font-medium text-zinc-700">Total</span>
          <span className="text-lg font-bold text-zinc-900">
            {totalAmount.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            {assetId}
          </span>
        </div>

        <div className="flex gap-3 pt-2">
          <Link
            href={`/${slug}/invoices`}
            className="flex-1 text-center border border-zinc-200 text-zinc-700 py-2.5 rounded-lg font-medium hover:bg-zinc-50 transition-colors text-sm"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !vendorId || !description || totalAmount <= 0}
            className="flex-1 bg-[#2d5a4f] text-white py-2.5 rounded-lg font-medium hover:bg-[#234740] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  )
}
