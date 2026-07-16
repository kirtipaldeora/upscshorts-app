import type { PenniUser, StudentProfile } from '@/stores/useAuthStore'
import { ProfileMascot } from '@/components/auth/ProfileMascot'

interface ProfileAvatarProps {
  profile: StudentProfile | null
  user?: PenniUser | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ProfileAvatar({ profile, user, size = 'md', className = '' }: ProfileAvatarProps) {
  if (profile?.photoUrl) {
    return <img className={`profile-photo profile-photo-${size} ${className}`} src={profile.photoUrl} alt="Profile" />
  }
  // An explicitly chosen mascot is the intended profile icon and must win over
  // an OAuth-derived avatar (e.g. Google's default monogram). Fall back to the
  // provider avatar only before a profile exists.
  if (profile) {
    return <ProfileMascot id={profile.mascotId} size={size} className={className} />
  }
  if (user?.avatarUrl) {
    return <img className={`profile-photo profile-photo-${size} ${className}`} src={user.avatarUrl} alt="Profile" />
  }
  return <ProfileMascot id={undefined} size={size} className={className} />
}
