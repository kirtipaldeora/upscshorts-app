import { useEffect, useRef, useState, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { useAtlasArcade } from './useAtlasArcade'
import { useArcadeSound } from './useArcadeSound'
import { AtlasMap } from './AtlasMap'
import type { AtlasMapHandle } from './AtlasMap'
import { CONT_ORDER, CONT_COLOR, CONT_DATA, RIVER_SYSTEMS, ACCENT } from './atlasData'
import type { QuizItem } from '@/types/quiz'

// ─── Style helpers ────────────────────────────────────────────────────────────

const F = 'Fredoka,sans-serif'
const N = 'Nunito,sans-serif'

const BG = 'radial-gradient(1200px 600px at 80% -10%,#FFF3E0 0%,rgba(255,243,224,0) 60%),linear-gradient(165deg,#FFF4E6 0%,#FFE7CF 55%,#FFDDC1 100%)'

function btn(extra: string = ''): React.CSSProperties {
  return {
    border: '1.5px solid #EADFD2', background: '#fff', color: '#5A4A3C',
    fontFamily: F, fontWeight: 600, fontSize: 15, padding: '11px 18px',
    borderRadius: 13, cursor: 'pointer', ...JSON.parse(extra || '{}'),
  } as React.CSSProperties
}

const OVERLAY: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
  justifyContent: 'center', background: 'rgba(255,250,244,.92)',
  backdropFilter: 'blur(3px)', zIndex: 6, padding: 24,
  animation: 'qzfade .3s ease both',
}

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 22, border: '1px solid #F5ECE0',
  boxShadow: '0 30px 70px -24px rgba(80,50,20,.55)',
  maxHeight: '96%', overflow: 'auto',
}

