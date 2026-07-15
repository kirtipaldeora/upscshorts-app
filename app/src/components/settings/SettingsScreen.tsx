import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons'
import {
  faArrowLeft,
  faUser,
  faSun,
  faMoon,
  faSlidersH,
  faBullseye,
  faBell,
  faKey,
  faFileImport,
  faFileExport,
  faTrash,
  faRotate,
  faArrowRotateLeft,
  faShieldHalved,
  faChevronRight,
  faChevronDown,
  faGlobe,
  faRightFromBracket,
  faClock,
  faNewspaper,
  faMicrophone,
  faPlay,
  faEnvelope,
  faFileContract,
  faLifeRing,
  faUserPen,
  faEnvelopeOpenText,
} from '@fortawesome/free-solid-svg-icons'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { useAppStore } from '@/stores/useAppStore'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import { useAuthStore, type StudentProfile } from '@/stores/useAuthStore'
import { ProfileAvatar } from '@/components/profile/ProfileAvatar'
import { getProfileCompletion } from '@/utils/profile'
import { TODAY } from '@/constants/categories'
import { NEWS_SOURCES } from '@/constants/sources'
import { useNarration, listNarrationVoices } from '@/hooks/useNarration'
import { EASE, gsap, reducedMotion } from '@/anim/animations'

const VOICE_PREVIEW_TEXT = 'Let’s understand this news the way a UPSC mentor would explain it in class.'

interface SettingsScreenProps {
  onClose: () => void
  onShowToast: (msg: string) => void
  onOpenImport?: () => void
}

type DeviceOrientationWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

