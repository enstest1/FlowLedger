interface FlowLedgerMarkProps {
  size?: number
  bg?: string
  fg?: string
}

export function FlowLedgerMark({ size = 32, bg = '#2d5a4f', fg = '#faf9f5' }: FlowLedgerMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect width="32" height="32" rx="4" fill={bg} />
      <path fill={fg} d="M 7 7 H 25 V 19 L 19 25 H 7 Z" />
      <rect x="7" y="14" width="18" height="2.5" fill={bg} />
    </svg>
  )
}