const GRID_BTN: React.CSSProperties = {
  display: 'flex', alignItems: 'stretch', textAlign: 'left',
  background: '#fff', border: '1.5px solid #F0E4D6', borderRadius: 18,
  overflow: 'hidden', cursor: 'pointer', padding: 0,
  boxShadow: '0 12px 28px -16px rgba(80,50,20,.5)',
  transition: 'transform .15s, box-shadow .15s',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MapsArcade() {
  const { setOverlay } = useAppStore()
  const arcade = useAtlasArcade()
  const { state } = arcade
  const { playSound } = useArcadeSound()
  const mapRef = useRef<AtlasMapHandle>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Parks loaded from JSON
  const [allParks, setAllParks] = useState<QuizItem[]>([])
  const [parkRegionData, setParkRegionData] = useState<{key:string;name:string;color:string;blurb:string;states:string[];bounds:[[number,number],[number,number]]}[]>([])

  // Load parks JSON once
  useEffect(() => {
    fetch('/data/india-national-parks.json')
      .then(r => r.json())
      .then(d => {
        setParkRegionData(d.regions ?? [])
        setAllParks((d.parks ?? []).map((p: {id:number;name:string;state:string;region:string;lon:number;lat:number}) => ({
          id: p.id, name: p.name, parkRegion: p.region, lon: p.lon, lat: p.lat,
        })))
      })
      .catch(() => {/* parks unavailable */})
  }, [])

  // Auto-clear toast
  useEffect(() => {
    if (!state.toast) return
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => arcade.clearToast(), 1600)
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current) }
  }, [state.toast]) // eslint-disable-line react-hooks/exhaustive-deps

  // Play sounds on toast
  useEffect(() => {
    if (!state.toast) return
    if (state.toast.kind === 'correct') playSound('correct', !state.sound)
    else if (state.toast.kind === 'wrong') playSound('wrong', !state.sound)
    else if (state.toast.kind === 'hint') playSound('hint', !state.sound)
  }, [state.toast]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    arcade.goHome()
    setOverlay(null)
  }

  // Compute displayed parks for current state
  const visibleParks = useCallback((): QuizItem[] => {
    if (state.category !== 'india-parks') return []
    if (state.parkRegion) return allParks.filter(p => p.parkRegion === state.parkRegion)
    if (state.screen === 'parkLearn') {
      let ps = state.parkRegion ? allParks.filter(p => p.parkRegion === state.parkRegion) : allParks
      if (state.parkLearnState) ps = ps.filter(p => (p as {state?:string}).state === state.parkLearnState)
      return ps
    }
    return allParks
  }, [state, allParks])

  function startPlay() {
    if (state.category === 'india-parks') {
      const pool = state.parkRegion ? allParks.filter(p => p.parkRegion === state.parkRegion) : allParks
      arcade.startPlay(pool)
    } else {
      arcade.startPlay()
    }
  }

  // Derived display values
  const qTotal = state.queue.length
  const qNum = state.qIndex + 1
  const pct = qTotal > 0 ? (state.correctCount / qTotal) * 100 : 0
  const tagline = state.category === 'world' && state.continent ? state.continent.toUpperCase()
    : state.category === 'india-rivers' ? 'RIVER SYSTEMS'
    : state.category === 'india-parks' ? 'NATIONAL PARKS'
    : 'GEOGRAPHY QUIZ'
  const accuracy = qNum > 1 ? Math.round((state.correctCount / Math.max(1, state.answerHistory.length)) * 100) : 0
  void pct

  const countOptions = [10, 20, 30, 'All']
  const poolSize = state.category === 'world' && state.continent
    ? (CONT_DATA[state.continent]?.length ?? 0)
    : state.category === 'india-rivers' && state.riverSystem
    ? RIVER_SYSTEMS.find(s => s.key === state.riverSystem)?.name ? 27 : 27
    : state.category === 'india-parks'
    ? (state.parkRegion ? allParks.filter(p => p.parkRegion === state.parkRegion).length : allParks.length)
    : 0

  return (
    <div
      className="atlas-shell"
      style={{
        width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
        fontFamily: N, color: '#2B2620', background: BG,
        position: 'fixed', inset: 0, paddingTop: 'env(safe-area-inset-top)', zIndex: 300,
      }}
    >
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <header className="atlas-header" style={{
        width: '100%', maxWidth: 1180, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14,
      }}>
        <button onClick={handleClose} title="Home" style={{
          display: 'flex', alignItems: 'center', gap: 13, border: 'none',
          background: 'transparent', cursor: 'pointer', padding: 0,
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', boxShadow: '0 8px 18px -6px rgba(255,122,77,.7)', background: ACCENT,
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="none" stroke="#fff" strokeWidth="2"/>
              <ellipse cx="12" cy="12" rx="4.4" ry="10" fill="none" stroke="#fff" strokeWidth="2"/>
              <line x1="2" y1="12" x2="22" y2="12" stroke="#fff" strokeWidth="2"/>
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, textAlign: 'left' }}>
            <span style={{ fontFamily: F, fontWeight: 700, fontSize: 23, letterSpacing: '.5px', color: '#2B2620', whiteSpace: 'nowrap' }}>ATLAS ARCADE</span>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#C7A98F', marginTop: 3 }}>{tagline}</span>
          </div>
        </button>

        {state.screen === 'play' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: F, fontWeight: 600, fontSize: 16, color: '#fff', background: state.category === 'world' ? CONT_COLOR[state.continent ?? ''] ?? ACCENT : ACCENT, padding: '7px 16px', borderRadius: 11, boxShadow: '0 6px 14px -7px rgba(0,0,0,.5)' }}>
              {state.target?.name ?? ''}
            </span>
            <span style={{ fontFamily: F, fontWeight: 600, fontSize: 15, color: '#B79A82' }}>Q {qNum} / {qTotal}</span>
          </div>
        )}

        <div className="atlas-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          {state.screen === 'play' && (
            <>
              <div className="atlas-score" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', background: '#fff', border: '1.5px solid #F0E4D6', borderRadius: 14, padding: '8px 14px', minWidth: 88, boxShadow: '0 6px 16px -10px rgba(120,70,30,.4)' }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1px', color: '#C7A98F', textTransform: 'uppercase' }}>Score</span>
                <span style={{ fontFamily: F, fontWeight: 700, fontSize: 22, color: '#2B2620', lineHeight: 1.1 }}>{state.score}</span>
              </div>
              <div className="atlas-streak" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', background: '#fff', border: '1.5px solid #FBE6C2', borderRadius: 14, padding: '8px 14px', minWidth: 88, boxShadow: '0 6px 16px -10px rgba(255,176,32,.55)' }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1px', color: '#E0A94B', textTransform: 'uppercase' }}>Streak</span>
                <span style={{ fontFamily: F, fontWeight: 700, fontSize: 22, color: '#E8920E', lineHeight: 1.1 }}>{state.streak}</span>
              </div>
            </>
          )}
          <button
            onClick={arcade.toggleSound}
            title={state.sound ? 'Mute' : 'Unmute'}
            className="atlas-sound"
            style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid #E7DDCF', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}
          >
            {state.sound ? '🔊' : '🔇'}
          </button>
        </div>
      </header>

      {/* ─── Map Frame ──────────────────────────────────────────────────────── */}
      <div className="atlas-frame" style={{
        width: '100%', maxWidth: 1180, background: '#fff', borderRadius: 26,
        boxShadow: '0 24px 60px -26px rgba(80,50,20,.45)', border: '1px solid #fff',
        overflow: 'hidden', position: 'relative', flex: 1, minHeight: 0,
      }}>

        {/* Play question bar */}
        {state.screen === 'play' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, padding: 'clamp(12px,3vw,20px) clamp(14px,4vw,26px) clamp(10px,2.5vw,16px)', borderBottom: '1px solid #F5ECE0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '1 1 220px', minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '1.6px', textTransform: 'uppercase', color: '#C7A98F' }}>
                {state.playMode === 'locate' ? 'Find it on the map' : 'Pick the correct name'}
              </span>
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: 'clamp(26px,5.5vw,40px)', lineHeight: 1.05, color: '#2B2620', overflowWrap: 'anywhere' }}>
                {state.target?.name ?? ''}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flex: '1 1 240px', minWidth: 200, maxWidth: 300 }}>
              {/* Mode switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#FFF8F0', border: '1.5px solid #F4E2D0', borderRadius: 11, padding: 4, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 4, left: state.playMode === 'locate' ? 4 : 92, width: 84, height: 28, background: '#fff', borderRadius: 8, boxShadow: '0 3px 8px -3px rgba(120,70,30,.4)', border: '1px solid #F0DCC8', transition: 'left .2s' }} />
                {(['locate','name'] as const).map(m => (
                  <button key={m} onClick={() => arcade.setPlayMode(m)} style={{ position: 'relative', width: 84, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: F, fontWeight: 600, fontSize: 13, color: '#5A4A3C', borderRadius: 8 }}>
                    {m === 'locate' ? 'Find it' : 'Name it'}
                  </button>
                ))}
              </div>
              {/* Combo bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1.3px', textTransform: 'uppercase', color: '#C7A98F' }}>Combo</span>
                <span style={{ fontFamily: F, fontWeight: 700, fontSize: 15, color: '#E8920E' }}>×{state.combo}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 6, background: '#FBEFDD', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 6, background: 'linear-gradient(90deg,#FFB020,#FF7A4D)', width: `${Math.min(100, (state.streak / 6) * 100)}%`, transition: 'width .3s' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Map area ─────────────────────────────────────────────────────── */}
        <div className="atlas-map" style={{ position: 'relative', width: '100%', background: 'linear-gradient(180deg,#EAF6FB 0%,#F4FAFC 100%)' }}>
          <AtlasMap
            ref={mapRef}
            atlasState={state}
            parks={visibleParks()}
            onAnswer={id => { playSound('click', !state.sound); arcade.answer(id) }}
          />

          {/* MCQ choices (Name It mode) */}
          {state.screen === 'play' && state.playMode === 'name' && state.choices.length > 0 && !state.answeredThisRound && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 10, padding: '0 12px', pointerEvents: 'none' }}>
              {state.choices.map(c => (
                <button
                  key={String(c.id)}
                  onClick={() => { playSound('click', !state.sound); arcade.answer(c.id) }}
                  style={{
                    pointerEvents: 'auto', fontFamily: F, fontWeight: 700, fontSize: 16,
                    padding: '11px 22px', borderRadius: 14, border: '2px solid #E7DDCF',
                    background: '#fff', color: '#2B2620', cursor: 'pointer',
                    boxShadow: '0 8px 20px -10px rgba(80,50,20,.55)',
                    transition: 'transform .12s, box-shadow .12s',
                  }}
                  onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)' }}
                  onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {/* Toast */}
          {state.toast && (
            <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 9, animation: 'qzpop .35s ease both' }}>
              <div style={{
                fontFamily: F, fontWeight: 700, fontSize: 17, padding: '12px 22px', borderRadius: 16,
                boxShadow: '0 12px 28px -10px rgba(40,20,0,.4)',
                background: state.toast.kind === 'correct' ? '#22A36A' : state.toast.kind === 'wrong' ? '#FF5A5F' : '#FFB020',
                color: '#fff',
              }}>
                {state.toast.text}
              </div>
            </div>
          )}

          {/* Zoom buttons */}
          {state.screen === 'play' && (
            <div className="atlas-zoom" style={{ position: 'absolute', right: 16, bottom: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 7 }}>
              {[
                { label: '+', title: 'Zoom in', fn: () => mapRef.current?.zoomIn() },
                { label: '−', title: 'Zoom out', fn: () => mapRef.current?.zoomOut() },
                { label: '⊞', title: 'Reset', fn: () => mapRef.current?.zoomReset() },
              ].map(({ label, title, fn }) => (
                <button key={title} onClick={fn} title={title} style={{ width: 42, height: 42, borderRadius: 12, border: '1.5px solid #E7DDCF', background: '#fff', color: '#5A4A3C', fontFamily: F, fontWeight: 600, fontSize: 22, lineHeight: 1, cursor: 'pointer', boxShadow: '0 6px 16px -8px rgba(80,50,20,.5)' }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* ── HOME overlay ─────────────────────────────────────────────── */}
          {state.screen === 'home' && (
            <div className="atlas-panel-overlay qz-ov" style={{ ...OVERLAY }}>
              <div style={{ width: 'min(880px,100%)', textAlign: 'center' }}>
                <h1 style={{ fontFamily: F, fontWeight: 700, fontSize: 'clamp(28px,5.5vw,42px)', margin: '0 0 6px', color: '#2B2620', lineHeight: 1.1 }}>Atlas Arcade</h1>
                <p style={{ margin: '0 0 26px', fontSize: 15, fontWeight: 600, color: '#9C8A78' }}>Pick a map collection to practice.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
                  {[
                    { label: 'World Mapping', sub: '6 continents · 169 countries', tag: 'FIND IT · NAME IT', grad: 'linear-gradient(180deg,#2FA37A,#2C9AD6)', action: arcade.pickWorld },
                    { label: 'India Mapping', sub: 'Rivers · National Parks', tag: null, grad: 'linear-gradient(180deg,#E8920E,#2C6FBF)', action: arcade.pickIndia },
                  ].map(item => (
                    <button key={item.label} onClick={item.action} style={{ ...GRID_BTN }} onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)' }} onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}>
                      <div style={{ width: 8, background: item.grad, flex: 'none' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '20px 22px', flex: 1 }}>
                        <span style={{ fontFamily: F, fontWeight: 600, fontSize: 22, color: '#2B2620' }}>{item.label}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#8A7563' }}>{item.sub}</span>
                        {item.tag && <span style={{ display: 'inline-flex', alignSelf: 'flex-start', background: '#F0F8F3', color: '#2FA37A', border: '1.5px solid #C8E8D7', borderRadius: 8, padding: '3px 10px', fontSize: 11.5, fontWeight: 800, letterSpacing: '.6px', marginTop: 6 }}>{item.tag}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── WORLD MENU overlay ───────────────────────────────────────── */}
          {state.screen === 'worldMenu' && (
            <div className="atlas-panel-overlay qz-ov" style={{ ...OVERLAY, padding: 20 }}>
              <div style={{ width: 'min(820px,100%)', textAlign: 'center' }}>
                <button onClick={arcade.goHome} style={{ border: 'none', background: 'transparent', color: '#B79A82', fontFamily: F, fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 6 }}>← Home</button>
                <h2 style={{ fontFamily: F, fontWeight: 700, fontSize: 'clamp(24px,5vw,34px)', margin: '0 0 4px', color: '#2B2620' }}>Choose a continent</h2>
                <p style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 600, color: '#B79A82' }}>Pick a region to drill — the map will zoom right in.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                  {CONT_ORDER.map(cont => (
                    <button key={cont} onClick={() => arcade.pickContinent(cont)}
                      onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)' }}
                      onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', background: '#fff', border: '1.5px solid #F0E4D6', borderRadius: 16, padding: '16px 18px', cursor: 'pointer', boxShadow: '0 8px 22px -12px rgba(80,50,20,.4)', transition: 'transform .15s' }}
                    >
                      <span style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, background: CONT_COLOR[cont] }} />
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
                        <span style={{ fontFamily: F, fontWeight: 600, fontSize: 19, color: '#2B2620' }}>{cont}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#B79A82' }}>{CONT_DATA[cont]?.length ?? 0} countries</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── INDIA MENU overlay ───────────────────────────────────────── */}
          {state.screen === 'indiaMenu' && (
            <div className="atlas-panel-overlay qz-ov" style={{ ...OVERLAY, padding: 20 }}>
              <div style={{ width: 'min(720px,100%)', textAlign: 'center' }}>
                <button onClick={arcade.goHome} style={{ border: 'none', background: 'transparent', color: '#B79A82', fontFamily: F, fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 6 }}>← Home</button>
                <h2 style={{ fontFamily: F, fontWeight: 700, fontSize: 'clamp(24px,5vw,34px)', margin: '0 0 4px', color: '#2B2620' }}>India Mapping</h2>
                <p style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 600, color: '#B79A82' }}>Pick a topic to practice.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                  {[
                    { label: 'River Systems', sub: 'Ganga and tributaries', color: '#2C6FBF', action: arcade.pickRivers },
                    { label: 'National Parks', sub: `${allParks.length || 110} parks across India`, color: '#2FA37A', action: arcade.pickParks },
                  ].map(item => (
                    <button key={item.label} onClick={item.action}
                      onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)' }}
                      onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', background: '#fff', border: '1.5px solid #F0E4D6', borderRadius: 16, padding: '20px 18px', cursor: 'pointer', boxShadow: '0 8px 22px -12px rgba(80,50,20,.4)', transition: 'transform .15s' }}
                    >
                      <span style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, background: item.color }} />
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
                        <span style={{ fontFamily: F, fontWeight: 600, fontSize: 19, color: '#2B2620' }}>{item.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#B79A82' }}>{item.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── RIVER SYSTEMS overlay ────────────────────────────────────── */}
          {state.screen === 'riverSystems' && (
            <div className="atlas-panel-overlay qz-ov" style={{ ...OVERLAY, padding: 20, alignItems: 'stretch' }}>
              <div style={{ width: 'min(900px,100%)', textAlign: 'center', margin: 'auto 0', padding: '8px 0' }}>
                <button onClick={() => arcade.goScreen('indiaMenu')} style={{ border: 'none', background: 'transparent', color: '#B79A82', fontFamily: F, fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 6 }}>← India topics</button>
                <h2 style={{ fontFamily: F, fontWeight: 700, fontSize: 'clamp(24px,5vw,34px)', margin: '0 0 4px', color: '#2B2620' }}>River systems</h2>
                <p style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 600, color: '#B79A82' }}>Practice one system at a time — the map zooms to its region.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12, paddingBottom: 10 }}>
                  {RIVER_SYSTEMS.map(sys => (
                    <button key={sys.key} onClick={() => arcade.pickRiverSystem(sys.key)}
                      onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)' }}
                      onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', background: '#fff', border: '1.5px solid #F0E4D6', borderRadius: 16, padding: '18px 18px', cursor: 'pointer', boxShadow: '0 8px 22px -12px rgba(80,50,20,.4)', transition: 'transform .15s' }}
                    >
                      <span style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, background: sys.color }} />
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                        <span style={{ fontFamily: F, fontWeight: 600, fontSize: 19, color: '#2B2620' }}>{sys.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#9C8A78' }}>{sys.blurb}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PARK REGIONS overlay ─────────────────────────────────────── */}
          {state.screen === 'parkRegions' && (
            <div className="atlas-panel-overlay qz-ov" style={{ ...OVERLAY, padding: 20, alignItems: 'stretch' }}>
              <div style={{ width: 'min(940px,100%)', textAlign: 'center', margin: 'auto 0', padding: '8px 0' }}>
                <button onClick={() => arcade.goScreen('indiaMenu')} style={{ border: 'none', background: 'transparent', color: '#B79A82', fontFamily: F, fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 6 }}>← India topics</button>
                <h2 style={{ fontFamily: F, fontWeight: 700, fontSize: 'clamp(24px,5vw,34px)', margin: '0 0 4px', color: '#2B2620' }}>National Parks</h2>
                <p style={{ margin: '8px 0 14px', fontSize: 15, fontWeight: 600, color: '#B79A82' }}>Learn park locations first, then practice by broad UPSC regions.</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                  <button onClick={() => arcade.pickParkRegion(null)} style={{ border: '2px solid #B9DCC8', background: '#F0FAF4', color: '#15784E', fontFamily: F, fontWeight: 600, fontSize: 15, padding: '11px 18px', borderRadius: 13, cursor: 'pointer' }}>Practice all</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10, paddingBottom: 8 }}>
                  {parkRegionData.map(reg => (
                    <div key={reg.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left', background: '#fff', border: '1.5px solid #F0E4D6', borderRadius: 16, padding: '16px 18px', boxShadow: '0 8px 22px -12px rgba(80,50,20,.4)' }}>
                      <span style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, background: reg.color, marginTop: 3 }} />
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2, flex: 1, minWidth: 0 }}>
                        <span style={{ fontFamily: F, fontWeight: 600, fontSize: 17, color: '#2B2620' }}>{reg.name}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#9C8A78' }}>{reg.blurb}</span>
                        <span style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
                          <button onClick={() => arcade.pickParkLearn(reg.key)} style={{ border: '2px solid #B9DCC8', background: '#F0FAF4', color: '#15784E', fontFamily: F, fontWeight: 700, fontSize: 13, padding: '8px 14px', borderRadius: 11, cursor: 'pointer' }}>Learn</button>
                          <button onClick={() => arcade.pickParkRegion(reg.key)} style={{ border: '2px solid #E7DDCF', background: '#fff', color: '#5A4A3C', fontFamily: F, fontWeight: 700, fontSize: 13, padding: '8px 14px', borderRadius: 11, cursor: 'pointer' }}>Practice</button>
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PARK LEARN strip ─────────────────────────────────────────── */}
          {state.screen === 'parkLearn' && (
            <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 6, pointerEvents: 'none' }}>
              <div className="park-learn-strip" style={{ width: 'min(1040px,100%)', margin: '0 auto', background: 'rgba(255,255,255,.92)', border: '1.5px solid #DCEBDE', borderRadius: 17, boxShadow: '0 18px 38px -24px rgba(20,70,45,.55)', padding: '9px 10px', pointerEvents: 'auto', backdropFilter: 'blur(7px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <button onClick={() => arcade.goScreen('parkRegions')} title="Park regions" style={{ width: 34, height: 34, border: '1.5px solid #D7EBD7', background: '#fff', color: '#15784E', borderRadius: 11, fontFamily: F, fontWeight: 700, fontSize: 18, cursor: 'pointer', flexShrink: 0 }}>←</button>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.08, minWidth: 138, maxWidth: 245, flexShrink: 0 }}>
                    <span style={{ fontFamily: F, fontWeight: 700, fontSize: 17, color: '#203A2B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                      {parkRegionData.find(r => r.key === state.parkRegion)?.name ?? 'National Parks'}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#6E8874', whiteSpace: 'nowrap' }}>
                      {visibleParks().length} parks{state.parkLearnState ? ` in ${state.parkLearnState}` : ''}
                    </span>
                  </span>
                  {/* State filter tabs */}
                  <div className="qz-ov" style={{ display: 'flex', gap: 7, overflowX: 'auto', overflowY: 'hidden', flex: 1, minWidth: 150, padding: '2px 2px 4px' }}>
                    {['All', ...(parkRegionData.find(r => r.key === state.parkRegion)?.states ?? [])].map(s => (
                      <button key={s} onClick={() => arcade.setParkLearnState(s === 'All' ? null : s)}
                        style={{ border: '1.5px solid', borderColor: (s === 'All' ? !state.parkLearnState : state.parkLearnState === s) ? '#B9DCC8' : '#E7DDCF', background: (s === 'All' ? !state.parkLearnState : state.parkLearnState === s) ? '#F0FAF4' : '#fff', color: (s === 'All' ? !state.parkLearnState : state.parkLearnState === s) ? '#15784E' : '#5A4A3C', fontFamily: F, fontWeight: 700, fontSize: 12, padding: '6px 12px', borderRadius: 9, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >{s}</button>
                    ))}
                  </div>
                  <button onClick={() => { arcade.pickParkRegion(state.parkRegion); startPlay() }} style={{ border: '2px solid #B9DCC8', background: '#F0FAF4', color: '#15784E', fontFamily: F, fontWeight: 700, fontSize: 13, padding: '8px 12px', borderRadius: 11, cursor: 'pointer', flexShrink: 0 }}>Practice region</button>
                </div>
              </div>
            </div>
          )}

          {/* ── SETUP overlay ────────────────────────────────────────────── */}
          {state.screen === 'setup' && (
            <div className="atlas-panel-overlay qz-ov" style={{ ...OVERLAY, padding: 16 }}>
              <div style={{ ...CARD, width: 'min(560px,100%)', padding: 'clamp(20px,4vw,30px) clamp(20px,4vw,32px)' }}>
                <button onClick={arcade.menu} style={{ border: 'none', background: 'transparent', color: '#B79A82', fontFamily: F, fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 10 }}>← Back</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 22, flexWrap: 'wrap' }}>
                  {state.continent && <span style={{ width: 18, height: 18, borderRadius: '50%', background: CONT_COLOR[state.continent] ?? ACCENT }} />}
                  <h2 style={{ fontFamily: F, fontWeight: 700, fontSize: 'clamp(22px,5vw,30px)', margin: 0, color: '#2B2620' }}>
                    {state.continent ?? (state.riverSystem ? RIVER_SYSTEMS.find(s => s.key === state.riverSystem)?.name : 'National Parks')}
                  </h2>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#B79A82' }}>{poolSize} items</span>
                </div>

                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#C7A98F' }}>How many to practice?</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginBottom: 24 }}>
                  {countOptions.map(opt => {
                    const n = opt === 'All' ? poolSize : Number(opt)
                    const active = state.setupCount === n
                    return (
                      <button key={String(opt)} onClick={() => arcade.setSetupCount(n)}
                        style={{ fontFamily: F, fontWeight: 700, fontSize: 15, padding: '10px 20px', borderRadius: 13, cursor: 'pointer', border: active ? `2px solid ${ACCENT}` : '1.5px solid #E7DDCF', background: active ? '#FFF0E8' : '#fff', color: active ? '#C84A00' : '#5A4A3C', transition: 'all .12s' }}
                      >{opt}</button>
                    )
                  })}
                </div>

                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#C7A98F' }}>Quiz style</p>
                <div style={{ display: 'flex', gap: 11, marginBottom: 28, flexWrap: 'wrap' }}>
                  {(['locate','name'] as const).map(m => {
                    const active = state.playMode === m
                    return (
                      <button key={m} onClick={() => arcade.setPlayMode(m)}
                        style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px', padding: '14px 16px', borderRadius: 16, cursor: 'pointer', border: active ? `2px solid ${ACCENT}` : '1.5px solid #E7DDCF', background: active ? '#FFF0E8' : '#fff', color: '#2B2620', textAlign: 'left', transition: 'all .12s' }}
                      >
                        <span style={{ fontFamily: F, fontWeight: 600, fontSize: 16 }}>{m === 'locate' ? 'Find it' : 'Name it'}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#9C8A78' }}>{m === 'locate' ? 'Tap the correct place on the map' : 'Pick from 3 options'}</span>
                      </button>
                    )
                  })}
                </div>

                <button onClick={startPlay}
                  style={{ width: '100%', border: 'none', color: '#fff', fontFamily: F, fontWeight: 600, fontSize: 19, padding: 15, borderRadius: 15, cursor: 'pointer', background: ACCENT, boxShadow: '0 12px 26px -10px rgba(255,122,77,.8)' }}
                  onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.06)' }}
                  onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.filter = '' }}
                >Start quiz →</button>
              </div>
            </div>
          )}

          {/* ── RESULTS overlay ──────────────────────────────────────────── */}
          {state.screen === 'results' && (
            <div className="atlas-panel-overlay qz-ov" style={{ ...OVERLAY, padding: 16 }}>
              <div style={{ ...CARD, width: 'min(600px,100%)', padding: 'clamp(20px,4vw,30px) clamp(20px,4vw,34px)' }}>
                <h2 style={{ fontFamily: F, fontWeight: 700, fontSize: 'clamp(24px,5.5vw,32px)', margin: '0 0 4px', color: '#2B2620' }}>
                  {state.correctCount === qTotal ? '🎉 Perfect!' : state.correctCount >= qTotal * 0.8 ? '⭐ Great job!' : 'Keep practising!'}
                </h2>
                <p style={{ margin: '0 0 22px', fontSize: 15, fontWeight: 600, color: '#B79A82' }}>
                  {state.continent ?? (RIVER_SYSTEMS.find(s => s.key === state.riverSystem)?.name ?? 'National Parks')} · {state.playMode === 'locate' ? 'Find it' : 'Name it'}
                </p>

                <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Correct', val: `${state.correctCount}/${qTotal}`, bg: '#F4FAF6', border: '#D6EEE0', lc: '#7CB79A', vc: '#15784E' },
                    { label: 'Accuracy', val: `${accuracy}%`, bg: '#F6F4FE', border: '#DCD3F7', lc: '#9B8CD8', vc: '#5B45D6' },
                    { label: 'Score', val: String(state.score), bg: '#FFF8EC', border: '#FBE6C2', lc: '#E0A94B', vc: '#E8920E' },
                  ].map(({ label, val, bg, border, lc, vc }) => (
                    <div key={label} style={{ flex: '1 1 130px', background: bg, border: `1.5px solid ${border}`, borderRadius: 16, padding: 16, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: lc }}>{label}</div>
                      <div style={{ fontFamily: F, fontWeight: 700, fontSize: 30, color: vc }}>{val}</div>
                    </div>
                  ))}
                </div>

                {state.wrongList.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#C7A98F' }}>Review ({state.wrongList.length})</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {state.wrongList.map(m => (
                        <span key={String(m.id)} style={{ background: '#FFECEC', color: '#C13238', border: '1.5px solid #FFC9CB', borderRadius: 10, padding: '6px 12px', fontWeight: 700, fontSize: 14 }}>{m.name}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {state.wrongList.length > 0 && (
                    <button onClick={arcade.practiceWrong}
                      style={{ width: '100%', border: 'none', color: '#fff', fontFamily: F, fontWeight: 600, fontSize: 18, padding: 15, borderRadius: 15, cursor: 'pointer', background: ACCENT, boxShadow: '0 12px 26px -10px rgba(255,122,77,.8)' }}>
                      Practice the {state.wrongList.length} I missed →
                    </button>
                  )}
                  <div style={{ display: 'flex', gap: 11, flexWrap: 'wrap' }}>
                    <button onClick={arcade.restart} style={{ ...btn(), flex: '1 1 180px' }}>Play again</button>
                    <button onClick={arcade.menu} style={{ ...btn(), flex: '1 1 180px' }}>Choose topic</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* ─── End map area ────────────────────────────────────────────────── */}

        {/* ─── Play bottom bar ─────────────────────────────────────────────── */}
        {state.screen === 'play' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: 'clamp(10px,3vw,16px) clamp(12px,4vw,26px)', borderTop: '1px solid #F5ECE0', background: '#FFFDFA' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
              <button onClick={arcade.menu} style={{ ...btn(), display: 'flex', alignItems: 'center', gap: 7 }}>← Quit</button>
              {state.playMode === 'name' && (
                <button onClick={arcade.hint}
                  disabled={state.hintsLeft <= 0 || state.hintUsedThisRound}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, border: '1.5px solid #FBE0C4', background: '#FFF6EC', color: '#D9760B', fontFamily: F, fontWeight: 600, fontSize: 15, padding: '11px 18px', borderRadius: 13, cursor: state.hintsLeft > 0 && !state.hintUsedThisRound ? 'pointer' : 'not-allowed', opacity: state.hintsLeft <= 0 || state.hintUsedThisRound ? 0.5 : 1 }}>
                  <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: '50%', background: '#FFD89B', color: '#A85F08', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>?</span>
                  Hint
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#C99A5B', background: '#FCEBD4', borderRadius: 8, padding: '2px 8px' }}>{state.hintsLeft} left</span>
                </button>
              )}
            </div>
            {/* Progress dots */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 480 }}>
              {state.answerHistory.map((correct, i) => (
                <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: correct ? '#22A36A' : '#FF5A5F', display: 'inline-block' }} />
              ))}
              {state.qIndex >= state.answerHistory.length && (
                <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #C7A98F', display: 'inline-block', animation: 'qzpulse 1.1s ease-in-out infinite' }} />
              )}
              {state.queue.slice(state.answerHistory.length + (state.qIndex >= state.answerHistory.length ? 1 : 0)).map((_, i) => (
                <span key={`future-${i}`} style={{ width: 10, height: 10, borderRadius: '50%', background: '#E3DDD1', display: 'inline-block' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={arcade.previousQuestion} disabled={state.qIndex === 0}
                style={{ ...btn(), opacity: state.qIndex === 0 ? 0.4 : 1, cursor: state.qIndex === 0 ? 'not-allowed' : 'pointer' }}>← Previous</button>
              {state.answeredThisRound
                ? <button onClick={arcade.nextQuestion} style={{ border: 'none', color: '#fff', fontFamily: F, fontWeight: 600, fontSize: 15, padding: '11px 22px', borderRadius: 13, cursor: 'pointer', background: ACCENT }}>Next →</button>
                : <button onClick={arcade.skip} style={{ ...btn() }}>Skip</button>
              }
            </div>
          </div>
        )}
      </div>

      <p style={{ maxWidth: 1180, width: '100%', margin: '16px 2px 0', fontSize: 13.5, fontWeight: 600, color: '#B79A82', lineHeight: 1.5 }}>
        Tip: build streaks of 3+ to unlock combo multipliers. Tap the globe to return home anytime.
      </p>
    </div>
  )
}
