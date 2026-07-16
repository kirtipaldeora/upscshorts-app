import type { CSSProperties } from 'react'
import { asset } from '@/utils/asset'

export const PROFILE_MASCOTS = [
  { id: 'penni-red', name: 'Thoughtful Scholar', x: 2.2, y: 16.1 },
  { id: 'atlas-blue', name: 'Study Dino', x: 35.3, y: 16.1 },
  { id: 'mains-violet', name: 'Bookish Cat', x: 68.9, y: 16.1 },
  { id: 'prelims-green', name: 'Music Ghost', x: 99, y: 16.1 },
  { id: 'editor-gold', name: 'Campus Scout', x: 2.2, y: 50.8 },
  { id: 'spark-star', name: 'Little Spark', x: 35.3, y: 50.8 },
  { id: 'notes-frog', name: 'Notes Frog', x: 68.9, y: 50.8 },
  { id: 'curious-reader', name: 'Curious Reader', x: 99, y: 50.8 },
  { id: 'pencil-rabbit', name: 'Pencil Rabbit', x: 2.2, y: 86.2 },
  { id: 'toast-notes', name: 'Toast Notes', x: 35.3, y: 86.2 },
  { id: 'focus-bot', name: 'Focus Bot', x: 68.9, y: 86.2 },
  { id: 'calm-cloud', name: 'Calm Cloud', x: 99, y: 86.2 },
] as const

export type ProfileMascotId = typeof PROFILE_MASCOTS[number]['id']
export const PROFILE_MASCOT_URL_PREFIX = 'penni-avatar:'

export function getProfileMascot(id?: string) {
  return PROFILE_MASCOTS.find(item => item.id === id) ?? PROFILE_MASCOTS[0]
}

export function profileMascotUrl(id?: string) {
  return `${PROFILE_MASCOT_URL_PREFIX}${getProfileMascot(id).id}`
}

export function profileMascotIdFromUrl(value?: string) {
  if (!value?.startsWith(PROFILE_MASCOT_URL_PREFIX)) return null
  return getProfileMascot(value.slice(PROFILE_MASCOT_URL_PREFIX.length)).id
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
        backgroundImage: `url("${asset('assets/penni-profile-avatars.png')}")`,
        backgroundSize: '405% 405%',
        backgroundPosition: `${mascot.x}% ${mascot.y}%`,
      } as CSSProperties}
      aria-label={`${mascot.name} profile icon`}
      role="img"
    />
  )
}