export function SettingsScreen({ onClose, onShowToast, onOpenImport }: SettingsScreenProps) {
  const { settings, stats, saveSettings } = usePracticeStore()
  const { theme, toggle } = useThemeStore()
  const { articlesByDate, setArticlesByDate, sourceFilter, toggleSource } = useAppStore()
  const { clearAll } = useBookmarkStore()
  const { user, profile, isGuest, loading: authSaving, signOut, deleteAccount, saveProfile } = useAuthStore()
  const previewNarration = useNarration()
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => listNarrationVoices())
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [voicesOpen, setVoicesOpen] = useState(false)
  const [contentToolsOpen, setContentToolsOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [dangerOpen, setDangerOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const profileName = isGuest ? 'Guest mode' : profile?.name || user?.name || 'Signed in student'
  const profileMethod = isGuest ? 'not signed in' : user?.method ?? 'local'
  const profileCompletion = getProfileCompletion(profile, user)
  const todayDone = stats.d[TODAY]?.n ?? 0
  const targetPct = Math.min(100, Math.round((todayDone / Math.max(1, settings.target)) * 100))
  const enabledSourceCount = NEWS_SOURCES.filter(source => sourceFilter[source.key]).length
  const selectedVoice = voices.find(voice => voice.voiceURI === settings.voiceURI)
  const curatedVoices = useMemo(() => {
    const blocked = /bad news|bells|bubbles|boing|whisper|wobble|zarvox/i
    const preferred = voices.filter(voice => /^(en|hi)-IN$/i.test(voice.lang) && !blocked.test(voice.name))
    const fallback = voices.filter(voice => /^(en-(GB|US)|hi)/i.test(voice.lang) && !blocked.test(voice.name))
    const ordered = [selectedVoice, ...preferred, ...fallback].filter(Boolean) as SpeechSynthesisVoice[]
    return ordered.filter((voice, index) => ordered.findIndex(item => item.voiceURI === voice.voiceURI) === index).slice(0, 6)
  }, [voices, selectedVoice])
  const gsFilter = (() => {
    try { return JSON.parse(localStorage.getItem('u4gs') || '["GS1","GS2","GS3"]') as string[] }
    catch { return ['GS1', 'GS2', 'GS3'] }
  })()

  function saveGs(val: string[]) {
    localStorage.setItem('u4gs', JSON.stringify(val))
  }

  function toggleGs(g: string) {
    const next = gsFilter.includes(g) ? gsFilter.filter(x => x !== g) : [...gsFilter, g]
    saveGs(next)
    if (profile && !isGuest) {
      void updateStudentProfile({ gsFocus: next.map(item => item.replace('GS', 'GS ')) }, true)
    }
    onShowToast(`${g} ${next.includes(g) ? 'enabled' : 'disabled'}`)
  }

  function handleToggleSource(key: (typeof NEWS_SOURCES)[number]['key']) {
    const turningOn = !sourceFilter[key]
    toggleSource(key)
    const label = NEWS_SOURCES.find(s => s.key === key)?.label ?? key
    onShowToast(`${label} articles ${turningOn ? 'shown' : 'hidden'}`)
  }

  function setDailyTarget(target: number) {
    saveSettings({ target })
    if (profile && !isGuest) void updateStudentProfile({ dailyTarget: target }, true)
  }

  function setReminderTime(reminderTime: string) {
    saveSettings({ reminderTime })
    onShowToast(`Reminder set for ${reminderTime}`)
  }

  async function enableReminder(next: boolean) {
    if (next && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    saveSettings({ remind: next })
    onShowToast(next ? `Revision nudge on at ${settings.reminderTime || '19:00'}` : 'Revision nudge off')
  }

  function testReminder() {
    onShowToast('Penni reminder: review a few mistakes before you close today.')
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Penni revision reminder', {
        body: 'Review mistakes or finish today’s practice target.',
      })
    }
  }

  function handleReset() {
    if (window.confirm('Erase ALL app data on this device?')) {
      localStorage.clear()
      indexedDB.deleteDatabase('penni')
      window.location.reload()
    }
  }

  function handleResetContent() {
    if (window.confirm('Reset feed content to defaults?')) {
      localStorage.removeItem('u4ct')
      setArticlesByDate({})
      onShowToast('Content reset')
      window.location.reload()
    }
  }

  function handleClearBookmarks() {
    if (window.confirm('Clear all bookmarks?')) {
      clearAll()
      onShowToast('Bookmarks cleared')
    }
  }

  async function handleSignOut() {
    const message = isGuest ? 'Return to login and connect Penni?' : 'Sign out of Penni on this device?'
    if (window.confirm(message)) {
      await signOut()
      window.location.reload()
    }
  }

  async function handleDeleteAccount() {
    if (isGuest) {
      handleReset()
      return
    }
    const confirmation = window.prompt('This permanently deletes your Penni account and synced learning data. Type DELETE to continue.')
    if (confirmation !== 'DELETE') return
    const deleted = await deleteAccount()
    if (!deleted) {
      onShowToast(useAuthStore.getState().error || 'Could not delete account')
      return
    }
    window.location.reload()
  }

  async function toggleEmailUpdates() {
    if (authSaving) return
    if (!profile || isGuest) {
      onShowToast('Sign in to receive email updates')
      return
    }
    if (!profile.emailUpdates && !(profile.email || user?.email)) {
      onShowToast('Add an email address in your profile first')
      return
    }
    const enabling = !profile.emailUpdates
    const saved = await updateStudentProfile({ emailUpdates: enabling }, true)
    onShowToast(saved
      ? `Email updates turned ${enabling ? 'on' : 'off'}`
      : 'Could not update email preference. Please try again.')
  }

  async function toggleWhatsappUpdates() {
    if (authSaving) return
    if (!profile || isGuest) {
      onShowToast('Sign in to receive WhatsApp updates')
      return
    }
    const whatsappDigits = profile.phone.replace(/\D/g, '')
    if (!profile.whatsappUpdates && (whatsappDigits.length < 8 || whatsappDigits.length > 15 || whatsappDigits[0] === '0')) {
      onShowToast('Add a valid WhatsApp number with country code in your profile')
      return
    }
    const enabling = !profile.whatsappUpdates
    const saved = await updateStudentProfile({ whatsappUpdates: enabling }, true)
    onShowToast(saved
      ? `WhatsApp updates turned ${enabling ? 'on' : 'off'}`
      : 'Could not update WhatsApp preference. Please try again.')
  }

  async function updateStudentProfile(patch: Partial<StudentProfile>, silent = false): Promise<boolean> {
    if (!profile || isGuest) return false
    const next = { ...profile, ...patch }
    const saved = await saveProfile(next)
    if (!saved) return false
    if (patch.name) saveSettings({ name: patch.name })
    if (patch.dailyTarget) saveSettings({ target: patch.dailyTarget })
    if (!silent) onShowToast('Profile updated')
    return true
  }

  function handleBackupContent() {
    const blob = new Blob([JSON.stringify(articlesByDate, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'penni_backup.json'
    a.click()
    onShowToast('Backup exported')
  }

  async function toggleFeedBackdrop() {
    const next = !settings.feedCosmicBackdrop
    if (next && typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      const orientation = window.DeviceOrientationEvent as DeviceOrientationWithPermission
      try { await orientation.requestPermission?.() } catch { /* motion remains optional */ }
    }
    saveSettings({ feedCosmicBackdrop: next })
  }

  function chooseVoice(voiceURI: string) {
    saveSettings({ voiceURI })
    const label = voices.find(v => v.voiceURI === voiceURI)?.name ?? 'Default voice'
    onShowToast(`Narration voice set to ${label}`)
  }

  function previewVoice(voiceURI: string) {
    const voice = voices.find(v => v.voiceURI === voiceURI)
    previewNarration.speak(VOICE_PREVIEW_TEXT, {
      lang: voice?.lang || 'en-IN',
      rate: 0.88,
      pitch: 1.04,
      voiceURI,
    })
  }

  useEffect(() => {
    const root = settingsRef.current
    if (!root || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.settings-panel,.settings-rhythm-card,.settings-collapsible',
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.46, ease: EASE.expo, stagger: 0.045, clearProps: 'transform,opacity' })
    }, root)
    return () => ctx.revert()
  }, [])

  // Most browsers populate the voice list asynchronously after first load.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const refresh = () => setVoices(listNarrationVoices())
    refresh()
    window.speechSynthesis.addEventListener('voiceschanged', refresh)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh)
  }, [])

  return (
    <div className="screen active" style={{ animation: 'scrIn 0.35s cubic-bezier(0.22,1,0.36,1)' }}>
      <div className="screen-header">
        <button onClick={onClose} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2>Settings</h2>
      </div>
      <div ref={settingsRef} className="screen-body" style={{ paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>

        {/* Account */}
        <div className="setting-group settings-panel">
          <div className="setting-group-title">Account</div>
          <div className="setting-item settings-account-row" onClick={onClose}>
            <div className="setting-left">
              <ProfileAvatar profile={profile} user={user} size="sm" />
              <span><b>{profileName}</b><small>{isGuest ? profileMethod : `${profileCompletion.percent}% complete`}</small></span>
            </div>
            <FontAwesomeIcon icon={faUserPen} style={{ color: 'var(--acc)' }} />
          </div>
          {isGuest && (
            <p className="pn-note">Guest mode keeps practice local on this device. Sign in to create a profile and sync progress.</p>
          )}
          <div className="setting-item" onClick={() => void handleSignOut()}>
            <div className="setting-left">
              <FontAwesomeIcon icon={isGuest ? faUser : faRightFromBracket} style={{ width: 14, color: isGuest ? 'var(--acc)' : '#E36D6D' }} />
              <span style={{ color: isGuest ? 'var(--acc)' : '#E36D6D' }}>{isGuest ? 'Sign in to sync' : 'Sign out'}</span>
            </div>
          </div>
        </div>

        {/* Communication preferences */}
        <div className="setting-group settings-panel">
          <div className="setting-group-title">Updates</div>
          <div className="setting-item" onClick={() => void toggleEmailUpdates()}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faEnvelopeOpenText} style={{ width: 14 }} />
              <span>Email updates</span>
            </div>
            <button className={`toggle ${profile?.emailUpdates ? 'on' : ''}`} disabled={authSaving} onClick={event => { event.stopPropagation(); void toggleEmailUpdates() }} aria-label="Toggle email updates" />
          </div>
          <p className="pn-note">A daily briefing email when the new pack is published, plus important Penni feature announcements.</p>
          <div className="setting-item" onClick={() => void toggleWhatsappUpdates()}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faWhatsapp} style={{ width: 14, color: '#23a966' }} />
              <span>WhatsApp briefings</span>
            </div>
            <button className={`toggle ${profile?.whatsappUpdates ? 'on' : ''}`} disabled={authSaving} onClick={event => { event.stopPropagation(); void toggleWhatsappUpdates() }} aria-label="Toggle WhatsApp updates" />
          </div>
          <p className="pn-note">A daily briefing alert when the new pack is published, plus major feature updates. Turn it off anytime.</p>
        </div>

        {/* Preferences */}
        <div className="setting-group settings-panel">
          <div className="setting-group-title">Preferences</div>
          <div className="setting-item" onClick={toggle}>
            <div className="setting-left">
              <FontAwesomeIcon icon={theme === 'dark' ? faMoon : faSun} style={{ width: 14 }} />
              <span>Dark Mode</span>
            </div>
            <button
              className={`toggle ${theme === 'dark' ? 'on' : ''}`}
              onClick={e => { e.stopPropagation(); toggle() }}
              aria-label="Toggle dark mode"
            />
          </div>
          <div className="setting-item" onClick={toggleFeedBackdrop}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faGlobe} style={{ width: 14 }} />
              <span>Animated feed backdrop</span>
            </div>
            <button
              className={`toggle ${settings.feedCosmicBackdrop ? 'on' : ''}`}
              onClick={e => {
                e.stopPropagation()
                void toggleFeedBackdrop()
              }}
              aria-label="Toggle animated feed backdrop"
            />
          </div>
          <div className="setting-item" onClick={() => saveSettings({ hapticsEnabled: !settings.hapticsEnabled })}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faBullseye} style={{ width: 14 }} />
              <span>Haptic feedback</span>
            </div>
            <button
              className={`toggle ${settings.hapticsEnabled ? 'on' : ''}`}
              onClick={event => { event.stopPropagation(); saveSettings({ hapticsEnabled: !settings.hapticsEnabled }) }}
              aria-label="Toggle haptic feedback"
            />
          </div>
          <div className="setting-item" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faSlidersH} style={{ width: 14 }} />
              <span>GS papers</span>
            </div>
            <div className="pn-gs">
              {['GS1', 'GS2', 'GS3', 'GS4'].map(g => (
                <button
                  key={g}
                  className={`pn-gschip ${gsFilter.includes(g) ? 'on' : ''}`}
                  onClick={() => toggleGs(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* News sources */}
        <div className={`setting-group settings-panel settings-disclosure ${sourcesOpen ? 'open' : ''}`}>
          <button className="settings-summary" onClick={() => setSourcesOpen(value => !value)}>
            <span className="settings-summary-icon"><FontAwesomeIcon icon={faNewspaper} /></span>
            <span><b>News sources</b><small>{enabledSourceCount} of {NEWS_SOURCES.length} shown</small></span>
            <FontAwesomeIcon icon={faChevronDown} />
          </button>
          {sourcesOpen && (
            <div className="settings-options-grid">
              {NEWS_SOURCES.map(src => (
                <button key={src.key} className={sourceFilter[src.key] ? 'active' : ''} onClick={() => handleToggleSource(src.key)}>
                  <span>{src.label}</span><i>{sourceFilter[src.key] ? 'On' : 'Off'}</i>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Narration voice */}
        <div className={`setting-group settings-panel settings-disclosure ${voicesOpen ? 'open' : ''}`}>
          <button className="settings-summary" onClick={() => setVoicesOpen(value => !value)}>
            <span className="settings-summary-icon"><FontAwesomeIcon icon={faMicrophone} /></span>
            <span><b>Narration voice</b><small>{selectedVoice ? `${selectedVoice.name} · ${selectedVoice.lang}` : 'Best available Indian voice'}</small></span>
            <FontAwesomeIcon icon={faChevronDown} />
          </button>
          {voicesOpen && (
            curatedVoices.length === 0 ? <p className="pn-note">No narration voices are available on this device yet.</p> : (
              <div className="voice-picker-list compact">
                {curatedVoices.map(voice => {
                  const active = settings.voiceURI === voice.voiceURI
                  return (
                    <div key={voice.voiceURI} className={`voice-picker-row ${active ? 'on' : ''}`}>
                      <button className="voice-picker-select" onClick={() => chooseVoice(voice.voiceURI)}>
                        <FontAwesomeIcon icon={faMicrophone} />
                        <span><b>{voice.name}</b><i>{voice.lang}</i></span>
                      </button>
                      <button className="voice-picker-preview" onClick={() => previewVoice(voice.voiceURI)} aria-label={`Preview ${voice.name}`}><FontAwesomeIcon icon={faPlay} /></button>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>

        {/* Daily practice */}
        <div className="setting-group settings-panel">
          <div className="setting-group-title">Daily practice</div>
          <div className="settings-rhythm-card">
            <div className="settings-rhythm-top">
              <FontAwesomeIcon icon={faBullseye} />
              <div>
                <span>Today’s progress</span>
                <b>{todayDone} / {settings.target} questions</b>
              </div>
              <strong>{targetPct}%</strong>
            </div>
            <div className="settings-rhythm-bar"><i style={{ width: `${targetPct}%` }} /></div>
            <div className="settings-target-row">
              <span>Daily target</span>
              <div className="pn-step">
                <button onClick={() => setDailyTarget(Math.max(5, settings.target - 5))}>-</button>
                <b>{settings.target}</b>
                <button onClick={() => setDailyTarget(Math.min(50, settings.target + 5))}>+</button>
              </div>
            </div>
            <div className="settings-reminder-row">
              <div>
                <FontAwesomeIcon icon={faClock} />
                <span>Revision nudge</span>
              </div>
              <input
                type="time"
                value={settings.reminderTime || '19:00'}
                onChange={e => setReminderTime(e.target.value)}
                aria-label="Reminder time"
              />
              <button
                className={`toggle ${settings.remind ? 'on' : ''}`}
                onClick={() => void enableReminder(!settings.remind)}
                aria-label="Toggle revision reminder"
              />
            </div>
            <button className="settings-test-nudge" onClick={testReminder}>
              <FontAwesomeIcon icon={faBell} />
              Test nudge
            </button>
          </div>
        </div>

        {/* Advanced tools stay out of the primary launch experience. */}
        <div className={`setting-group settings-panel settings-disclosure ${advancedOpen ? 'open' : ''}`}>
          <button className="settings-summary" onClick={() => setAdvancedOpen(value => !value)}>
            <span className="settings-summary-icon"><FontAwesomeIcon icon={faKey} /></span>
            <span><b>Advanced tools</b><small>Optional personal AI evaluation key</small></span>
            <FontAwesomeIcon icon={faChevronDown} />
          </button>
          {advancedOpen && (
            <div className="settings-advanced-body">
              <label><span>Claude API key</span><input className="pn-inp wide" type="password" defaultValue={settings.key} placeholder="sk-ant-..." onChange={e => saveSettings({ key: e.target.value.trim() })} /></label>
              <p className="pn-note">Stored only on this device. Penni uses it only when you request a Mains evaluation. Daily limit: 5 uploads.</p>
            </div>
          )}
        </div>

        {/* Data & privacy */}
        <div className="setting-group settings-panel">
          <div className="setting-group-title">Data &amp; privacy</div>
          <div className="setting-item" onClick={() => window.open('/privacy.html', '_blank')}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faShieldHalved} style={{ width: 14 }} />
              <span>Privacy policy</span>
            </div>
            <FontAwesomeIcon icon={faChevronRight} style={{ color: 'var(--ink3)', fontSize: 11 }} />
          </div>
          <div className="setting-item" onClick={() => window.open('/terms.html', '_blank')}>
            <div className="setting-left"><FontAwesomeIcon icon={faFileContract} style={{ width: 14 }} /><span>Terms of use</span></div>
            <FontAwesomeIcon icon={faChevronRight} style={{ color: 'var(--ink3)', fontSize: 11 }} />
          </div>
          <div className="setting-item" onClick={() => window.location.href = 'mailto:support@penni.app?subject=Penni support'}>
            <div className="setting-left"><FontAwesomeIcon icon={faLifeRing} style={{ width: 14 }} /><span>Help &amp; support</span></div>
            <FontAwesomeIcon icon={faChevronRight} style={{ color: 'var(--ink3)', fontSize: 11 }} />
          </div>
          <div className="setting-item" onClick={() => window.location.href = 'mailto:support@penni.app?subject=Penni feedback'}>
            <div className="setting-left"><FontAwesomeIcon icon={faEnvelope} style={{ width: 14 }} /><span>Send feedback</span></div>
            <FontAwesomeIcon icon={faChevronRight} style={{ color: 'var(--ink3)', fontSize: 11 }} />
          </div>

          <div className={`settings-collapsible ${contentToolsOpen ? 'open' : ''}`}>
            <button className="settings-collapse-head" onClick={() => setContentToolsOpen(value => !value)}>
              <div className="setting-left">
                <FontAwesomeIcon icon={faFileImport} style={{ width: 14 }} />
                <span>Content tools</span>
              </div>
              <FontAwesomeIcon icon={faChevronDown} />
            </button>
            {contentToolsOpen && (
              <div className="settings-collapse-body">
                {onOpenImport && (
                  <button onClick={onOpenImport}>
                    <FontAwesomeIcon icon={faFileImport} />
                    Import content JSON
                  </button>
                )}
                <button onClick={handleBackupContent}>
                  <FontAwesomeIcon icon={faFileExport} />
                  Backup content
                </button>
              </div>
            )}
          </div>

          <div className={`settings-collapsible danger ${dangerOpen ? 'open' : ''}`}>
            <button className="settings-collapse-head" onClick={() => setDangerOpen(value => !value)}>
              <div className="setting-left">
                <FontAwesomeIcon icon={faTrash} style={{ width: 14, color: '#E36D6D' }} />
                <span>Reset and cleanup</span>
              </div>
              <FontAwesomeIcon icon={faChevronDown} />
            </button>
            {dangerOpen && (
              <div className="settings-collapse-body">
                <button onClick={handleClearBookmarks}>
                  <FontAwesomeIcon icon={faTrash} />
                  Clear bookmarks
                </button>
                <button onClick={handleResetContent}>
                  <FontAwesomeIcon icon={faRotate} />
                  Reset content
                </button>
                <button onClick={handleReset}>
                  <FontAwesomeIcon icon={faArrowRotateLeft} />
                  Reset app
                </button>
                <button className="danger-action" onClick={() => void handleDeleteAccount()}>
                  <FontAwesomeIcon icon={faTrash} />
                  {isGuest ? 'Erase guest data' : 'Delete account'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '16px 16px 24px', color: 'var(--on2)', fontSize: 11, fontWeight: 700 }}>
          Built for UPSC aspirants<br />
          <span style={{ color: 'var(--yellow)' }}>Penni</span>
        </div>
      </div>
    </div>
  )
}
