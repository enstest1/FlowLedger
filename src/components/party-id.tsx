'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { truncatePartyId } from '@/lib/utils'

interface PartyIdProps {
  id: string
  chars?: number
  className?: string
}

export function PartyId({ id, chars = 8, className = '' }: PartyIdProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-sm text-zinc-600 ${className}`}
    >
      <span title={id}>{truncatePartyId(id, chars)}</span>
      <button
        onClick={copy}
        className="text-zinc-400 hover:text-zinc-700 transition-colors"
        title="Copy party ID"
      >
        {copied ? (
          <Check size={12} className="text-emerald-500" />
        ) : (
          <Copy size={12} />
        )}
      </button>
    </span>
  )
}
