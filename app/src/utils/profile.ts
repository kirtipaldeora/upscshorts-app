import type { PenniUser, StudentProfile } from '@/stores/useAuthStore'

export interface ProfileCompletion {
  percent: number
  completed: number
  total: number
  missing: string[]
}

export function getProfileCompletion(profile: StudentProfile | null, user?: PenniUser | null): ProfileCompletion {
  const checks = [
    { label: 'name', value: profile?.name },
    { label: 'profile picture', value: profile?.photoUrl || profile?.mascotId },
    { label: 'email or phone', value: profile?.email || user?.email || profile?.phone || user?.phone },
    { label: 'target exam', value: profile?.targetExam },
    { label: 'attempt year', value: profile?.attemptYear },
    { label: 'preparation stage', value: profile?.prepStage },
    { label: 'reading language', value: profile?.language },
    { label: 'optional subject', value: profile?.optionalSubject },
    { label: 'gender', value: profile?.gender },
    { label: 'date of birth', value: profile?.dateOfBirth },
  ]
  const completed = checks.filter(item => Boolean(String(item.value ?? '').trim())).length
  return {
    percent: Math.round(completed / checks.length * 100),
    completed,
    total: checks.length,
    missing: checks.filter(item => !String(item.value ?? '').trim()).map(item => item.label),
  }
}

export function profileContactEmail(profile: StudentProfile | null, user?: PenniUser | null) {
  return profile?.email || user?.email || ''
}
