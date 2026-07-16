import type { CSSProperties } from 'react'
import { asset } from '@/utils/asset'

export const PROFILE_MASCOTS = [
  { id: 'penni-red', name: 'Thoughtful Scholar', x: 1.9, y: 16.7 },
  { id: 'atlas-blue', name: 'Study Dino', x: 34.5, y: 16.7 },
  { id: 'mains-violet', name: 'Bookish Cat', x: 66.8, y: 16.7 },
  { id: 'prelims-green', name: 'Music Ghost', x: 98.4, y: 16.7 },
  { id: 'editor-gold', name: 'Campus Scout', x: 1.9, y: 50.3 },
  { id: 'spark-star', name: 'Little Spark', x: 34.5, y: 50.3 },
  { id: 'notes-frog', name: 'Notes Frog', x: 66.8, y: 50.3 },
  { id: 'curious-reader', name: 'Curious Reader', x: 98.4, y: 50.3 },
  { id: 'pencil-rabbit', name: 'Pencil Rabbit', x: 1.9, y: 85.4 },
  { id: 'toast-notes', name: 'Toast Notes', x: 34.5, y: 85.4 },
  { id: 'focus-bot', name: 'Focus Bot', x: 66.8, y: 85.4 },
  { id: 'calm-cloud', name: 'Calm Cloud', x: 98.4, y: 85.4 },
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
        backgroundSize: '440% 440%',
        backgroundPosition: `${mascot.x}% ${mascot.y}%`,
      } as CSSProperties}
      aria-label={`${mascot.name} profile icon`}
      role="img"
    />
  )
}
