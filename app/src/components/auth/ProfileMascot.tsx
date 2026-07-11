import type { CSSProperties } from 'react'

export const PROFILE_MASCOTS = [
  { id: 'penni-red', name: 'Penni', skin: '#f3b28d', hair: '#241725', shirt: '#ef5f71', bg: '#ffe0d2' },
  { id: 'atlas-blue', name: 'Atlas', skin: '#d99b74', hair: '#10243f', shirt: '#3e8cff', bg: '#d8ecff' },
  { id: 'mains-violet', name: 'Mains', skin: '#efc3a1', hair: '#3a2348', shirt: '#8b7cf6', bg: '#ece5ff' },
  { id: 'prelims-green', name: 'Prelims', skin: '#e6ad82', hair: '#18332b', shirt: '#48bd91', bg: '#d9faec' },
  { id: 'editor-gold', name: 'Editor', skin: '#f1c09a', hair: '#2a1b11', shirt: '#f3ad3f', bg: '#fff0cc' },
] as const

export type ProfileMascotId = typeof PROFILE_MASCOTS[number]['id']

export function getProfileMascot(id?: string) {
  return PROFILE_MASCOTS.find(item => item.id === id) ?? PROFILE_MASCOTS[0]
}

interface ProfileMascotProps {
  id?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  selected?: boolean
}

export function ProfileMascot({ id, className = '', size = 'md', selected = false }: ProfileMascotProps) {
  const mascot = getProfileMascot(id)
  return (
    <span
      className={`profile-mascot profile-mascot-${size} ${selected ? 'selected' : ''} ${className}`}
      style={{
        '--mascot-bg': mascot.bg,
        '--mascot-skin': mascot.skin,
        '--mascot-hair': mascot.hair,
        '--mascot-shirt': mascot.shirt,
      } as CSSProperties}
      aria-label={`${mascot.name} profile icon`}
      role="img"
    >
      <span className="pm-shadow" />
      <span className="pm-hair-back" />
      <span className="pm-head">
        <span className="pm-fringe" />
        <span className="pm-eye left" />
        <span className="pm-eye right" />
        <span className="pm-mouth" />
      </span>
      <span className="pm-body" />
    </span>
  )
}
