interface LoadingBadgeProps {
  label: string
  full?: boolean
  delayed?: boolean
  className?: string
}

/** Quiet feedback for a genuinely pending route or data request. */
export function LoadingBadge({ label, full = false, delayed = true, className = '' }: LoadingBadgeProps) {
  return (
    <div
      className={`loading-badge ${full ? 'full' : 'compact'} ${delayed ? 'delayed' : ''} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span aria-hidden="true"><i /><b>✦</b></span>
      <small>{label}</small>
    </div>
  )
}
