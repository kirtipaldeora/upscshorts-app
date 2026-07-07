import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faXmark,
  faUser,
  faSun,
  faMoon,
  faSlidersH,
  faBullseye,
  faBell,
  faKey,
  faFileExport,
  faTrash,
  faRotate,
  faArrowRotateLeft,
  faShieldHalved,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { useAppStore } from '@/stores/useAppStore'
import { useBookmarkStore } from '@/stores/useBookmarkStore'

interface SettingsScreenProps {
  onClose: () => void
  onShowToast: (msg: string) => void
}

export function SettingsScreen({ onClose, onShowToast }: SettingsScreenProps) {
  const { settings, saveSettings } = usePracticeStore()
  const { theme, toggle } = useThemeStore()
  const { articlesByDate, setArticlesByDate } = useAppStore()
  const { clearAll } = useBookmarkStore()
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
    onShowToast(`${g} ${next.includes(g) ? 'enabled' : 'disabled'}`)
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

  function handleBackupContent() {
    const blob = new Blob([JSON.stringify(articlesByDate, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'penni_backup.json'
    a.click()
    onShowToast('Backup exported')
  }

  return (
    <div className="quiz-overlay">
      <div className="quiz-header">
        <span className="qz-title">Settings</span>
        <button className="icon-btn" onClick={onClose}>
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
      <div className="quiz-body">

        {/* Account */}
        <div className="setting-group">
          <div className="setting-group-title">Account</div>
          <div className="setting-item">
            <div className="setting-left">
              <FontAwesomeIcon icon={faUser} style={{ width: 14 }} />
              <span>Display name</span>
            </div>
            <input
              className="pn-inp"
              defaultValue={settings.name}
              placeholder="Aspirant"
              onChange={e => saveSettings({ name: e.target.value })}
            />
          </div>
        </div>

        {/* Preferences */}
        <div className="setting-group">
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

        {/* Daily practice */}
        <div className="setting-group">
          <div className="setting-group-title">Daily practice</div>
          <div className="setting-item">
            <div className="setting-left">
              <FontAwesomeIcon icon={faBullseye} style={{ width: 14 }} />
              <span>Daily question target</span>
            </div>
            <div className="pn-step">
              <button onClick={() => saveSettings({ target: Math.max(5, settings.target - 5) })}>−</button>
              <b>{settings.target}</b>
              <button onClick={() => saveSettings({ target: Math.min(50, settings.target + 5) })}>+</button>
            </div>
          </div>
          <div className="setting-item" onClick={() => {
            const next = !settings.remind
            saveSettings({ remind: next })
            if (next && 'Notification' in window && Notification.permission === 'default') {
              Notification.requestPermission()
            }
          }}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faBell} style={{ width: 14 }} />
              <span>Revision reminder (7 pm, app open)</span>
            </div>
            <button
              className={`toggle ${settings.remind ? 'on' : ''}`}
              onClick={e => e.stopPropagation()}
              aria-label="Toggle reminder"
            />
          </div>
        </div>

        {/* AI evaluation */}
        <div className="setting-group">
          <div className="setting-group-title">AI evaluation (Mains)</div>
          <div className="setting-item" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faKey} style={{ width: 14 }} />
              <span>Claude API key</span>
            </div>
            <input
              className="pn-inp wide"
              type="password"
              defaultValue={settings.key}
              placeholder="sk-ant-..."
              onChange={e => {
                const v = e.target.value.trim()
                saveSettings({ key: v })
                if (v) onShowToast('Key saved on this device')
              }}
            />
          </div>
          <p className="pn-note">
            Stored only on this device. Used to evaluate your Mains answers with Claude (model: claude-opus-4-8).
            Get a key at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>console.anthropic.com</a>. Daily limit: 5 uploads.
          </p>
        </div>

        {/* Data & privacy */}
        <div className="setting-group">
          <div className="setting-group-title">Data &amp; privacy</div>
          <div className="setting-item" onClick={handleBackupContent}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faFileExport} style={{ width: 14 }} />
              <span>Backup all content (JSON)</span>
            </div>
          </div>
          <div className="setting-item" onClick={handleClearBookmarks}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faTrash} style={{ width: 14, color: '#E36D6D' }} />
              <span style={{ color: '#E36D6D' }}>Clear bookmarks</span>
            </div>
          </div>
          <div className="setting-item" onClick={handleResetContent}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faRotate} style={{ width: 14, color: '#E36D6D' }} />
              <span style={{ color: '#E36D6D' }}>Reset content</span>
            </div>
          </div>
          <div className="setting-item" onClick={handleReset}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faArrowRotateLeft} style={{ width: 14, color: '#E36D6D' }} />
              <span style={{ color: '#E36D6D' }}>Reset app</span>
            </div>
          </div>
          <div className="setting-item" onClick={() => window.open('/privacy.html', '_blank')}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faShieldHalved} style={{ width: 14 }} />
              <span>Privacy policy</span>
            </div>
            <FontAwesomeIcon icon={faChevronRight} style={{ color: 'var(--ink3)', fontSize: 11 }} />
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
