'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { executeBatch } from '@/app/actions/batch'
import { Zap, Loader2, CheckCircle, XCircle } from 'lucide-react'

interface Props {
  batchId: string
  slug: string
}

export function BatchExecuteButton({ batchId, slug }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    status?: string
    paidCount?: number
    failedCount?: number
    error?: string
  } | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleExecute = async () => {
    setLoading(true)
    setShowConfirm(false)

    const res = await executeBatch(batchId)
    setLoading(false)

    if (res?.error) {
      setResult({ error: res.error })
    } else if (res?.data) {
      setResult(res.data)
      // Refresh page after 2s to show updated state
      setTimeout(() => {
        router.refresh()
      }, 2000)
    }
  }

  if (result) {
    return (
      <div className="text-sm">
        {result.error ? (
          <div className="flex items-center gap-2 text-red-600">
            <XCircle size={16} />
            <span>{result.error}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle size={16} />
            <span>
              {result.paidCount} paid
              {result.failedCount ? `, ${result.failedCount} failed` : ''}
            </span>
          </div>
        )}
      </div>
    )
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-500">Are you sure?</span>
        <button
          onClick={handleExecute}
          disabled={loading}
          className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Zap size={14} />
          )}
          {loading ? 'Executing...' : 'Confirm Execute'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="text-sm text-zinc-500 hover:text-zinc-700"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="flex items-center gap-1.5 bg-[#2d5a4f] text-white px-5 py-2.5 rounded-lg font-medium hover:bg-[#234740] transition-colors"
    >
      <Zap size={16} />
      Execute Batch
    </button>
  )
}
