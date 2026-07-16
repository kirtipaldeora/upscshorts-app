import type { CSSProperties, ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { ProfileMascot, profileMascotIdFromUrl } from '@/components/auth/ProfileMascot'

export function formatFocusTime(seconds: number, includeSeconds = false) {
  const safe = Math.max(0, Math.round(seconds))
  const hours = Math.floor(safe / 3_600)
  const minutes = Math.floor((safe % 3_600) / 60)
  const remaining = safe % 60
  if (includeSeconds || hours === 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
  }
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

export function compactFocusTime(seconds: number) {
  const safe = Math.max(0, Math.round(seconds))
  const hours = Math.floor(safe / 3_600)
  const minutes = Math.floor((safe % 3_600) / 60)
  if (!hours) return safe > 0 && minutes === 0 ? '<1m' : `${minutes}m`
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`
}

export function FocusAvatar({ name, initials, avatarUrl, live = false, size = 'md' }: { name: string; initials: string; avatarUrl?: string; live?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const mascotId = profileMascotIdFromUrl(avatarUrl)
  return (
    <span className={`focus-avatar ${size} ${live ? 'live' : ''}`} aria-label={live ? `${name}, focusing now` : name}>
      {mascotId ? <ProfileMascot id={mascotId} size={size} /> : avatarUrl ? <img src={avatarUrl} alt="" /> : <b>{initials}</b>}
      {live && <i aria-hidden="true" />}
    </span>
  )
}

export function FocusSectionHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="focus-section-heading">
      <div><span>{eyebrow}</span><h2>{title}</h2>{detail && <p>{detail}</p>}</div>
      {action}
    </div>
  )
}

export function FocusToggle({ checked, label, detail, onChange }: { checked: boolean; label: string; detail: string; onChange: (checked: boolean) => void }) {
  return (
    <button className="focus-setting-row" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span><b>{label}</b><small>{detail}</small></span>
      <i className={`focus-switch ${checked ? 'on' : ''}`}><em /></i>
    </button>
  )
}

export function FocusProgress({ value, color }: { value: number; color?: string }) {
  const safe = Math.max(0, Math.min(100, value))
  return <span className="focus-progress" style={{ '--focus-progress': `${safe}%`, '--focus-progress-color': color ?? 'var(--acc)' } as CSSProperties}><i /></span>
}

export function FocusDisclosure({ children, onClick, label }: { children: ReactNode; onClick?: () => void; label?: string }) {
  return <button className="focus-disclosure" onClick={onClick} aria-label={label}>{children}<FontAwesomeIcon icon={faChevronRight} /></button>
}
