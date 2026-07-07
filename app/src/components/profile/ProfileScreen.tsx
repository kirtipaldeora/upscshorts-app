import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faMoon, faSun, faUser, faScroll, faEarthAsia, faLayerGroup, faBell, faShieldHalved } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import { useThemeStore } from '@/stores/useThemeStore'

export function ProfileScreen() {
  const { setScreen, articlesByDate, gsFilter, setGsFilter } = useAppStore()
  const { bookmarkedIds } = useBookmarkStore()
  const { theme, toggle } = useThemeStore()

  const totalArticles = Object.values(articlesByDate).flat().length
  const totalDates = Object.keys(articlesByDate).length

  type GsPaper = 'GS 1' | 'GS 2' | 'GS 3' | 'GS 4'
  const gsPapers: GsPaper[] = ['GS 1', 'GS 2', 'GS 3', 'GS 4']

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent',
        zIndex: 10,
        animation: 'scrIn 0.35s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* Header */}
      <div style={{ height: 58, display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', flexShrink: 0, position: 'relative', zIndex: 2 }}>
        <button onClick={() => setScreen('feed')} className="icon-btn">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2 style={{ fontSize: 21, fontWeight: 900, letterSpacing: -0.3, flex: 1, color: 'var(--on)' }}>Profile</h2>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px calc(110px + env(safe-area-inset-bottom))', position: 'relative', zIndex: 2 }}>

        {/* Profile card */}
        <div style={{ textAlign: 'center', padding: 24, background: 'var(--card)', borderRadius: 26, marginBottom: 22, boxShadow: 'var(--shadow-soft)', color: 'var(--ink)' }}>
          <div style={{ width: 66, height: 66, borderRadius: 24, background: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: 'var(--yellow-ink)', margin: '0 auto 12px' }}>
            <FontAwesomeIcon icon={faUser} />
          </div>
          <h3 style={{ fontSize: 19, fontWeight: 900, marginBottom: 2, color: 'var(--ink)' }}>UPSC Aspirant</h3>
          <p style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 700 }}>michi · Daily Reader</p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--acc)' }}>{totalArticles}</div>
              <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 1, fontWeight: 800 }}>Articles</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--acc)' }}>{bookmarkedIds.length}</div>
              <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 1, fontWeight: 800 }}>Bookmarks</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--acc)' }}>{totalDates}</div>
              <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 1, fontWeight: 800 }}>Days</div>
            </div>
          </div>
        </div>

        {/* GS Paper filter */}
        <p style={{ fontSize: 10, fontWeight: 900, color: 'var(--on2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, padding: '0 6px' }}>
          GS Papers
        </p>
        {gsPapers.map((gs) => (
          <div
            key={gs}
            onClick={() => setGsFilter({ ...gsFilter, [gs]: !gsFilter[gs] })}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 15px', background: 'var(--card)', borderRadius: 18, marginBottom: 8, cursor: 'pointer', boxShadow: 'var(--shadow-soft)', color: 'var(--ink)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 13, background: 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink2)', fontSize: 13 }}>
                <FontAwesomeIcon icon={faScroll} />
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{gs} Paper</span>
            </div>
            {/* Toggle */}
            <div
              style={{
                width: 46, height: 26, borderRadius: 13,
                background: gsFilter[gs] ? 'var(--yellow)' : 'var(--border)',
                position: 'relative', cursor: 'pointer', transition: 'all 0.3s',
              }}
            >
              <div style={{
                position: 'absolute', width: 20, height: 20, borderRadius: '50%', background: '#fff',
                top: 3, left: gsFilter[gs] ? 23 : 3, transition: 'all 0.3s', boxShadow: '0 2px 6px rgba(0,0,0,.2)',
              }} />
            </div>
          </div>
        ))}

        {/* Appearance */}
        <p style={{ fontSize: 10, fontWeight: 900, color: 'var(--on2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 14, padding: '0 6px' }}>
          Appearance
        </p>
        <div
          onClick={toggle}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 15px', background: 'var(--card)', borderRadius: 18, marginBottom: 8, cursor: 'pointer', boxShadow: 'var(--shadow-soft)', color: 'var(--ink)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 13, background: 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink2)', fontSize: 13 }}>
              <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} />
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Dark Mode</span>
          </div>
          <div style={{ width: 46, height: 26, borderRadius: 13, background: theme === 'dark' ? 'var(--yellow)' : 'var(--border)', position: 'relative', transition: 'all 0.3s' }}>
            <div style={{ position: 'absolute', width: 20, height: 20, borderRadius: '50%', background: '#fff', top: 3, left: theme === 'dark' ? 23 : 3, transition: 'all 0.3s', boxShadow: '0 2px 6px rgba(0,0,0,.2)' }} />
          </div>
        </div>

        {/* App info */}
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--on3)', fontWeight: 700, marginTop: 24 }}>
          michi v1.0 · UPSC Current Affairs
        </p>
      </div>
    </div>
  )
}
