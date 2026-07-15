import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faClock,
  faCircleInfo,
  faDesktop,
  faEnvelope,
  faEye,
  faEyeSlash,
  faExpand,
  faHourglassHalf,
  faLaptop,
  faLock,
  faMobileScreenButton,
  faShieldHalved,
  faTriangleExclamation,
  faUserGroup,
  faVolumeHigh,
} from '@fortawesome/free-solid-svg-icons'
import type { FocusPlatform, FocusPreferences, FocusTimerSettings } from './focusTypes'
import { FocusSectionHeading, FocusToggle } from './FocusPrimitives'

interface FocusSettingsProps {
  preferences: FocusPreferences
  timerSettings: FocusTimerSettings
  platform: FocusPlatform
  nativeFocusShieldAvailable: boolean
  onChange: <K extends keyof FocusPreferences>(key: K, value: FocusPreferences[K]) => void
  onTimerChange: <K extends keyof FocusTimerSettings>(key: K, value: FocusTimerSettings[K]) => void
  onShieldAction: () => void
}

export function FocusSettings({ preferences, timerSettings, platform, nativeFocusShieldAvailable, onChange, onTimerChange, onShieldAction }: FocusSettingsProps) {
  const platformTitle = platform === 'web' ? 'Web Focus Shield' : `${platform === 'ios' ? 'iOS' : 'Android'} Focus Shield`
  const platformText = platform === 'web'
    ? 'The web app can keep the focus timer prominent and detect tab visibility changes. Browsers cannot reliably block other apps, websites or system notifications.'
    : nativeFocusShieldAvailable
      ? `This native ${platform === 'ios' ? 'iOS' : 'Android'} build may request supported operating-system controls. Nothing is restricted until the user grants the system permission.`
      : `No native restriction capability is connected in this ${platform === 'ios' ? 'iOS' : 'Android'} build. Use the device’s own Focus, Digital Wellbeing or Do Not Disturb controls.`
  const completionNotificationDetail = platform === 'web'
    ? 'Best-effort alert while Penni remains open. Browsers cannot guarantee a scheduled background notification.'
    : 'Schedule a native local notification when a countdown ends, after the user grants notification permission.'

  return (
    <div className="focus-view focus-settings-view">
      <FocusSectionHeading eyebrow="Focus settings" title="Control the timer and what others see." detail="Privacy defaults should stay conservative; every social signal remains opt-in." />

      <div className="focus-settings-grid">
        <section className="focus-card focus-settings-card focus-duration-settings">
          <div className="focus-settings-card-head"><i><FontAwesomeIcon icon={faClock} /></i><div><span>Pomodoro</span><h3>Block and break lengths</h3></div></div>
          <DurationField label="Default focus" value={timerSettings.focusSeconds} fallback={1_500} onChange={value => onTimerChange('focusSeconds', value)} />
          <DurationField label="Short break" value={timerSettings.shortBreakSeconds} fallback={300} onChange={value => onTimerChange('shortBreakSeconds', value)} />
          <DurationField label="Long break" value={timerSettings.longBreakSeconds} fallback={900} onChange={value => onTimerChange('longBreakSeconds', value)} />
          <DurationField label="Daily focus goal" value={timerSettings.dailyGoalSeconds} fallback={0} placeholder="Not set" maxMinutes={960} onChange={value => onTimerChange('dailyGoalSeconds', value)} />
        </section>

        <section className="focus-card focus-settings-card">
          <div className="focus-settings-card-head"><i><FontAwesomeIcon icon={faUserGroup} /></i><div><span>Social notifications</span><h3>Requests and invitations</h3></div></div>
          <FocusToggle checked={preferences.friendRequests} label="Friend requests" detail="Allow exact-match contacts to send a request." onChange={value => onChange('friendRequests', value)} />
          <FocusToggle checked={preferences.groupInvites} label="Group invitations" detail="Allow friends and group admins to invite you." onChange={value => onChange('groupInvites', value)} />
        </section>

        <section className="focus-card focus-settings-card">
          <div className="focus-settings-card-head"><i><FontAwesomeIcon icon={faEye} /></i><div><span>Social privacy</span><h3>Visibility controls</h3></div></div>
          <FocusToggle checked={preferences.showLiveStatus} label="Show live focus status" detail="Friends can see the subject and elapsed block time—not your screen." onChange={value => onChange('showLiveStatus', value)} />
          <FocusToggle checked={preferences.shareFocusTime} label="Share focus totals" detail="Eligible friends and groups can see today/week totals." onChange={value => onChange('shareFocusTime', value)} />
          <FocusToggle checked={preferences.publicProfile} label="Appear in rankings" detail="Allow eligible friends and groups to rank shared focus totals." onChange={value => onChange('publicProfile', value)} />
        </section>

        <section className="focus-card focus-settings-card">
          <div className="focus-settings-card-head"><i><FontAwesomeIcon icon={faHourglassHalf} /></i><div><span>Timer behaviour</span><h3>Automation and session feedback</h3></div></div>
          <FocusToggle checked={timerSettings.autoStartBreaks} label="Auto-start breaks" detail="Begin the selected break when a focus countdown completes." onChange={value => onTimerChange('autoStartBreaks', value)} />
          <FocusToggle checked={timerSettings.autoStartFocus} label="Auto-start focus" detail="Begin the next focus block when a break completes." onChange={value => onTimerChange('autoStartFocus', value)} />
          <FocusToggle checked={timerSettings.soundEnabled} label="Break and completion alarm" detail="Ring when a countdown reaches zero. Turn this off for silent alerts." onChange={value => onTimerChange('soundEnabled', value)} />
          <FocusToggle checked={timerSettings.completionNotifications} label="Completion notification" detail={completionNotificationDetail} onChange={value => onTimerChange('completionNotifications', value)} />
        </section>

        <section className="focus-card focus-settings-card">
          <div className="focus-settings-card-head"><i><FontAwesomeIcon icon={faDesktop} /></i><div><span>Focused use</span><h3>Screen and exit behaviour</h3></div></div>
          <FocusToggle checked={timerSettings.keepScreenAwake} label="Keep screen awake" detail="Use the browser/native wake-lock only while a session is active and permission allows it." onChange={value => onTimerChange('keepScreenAwake', value)} />
          <FocusToggle checked={timerSettings.fullscreenSessions} label="Full-screen sessions" detail="Open the focused session sheet when the timer starts." onChange={value => onTimerChange('fullscreenSessions', value)} />
          <FocusToggle checked={timerSettings.strictMode} label="Strict mode" detail="Require a clear in-app confirmation before ending a running focus block." onChange={value => onTimerChange('strictMode', value)} />
        </section>
      </div>

      <section className="focus-strict-note"><FontAwesomeIcon icon={faTriangleExclamation} /><div><b>Strict mode is behavioural, not device enforcement.</b><p>It adds an in-app confirmation before finishing a running block. It cannot prevent closing a browser tab or bypass operating-system controls.</p></div><span><FontAwesomeIcon icon={faExpand} /><FontAwesomeIcon icon={faVolumeHigh} /></span></section>

      <section className="focus-privacy-card">
        <div><FontAwesomeIcon icon={faLock} /></div>
        <span>Discovery privacy</span>
        <h3>No browsable people directory</h3>
        <p>A user can find an account only through an exact, verified email address or full phone number, and only if that account has opted into friend requests. Partial searches must return nothing.</p>
        <ul><li><FontAwesomeIcon icon={faEnvelope} /> Email or phone is normalised and SHA-256 hashed on-device; only the one-way hash is sent for lookup.</li><li><FontAwesomeIcon icon={faEyeSlash} /> Blocking removes mutual lookup visibility and future requests.</li><li><FontAwesomeIcon icon={faUserGroup} /> Group visibility follows each room’s public/private setting.</li></ul>
      </section>

      <section className={`focus-platform-shield ${preferences.focusShield ? 'enabled' : ''}`}>
        <div className="focus-platform-icon"><FontAwesomeIcon icon={platform === 'web' ? faLaptop : faMobileScreenButton} /></div>
        <div><span><FontAwesomeIcon icon={faShieldHalved} /> {platformTitle}</span><h3>{nativeFocusShieldAvailable && platform !== 'web' ? 'Operating-system permission available' : 'Capability explained honestly'}</h3><p>{platformText}</p><small><FontAwesomeIcon icon={faCircleInfo} /> Enabling this preference does not itself prove that apps are blocked.</small></div>
        <div className="focus-platform-actions">
          <button className="toggle" onClick={() => onChange('focusShield', !preferences.focusShield)}>{preferences.focusShield ? 'Disable shield' : 'Enable shield'}</button>
          <button onClick={onShieldAction}>{preferences.focusShield ? 'Review setup' : 'View setup'}</button>
        </div>
      </section>
    </div>
  )
}

function DurationField({ label, value, fallback, placeholder, maxMinutes = 180, onChange }: { label: string; value: number; fallback: number; placeholder?: string; maxMinutes?: number; onChange: (seconds: number) => void }) {
  const minutes = value > 0 ? Math.round(value / 60) : ''
  return <label className="focus-duration-row"><span><b>{label}</b><small>{fallback ? `Safe fallback · ${Math.round(fallback / 60)} minutes` : 'Optional target'}</small></span><div><input type="number" min="1" max={maxMinutes} value={minutes} placeholder={placeholder} onChange={event => { const next = Number(event.target.value); onChange(Number.isFinite(next) && next > 0 ? Math.min(maxMinutes, Math.round(next)) * 60 : 0) }} /><em>min</em></div></label>
}
