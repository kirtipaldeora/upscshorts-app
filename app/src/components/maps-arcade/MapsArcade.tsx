import { useState, useEffect } from 'react'
import * as topojson from 'topojson-client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faEarthAsia, faMap, faMountain, faTree, faCity } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useMapQuiz } from './useMapQuiz'
import { MapSVG } from './MapSVG'
import type { QuizMode, QuizQuestion } from '@/types/quiz'
import type { Topology } from 'topojson-specification'
import { asset } from '@/utils/asset'

// Quiz mode definitions
const MODES: { mode: QuizMode; icon: typeof faMap; label: string; description: string; dataFile: string; topologyKey?: string }[] = [
  { mode: 'world-countries', icon: faEarthAsia, label: 'World Countries', description: 'Identify countries on a world map', dataFile: asset('data/countries-110m.json'), topologyKey: 'countries' },
  { mode: 'india-states', icon: faMap, label: 'India States', description: 'Identify states & UTs of India', dataFile: asset('data/india-states.json') },
  { mode: 'india-rivers', icon: faCity, label: 'India Rivers', description: 'Locate rivers across India', dataFile: asset('data/india-rivers-ne-10m.geojson') },
  { mode: 'india-national-parks', icon: faTree, label: 'National Parks', description: 'Find national parks on the map', dataFile: asset('data/india-national-parks.json') },
]

