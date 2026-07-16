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
  faCheck,
} from '@fortawesome/free-solid-svg-icons'
import { usePracticeStore } from '@/stores/usePracticeStore'
import {
  APP_PALETTES,
  useThemeStore,
  type PaletteIntervalHours,
} from '@/stores/useThemeStore'
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

type SettingsSection = 'appearance' | 'study' | 'reading' | 'updates' | 'data' | 'advanced'

const SETTINGS_SECTION_TITLES: Record<SettingsSection, string> = {
  appearance: 'Appearance',
  study: 'Study & reminders',
  reading: 'News & reading',
  updates: 'Briefing updates',
  data: 'Data & support',
  advanced: 'Advanced tools',
}

export function SettingsScreen({ onClose, onShowToast, onOpenImport }: SettingsScreenProps) {
  const { settings, stats, saveSettings } = usePracticeStore()
  const {
    theme,
    palette,
    autoShufflePalette,
    paletteIntervalHours,
    toggle,
    setTheme,
    setPalette,
    setAutoShufflePalette,
    setPaletteIntervalHours,
    randomizePalette,
  } = useThemeStore()
  const { articlesByDate, setArticlesByDate, sourceFilter, toggleSource } = useAppStore()
  const { clearAll } = useBookmarkStore()
  const { user, profile, isGuest, loading: authSaving, signOut, deleteAccount, saveProfile } = useAuthStore()
  const previewNarration = useNarration()
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => listNarrationVoices())
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(null)
  const [dangerOpen, setDangerOpen] = useState(false)
  const [deviceReadingLanguage, setDeviceReadingLanguage] = useState<'english' | 'hindi'>(() => {
    try { return localStorage.getItem('penni-read-lang') === 'hi' ? 'hindi' : 'english' } catch { return 'english' }
  })
  const [gsFilter, setGsFilter] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('u4gs') || '["GS1","GS2","GS3"]') as string[] }
    catch { return ['GS1', 'GS2', 'GS3'] }
  })
  const settingsRef = useRef<HTMLDivElement>(null)
  const profileName = isGuest ? 'Guest mode' : profile?.name || user?.name || 'Signed in student'
  const profileMethod = isGuest ? 'not signed in' : user?.method ?? 'local'
  const profileCompletion = getProfileCompletion(profile, user)
  const todayDone = stats.d[TODAY]?.n ?? 0
  const targetPct = Math.min(100, Math.round((todayDone / Math.max(1, settings.target)) * 100))
  const enabledSourceCount = NEWS_SOURCES.filter(source => sourceFilter[source.key]).length
  const selectedVoice = voices.find(voice => voice.voiceURI === settings.voiceURI)
  const readingLanguage = profile?.language ?? deviceReadingLanguage
  const curatedVoices = useMemo(() => {
    const blocked = /bad news|bells|bubbles|boing|whisper|wobble|zarvox/i
    const preferred = voices.filter(voice => /^(en|hi)-IN$/i.test(voice.lang) && !blocked.test(voice.name))
    const fallback = voices.filter(voice => /^(en-(GB|US)|hi)/i.test(voice.lang) && !blocked.test(voice.name))
    const ordered = [selectedVoice, ...preferred, ...fallback].filter(Boolean) as SpeechSynthesisVoice[]
    return ordered.filter((voice, index) => ordered.findIndex(item => item.voiceURI === voice.voiceURI) === index).slice(0, 6)
  }, [voices, selectedVoice])
  function saveGs(val: string[]) {
    setGsFilter(val)
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

  async function chooseReadingLanguage(language: StudentProfile['language']) {
    if (profile && !isGuest) {
      const saved = await updateStudentProfile({ language }, true)
      if (!saved) {
        onShowToast('Could not update the reading language. Please try again.')
        return
      }
    }
    setDeviceReadingLanguage(language)
    try { localStorage.setItem('penni-read-lang', language === 'hindi' ? 'hi' : 'en') } catch { /* noop */ }
    onShowToast(language === 'hindi' ? 'Hindi is now your default reading language' : 'English is now your default reading language')
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
      gsap.fromTo('.settings-profile-card,.settings-home-group,.settings-section-intro,.settings-control-card,.settings-rhythm-card',
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

  const currentPaletteLabel = APP_PALETTES.find(item => item.id === palette)?.label ?? 'Penni'

  return (
    <div className="screen active settings-screen" style={{ animation: 'scrIn 0.35s cubic-bezier(0.22,1,0.36,1)' }}>
      <div className="screen-header settings-screen-header">
        <button onClick={() => activeSection ? setActiveSection(null) : onClose()} aria-label={activeSection ? 'Back to Settings' : 'Back to Account'}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <div><span>{activeSection ? 'Settings' : 'Your app'}</span><h2>{activeSection ? SETTINGS_SECTION_TITLES[activeSection] : 'Settings'}</h2></div>
      </div>

      <div ref={settingsRef} className="screen-body settings-screen-body">
        {!activeSection && (
          <>
            <button className="settings-profile-card" onClick={onClose}>
              <ProfileAvatar profile={profile} user={user} size="sm" />
              <span><b>{profileName}</b><small>{isGuest ? 'Guest · progress stays on this device' : `${profileCompletion.percent}% profile complete`}</small></span>
              <FontAwesomeIcon icon={faChevronRight} />
            </button>

            <p className="settings-home-intro">Keep everyday choices simple. Open a section only when you want to change something.</p>

            <section className="settings-home-group">
              <h3>Personalise</h3>
              <div>
                <button className="settings-nav-row" onClick={() => setActiveSection('appearance')}>
                  <i><FontAwesomeIcon icon={theme === 'dark' ? faMoon : faSun} /></i>
                  <span><b>Appearance</b><small>{currentPaletteLabel} · {theme === 'dark' ? 'Dark' : 'Light'} mode</small></span>
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
                <button className="settings-nav-row" onClick={() => setActiveSection('study')}>
                  <i><FontAwesomeIcon icon={faBullseye} /></i>
                  <span><b>Study &amp; reminders</b><small>{settings.target} questions daily · {settings.remind ? settings.reminderTime || '19:00' : 'nudges off'}</small></span>
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
                <button className="settings-nav-row" onClick={() => setActiveSection('reading')}>
                  <i><FontAwesomeIcon icon={faNewspaper} /></i>
                  <span><b>News &amp; reading</b><small>{enabledSourceCount} sources · {gsFilter.length} GS papers</small></span>
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
                <button className="settings-nav-row" onClick={() => setActiveSection('updates')}>
                  <i><FontAwesomeIcon icon={faBell} /></i>
                  <span><b>Briefing updates</b><small>{isGuest ? 'Sign in to enable' : [profile?.emailUpdates && 'Email', profile?.whatsappUpdates && 'WhatsApp'].filter(Boolean).join(' + ') || 'Off'}</small></span>
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            </section>

            <section className="settings-home-group">
              <h3>App &amp; account</h3>
              <div>
                <button className="settings-nav-row" onClick={() => setActiveSection('data')}>
                  <i><FontAwesomeIcon icon={faShieldHalved} /></i>
                  <span><b>Data &amp; support</b><small>Privacy, backup, help and reset</small></span>
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
                <button className="settings-nav-row" onClick={() => setActiveSection('advanced')}>
                  <i><FontAwesomeIcon icon={faKey} /></i>
                  <span><b>Advanced tools</b><small>Optional personal evaluation key</small></span>
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            </section>

            <button className={`settings-session-action ${isGuest ? '' : 'danger'}`} onClick={() => void handleSignOut()}>
              <FontAwesomeIcon icon={isGuest ? faUser : faRightFromBracket} />
              {isGuest ? 'Sign in to sync progress' : 'Sign out'}
            </button>
          </>
        )}

        {activeSection === 'appearance' && (
          <div className="settings-section-page">
            <div className="settings-section-intro"><span>Make it yours</span><h3>Choose a calm reading environment.</h3><p>Colour and brightness change independently, so your selected pastel also works in dark mode.</p></div>

            <section className="settings-control-card">
              <div className="settings-control-head"><span><FontAwesomeIcon icon={theme === 'dark' ? faMoon : faSun} /><b>Brightness</b></span><small>Changes only when you choose it</small></div>
              <div className="settings-segmented">
                <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}><FontAwesomeIcon icon={faSun} /> Light</button>
                <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}><FontAwesomeIcon icon={faMoon} /> Dark</button>
              </div>
            </section>

            <section className="settings-control-card">
              <div className="settings-control-head"><span><FontAwesomeIcon icon={faSlidersH} /><b>Pastel theme</b></span><small>{currentPaletteLabel}</small></div>
              <div className="settings-palette-grid">
                {APP_PALETTES.map(item => (
                  <button key={item.id} className={palette === item.id ? 'active' : ''} onClick={() => setPalette(item.id)} aria-pressed={palette === item.id}>
                    <span>{item.colors.map((color, index) => <i key={color} style={{ background: color, zIndex: 3 - index }} />)}</span>
                    <b>{item.label}</b>
                    {palette === item.id && <FontAwesomeIcon icon={faCheck} />}
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-control-card settings-auto-theme">
              <div className="settings-toggle-row">
                <span><b>Auto-shuffle colours</b><small>Rotate the pastel palette on a schedule</small></span>
                <button className={`toggle ${autoShufflePalette ? 'on' : ''}`} onClick={() => setAutoShufflePalette(!autoShufflePalette)} aria-label="Toggle automatic colour shuffle" />
              </div>
              {autoShufflePalette && (
                <div className="settings-interval-row">
                  <span>Change every</span>
                  <div>{([3, 6, 12] as PaletteIntervalHours[]).map(hours => <button key={hours} className={paletteIntervalHours === hours ? 'active' : ''} onClick={() => setPaletteIntervalHours(hours)}>{hours}h</button>)}</div>
                </div>
              )}
              <button className="settings-shuffle-now" onClick={randomizePalette}><FontAwesomeIcon icon={faRotate} /> Surprise me now</button>
            </section>

            <section className="settings-control-card settings-compact-list">
              <div className="settings-toggle-row"><span><b>Animated feed backdrop</b><small>Depth and motion on the briefing feed</small></span><button className={`toggle ${settings.feedCosmicBackdrop ? 'on' : ''}`} onClick={() => void toggleFeedBackdrop()} aria-label="Toggle animated feed backdrop" /></div>
              <div className="settings-toggle-row"><span><b>Haptic feedback</b><small>Subtle response for study actions</small></span><button className={`toggle ${settings.hapticsEnabled ? 'on' : ''}`} onClick={() => saveSettings({ hapticsEnabled: !settings.hapticsEnabled })} aria-label="Toggle haptic feedback" /></div>
              <div className="settings-toggle-row"><span><b>Auto-advance Learn mode</b><small>Move on after feedback; tap Stay when you need longer with an explanation</small></span><button className={`toggle ${settings.learnAutoAdvance ? 'on' : ''}`} onClick={() => saveSettings({ learnAutoAdvance: !settings.learnAutoAdvance })} aria-label="Toggle Learn mode auto-advance" /></div>
            </section>
          </div>
        )}

        {activeSection === 'study' && (
          <div className="settings-section-page">
            <div className="settings-section-intro"><span>Your rhythm</span><h3>A target that is visible, not noisy.</h3><p>Set one daily number and an optional reminder. Detailed targets remain in your Account page.</p></div>
            <div className="settings-rhythm-card">
              <div className="settings-rhythm-top"><FontAwesomeIcon icon={faBullseye} /><div><span>Today’s progress</span><b>{todayDone} / {settings.target} questions</b></div><strong>{targetPct}%</strong></div>
              <div className="settings-rhythm-bar"><i style={{ width: `${targetPct}%` }} /></div>
              <div className="settings-target-row"><span>Daily target</span><div className="pn-step"><button onClick={() => setDailyTarget(Math.max(5, settings.target - 5))}>−</button><b>{settings.target}</b><button onClick={() => setDailyTarget(Math.min(50, settings.target + 5))}>+</button></div></div>
              <div className="settings-reminder-row"><div><FontAwesomeIcon icon={faClock} /><span>Revision nudge</span></div><input type="time" value={settings.reminderTime || '19:00'} onChange={event => setReminderTime(event.target.value)} aria-label="Reminder time" /><button className={`toggle ${settings.remind ? 'on' : ''}`} onClick={() => void enableReminder(!settings.remind)} aria-label="Toggle revision reminder" /></div>
              <button className="settings-test-nudge" onClick={testReminder}><FontAwesomeIcon icon={faBell} /> Test nudge</button>
            </div>
          </div>
        )}

        {activeSection === 'reading' && (
          <div className="settings-section-page">
            <div className="settings-section-intro"><span>Your syllabus</span><h3>Control what reaches the feed.</h3><p>These preferences refine discovery. They do not delete articles or PYQs.</p></div>
            <section className="settings-control-card">
              <div className="settings-control-head"><span><FontAwesomeIcon icon={faGlobe} /><b>Reading language</b></span><small>{readingLanguage === 'hindi' ? 'हिन्दी' : 'English'}</small></div>
              <div className="settings-options-grid clean">
                <button className={readingLanguage === 'english' ? 'active' : ''} onClick={() => void chooseReadingLanguage('english')} disabled={authSaving}><span>English</span><i>{readingLanguage === 'english' ? 'Default' : 'Choose'}</i></button>
                <button className={readingLanguage === 'hindi' ? 'active' : ''} onClick={() => void chooseReadingLanguage('hindi')} disabled={authSaving}><span>हिन्दी</span><i>{readingLanguage === 'hindi' ? 'Default' : 'Choose'}</i></button>
              </div>
              <p className="settings-empty-note">Deep Dives open in this language when a reviewed translation is available; otherwise Penni shows the English original.</p>
            </section>
            <section className="settings-control-card">
              <div className="settings-control-head"><span><FontAwesomeIcon icon={faSlidersH} /><b>GS papers</b></span><small>{gsFilter.length} selected</small></div>
              <div className="settings-gs-grid">{['GS1', 'GS2', 'GS3', 'GS4'].map(item => <button key={item} className={gsFilter.includes(item) ? 'active' : ''} onClick={() => toggleGs(item)}>{item.replace('GS', 'GS ')}</button>)}</div>
            </section>
            <section className="settings-control-card">
              <div className="settings-control-head"><span><FontAwesomeIcon icon={faNewspaper} /><b>News sources</b></span><small>{enabledSourceCount} of {NEWS_SOURCES.length}</small></div>
              <div className="settings-options-grid clean">{NEWS_SOURCES.map(source => <button key={source.key} className={sourceFilter[source.key] ? 'active' : ''} onClick={() => handleToggleSource(source.key)}><span>{source.label}</span><i>{sourceFilter[source.key] ? 'On' : 'Off'}</i></button>)}</div>
            </section>
            <section className="settings-control-card">
              <div className="settings-control-head"><span><FontAwesomeIcon icon={faMicrophone} /><b>Narration voice</b></span><small>{selectedVoice?.name || 'Automatic'}</small></div>
              {curatedVoices.length === 0 ? <p className="settings-empty-note">No narration voices are available on this device yet.</p> : <div className="voice-picker-list compact clean">{curatedVoices.map(voice => { const active = settings.voiceURI === voice.voiceURI; return <div key={voice.voiceURI} className={`voice-picker-row ${active ? 'on' : ''}`}><button className="voice-picker-select" onClick={() => chooseVoice(voice.voiceURI)}><FontAwesomeIcon icon={faMicrophone} /><span><b>{voice.name}</b><i>{voice.lang}</i></span></button><button className="voice-picker-preview" onClick={() => previewVoice(voice.voiceURI)} aria-label={`Preview ${voice.name}`}><FontAwesomeIcon icon={faPlay} /></button></div> })}</div>}
            </section>
          </div>
        )}

        {activeSection === 'updates' && (
          <div className="settings-section-page">
            <div className="settings-section-intro"><span>Stay informed</span><h3>Only the updates you ask for.</h3><p>Briefings are sent when a new current-affairs pack is published. Feature announcements are occasional.</p></div>
            {isGuest && <div className="settings-info-banner"><FontAwesomeIcon icon={faUser} /><span><b>Sign in required</b><small>Add an email or WhatsApp number from your Account page first.</small></span></div>}
            <section className="settings-control-card settings-update-card">
              <div className="settings-update-icon email"><FontAwesomeIcon icon={faEnvelopeOpenText} /></div><span><b>Email briefings</b><small>Daily pack availability and important product updates.</small></span><button className={`toggle ${profile?.emailUpdates ? 'on' : ''}`} disabled={authSaving || isGuest} onClick={() => void toggleEmailUpdates()} aria-label="Toggle email updates" />
            </section>
            <section className="settings-control-card settings-update-card">
              <div className="settings-update-icon whatsapp"><FontAwesomeIcon icon={faWhatsapp} /></div><span><b>WhatsApp briefings</b><small>New-pack alert and major feature updates. No promotional spam.</small></span><button className={`toggle ${profile?.whatsappUpdates ? 'on' : ''}`} disabled={authSaving || isGuest} onClick={() => void toggleWhatsappUpdates()} aria-label="Toggle WhatsApp updates" />
            </section>
          </div>
        )}

        {activeSection === 'data' && (
          <div className="settings-section-page">
            <div className="settings-section-intro"><span>Control &amp; clarity</span><h3>Your data stays understandable.</h3><p>Support, legal documents and infrequent maintenance actions live here.</p></div>
            <section className="settings-control-card settings-link-list">
              <button onClick={() => window.open('/privacy.html', '_blank')}><span><FontAwesomeIcon icon={faShieldHalved} /> Privacy policy</span><FontAwesomeIcon icon={faChevronRight} /></button>
              <button onClick={() => window.open('/terms.html', '_blank')}><span><FontAwesomeIcon icon={faFileContract} /> Terms of use</span><FontAwesomeIcon icon={faChevronRight} /></button>
              <button onClick={() => window.location.href = 'mailto:support@penni.app?subject=Penni support'}><span><FontAwesomeIcon icon={faLifeRing} /> Help &amp; support</span><FontAwesomeIcon icon={faChevronRight} /></button>
              <button onClick={() => window.location.href = 'mailto:support@penni.app?subject=Penni feedback'}><span><FontAwesomeIcon icon={faEnvelope} /> Send feedback</span><FontAwesomeIcon icon={faChevronRight} /></button>
            </section>
            <section className="settings-control-card">
              <div className="settings-control-head"><span><FontAwesomeIcon icon={faFileImport} /><b>Content backup</b></span><small>For manual archives</small></div>
              <div className="settings-data-actions">{onOpenImport && <button onClick={onOpenImport}><FontAwesomeIcon icon={faFileImport} /> Import JSON</button>}<button onClick={handleBackupContent}><FontAwesomeIcon icon={faFileExport} /> Export backup</button></div>
            </section>
            <section className={`settings-control-card settings-danger-zone ${dangerOpen ? 'open' : ''}`}>
              <button className="settings-danger-head" onClick={() => setDangerOpen(value => !value)}><span><FontAwesomeIcon icon={faTrash} /><b>Reset &amp; cleanup</b></span><FontAwesomeIcon icon={faChevronDown} /></button>
              {dangerOpen && <div className="settings-danger-actions"><button onClick={handleClearBookmarks}>Clear bookmarks</button><button onClick={handleResetContent}>Reset feed content</button><button onClick={handleReset}>Reset this app</button><button onClick={() => void handleDeleteAccount()}>{isGuest ? 'Erase guest data' : 'Delete account'}</button></div>}
            </section>
          </div>
        )}

        {activeSection === 'advanced' && (
          <div className="settings-section-page">
            <div className="settings-section-intro"><span>Optional</span><h3>Personal AI evaluation key.</h3><p>This is only for aspirants who want to use their own Claude key for Mains evaluation. The rest of Penni does not require it.</p></div>
            <section className="settings-control-card settings-api-card">
              <label><span>Claude API key</span><input type="password" defaultValue={settings.key} placeholder="sk-ant-..." onChange={event => saveSettings({ key: event.target.value.trim() })} /></label>
              <p>Stored only on this device and used only when you request a Mains evaluation. Daily limit: five uploads.</p>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
