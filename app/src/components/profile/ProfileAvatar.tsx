import type { PenniUser, StudentProfile } from '@/stores/useAuthStore'
import { ProfileMascot } from '@/components/auth/ProfileMascot'

interface ProfileAvatarProps {
  profile: StudentProfile | null
  user?: PenniUser | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ProfileAvatar({ profile, user, size = 'md', className = '' }: ProfileAvatarProps) {
  const photo = profile?.photoUrl || user?.avatarUrl
  if (photo) {
    return <img className={`profile-photo profile-photo-${size} ${className}`} src={photo} alt="Profile" />
  }
  return <ProfileMascot id={profile?.mascotId} size={size} className={className} />
}