export function MapsArcade() {
  const { setOverlay } = useAppStore()
  const { state, startQuiz, selectFeature, nextQuestion, reset } = useMapQuiz()
  const [geoData, setGeoData] = useState<Record<string, unknown> | null>(null)
  const [loadingMode, setLoadingMode] = useState<QuizMode | null>(null)

  async function handleModeSelect(modeConfig: typeof MODES[number]) {
    setLoadingMode(modeConfig.mode)
    try {
      const res = await fetch(modeConfig.dataFile)
      const data = await res.json()

      let features: Record<string, unknown>
      let questions: QuizQuestion[] = []

      // Convert TopoJSON to GeoJSON if needed
      if (data.type === 'Topology' && modeConfig.topologyKey) {
        const topo = data as Topology
        const geo = topojson.feature(topo, topo.objects[modeConfig.topologyKey]) as unknown as { features: { id?: string; properties?: { name?: string } }[] }
        geo.features.forEach((f, i) => {
          f.id = String(f.id ?? i)
        })
        features = geo as unknown as Record<string, unknown>
        questions = geo.features
          .filter((f) => f.properties?.name)
          .map((f) => ({
            id: f.id!,
            label: f.properties?.name ?? f.id!,
            targetFeatureId: f.id!,
          }))
          .sort(() => Math.random() - 0.5)
          .slice(0, 20)
      } else {
        const geo = data as { features: { id?: string; properties?: { name?: string; NAME?: string; NAME_1?: string; ST_NM?: string } }[] }
        geo.features.forEach((f, i) => {
          f.id = String(f.id ?? i)
        })
        features = geo as unknown as Record<string, unknown>
        questions = geo.features
          .filter((f) => f.properties?.name || f.properties?.NAME || f.properties?.NAME_1 || f.properties?.ST_NM)
          .map((f) => {
            const label = f.properties?.name ?? f.properties?.NAME ?? f.properties?.NAME_1 ?? f.properties?.ST_NM ?? f.id!
            return {
              id: f.id!,
              label: label,
              targetFeatureId: f.id!,
            }
          })
          .sort(() => Math.random() - 0.5)
          .slice(0, 15)
      }

      setGeoData(features)
      startQuiz(modeConfig.mode, questions, modeConfig.label)
    } catch {
      console.error('Failed to load map data')
    } finally {
      setLoadingMode(null)
    }
  }

  function handleClose() {
    reset()
    setGeoData(null)
    setOverlay(null)
  }

  const current = state.questions[state.currentIndex]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        paddingTop: 'env(safe-area-inset-top)',
        zIndex: 300,
        background: 'linear-gradient(180deg, var(--bg1), var(--bg3))',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div className="ma-header">
        <button onClick={handleClose} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2>
          Maps <span>Arcade</span>
        </h2>
        {state.phase === 'playing' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--on2)' }}>
              Q {state.currentIndex + 1}/{state.questions.length}
            </span>
            <span style={{ padding: '6px 12px', borderRadius: 12, background: 'var(--yellow)', color: 'var(--yellow-ink)', fontSize: 13, fontWeight: 900 }}>
              {state.score}
            </span>
          </div>
        )}
      </div>

      {/* Home: Mode selection */}
      {state.phase === 'idle' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 40px' }}>
          <p style={{ fontSize: 12, color: 'var(--on2)', fontWeight: 700, textAlign: 'center', marginBottom: 20 }}>
            Choose a quiz mode to start
          </p>
          {MODES.map((m) => (
            <button
              key={m.mode}
              onClick={() => handleModeSelect(m)}
              disabled={loadingMode !== null}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                width: '100%',
                background: 'var(--panel)',
                border: '1px solid var(--panel-border)',
                backdropFilter: 'blur(16px)',
                borderRadius: 24,
                padding: 16,
                marginBottom: 11,
                cursor: loadingMode ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: loadingMode === m.mode ? 0.7 : 1,
              }}
            >
              <div style={{ width: 50, height: 50, borderRadius: 18, background: 'rgba(255,255,255,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4CAF82', fontSize: 20, flexShrink: 0 }}>
                {loadingMode === m.mode
                  ? <i className="fas fa-circle-notch" style={{ animation: 'spin 1s linear infinite', color: 'var(--acc)', fontSize: 20 }} />
                  : <FontAwesomeIcon icon={m.icon} />}
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <h3 style={{ fontSize: 15.5, fontWeight: 800, marginBottom: 2, color: 'var(--on)' }}>{m.label}</h3>
                <p style={{ fontSize: 11.5, color: 'var(--on2)', lineHeight: 1.45, fontWeight: 600 }}>{m.description}</p>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 13, background: 'var(--yellow)', color: 'var(--yellow-ink)', fontSize: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                →
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Playing + Result */}
      {(state.phase === 'playing' || state.phase === 'result') && geoData && (
        <>
          {/* Question prompt */}
          {current && (
            <div style={{ padding: '0 16px 10px', flexShrink: 0, zIndex: 2 }}>
              <div style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)', backdropFilter: 'blur(16px)', borderRadius: 20, padding: '12px 18px', textAlign: 'center' }}>
                {state.phase === 'playing' ? (
                  <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--on)' }}>
                    Find: <span style={{ color: 'var(--yellow)' }}>{current.label}</span>
                  </p>
                ) : (
                  <p style={{ fontSize: 15, fontWeight: 800, color: state.isCorrect ? 'var(--good)' : 'var(--bad)' }}>
                    {state.isCorrect ? '✓ Correct!' : `✗ That was ${current.label}`}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Map */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative', padding: '0 8px' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: 22, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
              <MapSVG
                geoData={geoData as never}
                quizState={state}
                onFeatureClick={selectFeature}
              />
            </div>
          </div>

          {/* Result next button */}
          {state.phase === 'result' && (
            <div style={{ padding: '12px 16px', paddingBottom: 'max(20px, calc(20px + env(safe-area-inset-bottom)))', flexShrink: 0, zIndex: 2 }}>
              <button
                onClick={nextQuestion}
                style={{ width: '100%', padding: 16, borderRadius: 22, background: 'var(--yellow)', color: 'var(--yellow-ink)', fontSize: 15, fontWeight: 900, border: 'none', cursor: 'pointer' }}
              >
                Next Question →
              </button>
            </div>
          )}
        </>
      )}

      {/* Complete screen */}
      {state.phase === 'complete' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
          <div style={{ fontSize: 64 }}>🎉</div>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: 'var(--on)', textAlign: 'center' }}>Quiz Complete!</h2>
          <p style={{ fontSize: 18, color: 'var(--on2)', fontWeight: 700 }}>
            Score: <span style={{ color: 'var(--yellow)', fontWeight: 900 }}>{state.score} / {state.questions.length}</span>
          </p>
          <button onClick={reset} style={{ padding: '16px 40px', borderRadius: 24, background: 'var(--yellow)', color: 'var(--yellow-ink)', fontSize: 15, fontWeight: 900, border: 'none', cursor: 'pointer', marginTop: 8 }}>
            Play Again
          </button>
          <button onClick={handleClose} style={{ padding: '14px 40px', borderRadius: 24, background: 'var(--panel)', border: '1px solid var(--panel-border)', backdropFilter: 'blur(16px)', color: 'var(--on)', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
            Back to Home
          </button>
        </div>
      )}
    </div>
  )
}
