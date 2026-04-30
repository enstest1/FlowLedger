import { getStatusColor, getStatusDot } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_APPROVAL: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  IN_BATCH: 'In Batch',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
  ACTIVE: 'Active',
  PENDING: 'Pending',
  EXPIRED: 'Expired',
  FAILED: 'Failed',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
  READY: 'Ready',
  PROCESSING: 'Processing',
  PARTIAL: 'Partial',
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const colorClass = getStatusColor(status)
  const dotClass = getStatusDot(status)
  const label = statusLabels[status] ?? status

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold tracking-wide ${colorClass} ${className}`}
    >
      {/* Von Restorff: colored dot for instant status recognition before reading */}
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
      {label}
    </span>
  )
}
