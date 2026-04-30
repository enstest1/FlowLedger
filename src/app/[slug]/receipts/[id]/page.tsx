'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { Copy, Check, ChevronDown, ChevronUp, ArrowLeft, Building2 } from 'lucide-react'
import Link from 'next/link'

interface ReceiptData {
  id: string
  invoiceId: string
  batchId: string
  payerParty: string
  payeeParty: string
  amount: number
  assetId: string
  updateId: string
  transferObjectJson: string
  paymentReference: string | null
  paidAt: string
  invoice: {
    invoiceNumber: string
    description: string
    vendor: { name: string; email: string }
  }
}

export default function ReceiptPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>()
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [jsonExpanded, setJsonExpanded] = useState(false)
  const [copiedUpdateId, setCopiedUpdateId] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)

  useEffect(() => {
    fetch(`/api/receipts/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setReceipt(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  const copyUpdateId = async () => {
    if (!receipt) return
    await navigator.clipboard.writeText(receipt.updateId)
    setCopiedUpdateId(true)
    setTimeout(() => setCopiedUpdateId(false), 2000)
  }

  const copyJson = async () => {
    if (!receipt) return
    await navigator.clipboard.writeText(receipt.transferObjectJson)
    setCopiedJson(true)
    setTimeout(() => setCopiedJson(false), 2000)
  }

  if (loading) {
    return (
      <div className="max-w-2xl">
        <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center">
          <p className="text-zinc-400">Loading receipt...</p>
        </div>
      </div>
    )
  }

  if (!receipt) {
    return (
      <div className="max-w-2xl">
        <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center">
          <p className="text-zinc-400">Receipt not found</p>
        </div>
      </div>
    )
  }

  const transferObj = (() => {
    try {
      return JSON.parse(receipt.transferObjectJson)
    } catch {
      return null
    }
  })()

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/receipts`}
          className="text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900">Payment Receipt</h1>
      </div>

      {/* Main receipt card */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="bg-teal-600 px-6 py-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center">
              <Building2 size={13} className="text-white" />
            </div>
            <span className="text-white/80 text-sm">FlowLedger</span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-white/70 text-sm">Receipt for</p>
              <p className="text-white text-xl font-bold">
                {receipt.invoice.invoiceNumber}
              </p>
              <p className="text-white/70 text-sm mt-0.5">
                {receipt.invoice.description}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white/70 text-sm">Amount settled</p>
              <p className="text-white text-3xl font-bold">
                {receipt.amount.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                <span className="text-lg text-white/80 ml-1">
                  {receipt.assetId}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-400 mb-1">FROM</p>
              <p className="text-xs font-mono text-zinc-600 break-all">
                {receipt.payerParty.split('::')[0]}::
                {receipt.payerParty.split('::')[1]?.substring(0, 12)}...
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-1">TO</p>
              <p className="text-xs font-mono text-zinc-600 break-all">
                {receipt.payeeParty.split('::')[0]}::
                {receipt.payeeParty.split('::')[1]?.substring(0, 12)}...
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {receipt.invoice.vendor.name}
              </p>
            </div>
          </div>

          <div className="border-t border-zinc-100 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">Paid at</p>
                <p className="text-sm font-medium text-zinc-900">
                  {format(new Date(receipt.paidAt), 'MMMM d, yyyy h:mm a')}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">Network</p>
                <p className="text-sm font-medium text-zinc-900">
                  Canton {process.env.NEXT_PUBLIC_CANTON_NETWORK ?? 'devnet'}
                </p>
              </div>
            </div>
          </div>

          {/* Proof of Transfer */}
          <div className="border border-teal-200 bg-teal-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider mb-3">
              Canton Proof of Transfer
            </p>
            <div className="mb-3">
              <p className="text-xs text-teal-600 mb-1">Canton Update ID</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-mono text-teal-800 flex-1 break-all">
                  {receipt.updateId}
                </p>
                <button
                  onClick={copyUpdateId}
                  className="shrink-0 text-teal-600 hover:text-teal-800 transition-colors"
                  title="Copy Update ID"
                >
                  {copiedUpdateId ? (
                    <Check size={14} className="text-emerald-600" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            </div>

            {/* Transfer Object JSON */}
            <div>
              <button
                onClick={() => setJsonExpanded(!jsonExpanded)}
                className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-medium mb-2"
              >
                {jsonExpanded ? (
                  <ChevronUp size={12} />
                ) : (
                  <ChevronDown size={12} />
                )}
                {jsonExpanded ? 'Hide' : 'Show'} Transfer Object JSON
              </button>
              {jsonExpanded && (
                <div className="relative">
                  <button
                    onClick={copyJson}
                    className="absolute top-2 right-2 text-teal-600 hover:text-teal-800"
                  >
                    {copiedJson ? (
                      <Check size={12} className="text-emerald-600" />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                  <pre className="text-xs font-mono text-teal-800 bg-teal-100 rounded-lg p-3 overflow-x-auto max-h-48">
                    {JSON.stringify(transferObj, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs text-zinc-400">
          This receipt is cryptographically verified on the Canton Network
        </p>
      </div>
    </div>
  )
}
