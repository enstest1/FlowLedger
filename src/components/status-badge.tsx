import { getStatusColor } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_APPROVAL: 'Pending Approval',
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
  const label = statusLabels[status] ?? status
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass} ${className}`}
    >
      {label}
    </span>
  )
}
