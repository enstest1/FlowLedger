import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncatePartyId(partyId: string, chars = 8): string {
  const parts = partyId.split('::')
  if (parts.length !== 2)
    return partyId.substring(0, chars * 2) + '...'
  const hint = parts[0]
  const fingerprint = parts[1]
  return `${hint}::${fingerprint.substring(0, chars)}...${fingerprint.substring(fingerprint.length - chars)}`
}

export function formatAmount(amount: number, asset: string): string {
  return `${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${asset}`
}

export function generateInvoiceNumber(existingNumbers: string[]): string {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`
  const existing = existingNumbers
    .filter((n) => n.startsWith(prefix))
    .map((n) => parseInt(n.replace(prefix, ''), 10))
    .filter((n) => !isNaN(n))
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: 'bg-zinc-100 text-zinc-700',
    SUBMITTED: 'bg-sky-100 text-sky-700',
    PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
    APPROVED: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-red-100 text-red-700',
    IN_BATCH: 'bg-purple-100 text-purple-700',
    PAID: 'bg-teal-100 text-teal-700',
    CANCELLED: 'bg-zinc-100 text-zinc-400',
    ACTIVE: 'bg-emerald-100 text-emerald-700',
    PENDING: 'bg-amber-100 text-amber-700',
    EXPIRED: 'bg-red-100 text-red-700',
    FAILED: 'bg-red-100 text-red-700',
    INACTIVE: 'bg-zinc-100 text-zinc-400',
    SUSPENDED: 'bg-red-100 text-red-700',
    READY: 'bg-sky-100 text-sky-700',
    PROCESSING: 'bg-indigo-100 text-indigo-700',
    PARTIAL: 'bg-orange-100 text-orange-700',
  }
  return colors[status] ?? 'bg-zinc-100 text-zinc-700'
}
