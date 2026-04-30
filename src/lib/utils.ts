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

/* Status colors — bg + text pairs for badges */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: 'bg-zinc-100 text-zinc-600',
    SUBMITTED: 'bg-sky-50 text-sky-700',
    PENDING_APPROVAL: 'bg-amber-50 text-amber-700',
    APPROVED: 'bg-emerald-50 text-emerald-700',
    REJECTED: 'bg-red-50 text-red-700',
    IN_BATCH: 'bg-violet-50 text-violet-700',
    PAID: 'bg-teal-50 text-teal-700',
    CANCELLED: 'bg-zinc-100 text-zinc-400',
    ACTIVE: 'bg-emerald-50 text-emerald-700',
    PENDING: 'bg-amber-50 text-amber-700',
    EXPIRED: 'bg-red-50 text-red-600',
    FAILED: 'bg-red-50 text-red-700',
    INACTIVE: 'bg-zinc-100 text-zinc-400',
    SUSPENDED: 'bg-red-50 text-red-700',
    READY: 'bg-sky-50 text-sky-700',
    PROCESSING: 'bg-indigo-50 text-indigo-700',
    PARTIAL: 'bg-orange-50 text-orange-700',
  }
  return colors[status] ?? 'bg-zinc-100 text-zinc-600'
}

/* Status dot colors — the colored dot that precedes the label (Von Restorff effect) */
export function getStatusDot(status: string): string {
  const dots: Record<string, string> = {
    DRAFT: 'bg-zinc-400',
    SUBMITTED: 'bg-sky-500',
    PENDING_APPROVAL: 'bg-amber-500',
    APPROVED: 'bg-emerald-500',
    REJECTED: 'bg-red-500',
    IN_BATCH: 'bg-violet-500',
    PAID: 'bg-teal-500',
    CANCELLED: 'bg-zinc-300',
    ACTIVE: 'bg-emerald-500',
    PENDING: 'bg-amber-500',
    EXPIRED: 'bg-red-400',
    FAILED: 'bg-red-500',
    INACTIVE: 'bg-zinc-300',
    SUSPENDED: 'bg-red-500',
    READY: 'bg-sky-500',
    PROCESSING: 'bg-indigo-500',
    PARTIAL: 'bg-orange-500',
  }
  return dots[status] ?? 'bg-zinc-400'
}
