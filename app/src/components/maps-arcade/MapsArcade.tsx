import { useEffect, useRef, useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import * as topojson from 'topojson-client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faLocationDot, faWater, faTree, faFlag, faRotateRight } from '@fortawesome/free-solid-svg-icons'
import type { Topology } from 'topojson-specification'
import { useAppStore } from '@/stores/useAppStore'
import { gsap, reducedMotion, EASE } from '@/anim/animations'
import { asset } from '@/utils/asset'
import { useMapQuiz } from './useMapQuiz'
import { MapSVG, type FeatureKind } from './MapSVG'
import type { QuizQuestion, QuizMode } from '@/types/quiz'

type CollectionId = 'world' | 'rivers' | 'parks'

interface LoadedCollection {
  kind: FeatureKind
  data: object
  backdrop?: object | null
  fitTo?: object | null
  questions: QuizQuestion[]
}

const COLLECTIONS: {
  id: CollectionId
  mode: QuizMode
  title: string
  desc: string
  emoji: string
  chips: { icon: typeof faFlag; label: string }[]
  glow: string
}[] = [
  {
    id: 'world', mode: 'world-countries',
    title: 'World Countries', desc: 'Find nations across six continents',
    emoji: '🌍',
    chips: [{ icon: faLocationDot, label: 'Find It' }, { icon: faFlag, label: '10 rounds' }],
    glow: 'var(--acc)',
  },
  {
    id: 'rivers', mode: 'india-rivers',
    title: 'India Rivers', desc: 'Trace the subcontinent’s great rivers',
    emoji: '🏞️',
    chips: [{ icon: faWater, label: 'Find It' }, { icon: faFlag, label: '10 rounds' }],
    glow: 'var(--teal)',
  },
  {
    id: 'parks', mode: 'india-national-parks',
    title: 'National Parks', desc: 'Pin India’s protected wilderness',
    emoji: '🌿',
    chips: [{ icon: faTree, label: 'Find It' }, { icon: faFlag, label: '10 rounds' }],
    glow: 'var(--good)',
  },
]

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Load + normalise a collection into interactive features & questions. */
async function loadCollection(id: CollectionId): Promise<LoadedCollection> {
  const world = await fetch(asset('data/countries-110m.json')).then(r => r.json()) as Topology
  const countries = (topojson.feature(world, world.objects.countries) as unknown as {
    features: { id?: string | number; properties?: { name?: string } }[]
  }).features.filter(f => String(f.id) !== '010')
  const india = countries.filter(f => String(f.id) === '356')

  if (id === 'world') {
    const feats = countries
    const questions = shuffle(feats.filter(f => f.properties?.name))
      .slice(0, 10)
      .map(f => ({ id: String(f.id), label: f.properties!.name!, targetFeatureId: String(f.id) }))
    return { kind: 'polygon', data: { type: 'FeatureCollection', features: feats }, questions }
  }

  if (id === 'rivers') {
    const gj = await fetch(asset('data/india-rivers-ne-10m.geojson')).then(r => r.json()) as {
      features: { id?: string; properties?: { name?: string; name_en?: string; featurecla?: string } }[]
    }
    const feats = gj.features
      .filter(f => (f.properties?.name_en || f.properties?.name) && /river/i.test(f.properties?.featurecla ?? ''))
      .map((f, i) => ({ ...f, id: `r${i}` }))
    // Group segments of the same river under one answer id
    const byName = new Map<string, string>()
    feats.forEach(f => {
      const nm = (f.properties!.name_en || f.properties!.name)!
      if (!byName.has(nm)) byName.set(nm, f.id!)
    })
    feats.forEach(f => { f.id = byName.get((f.properties!.name_en || f.properties!.name)!)! })
    const questions = shuffle([...byName.entries()])
      .slice(0, 10)
      .map(([nm, fid]) => ({ id: fid, label: nm, targetFeatureId: fid }))
    return {
      kind: 'line',
      data: { type: 'FeatureCollection', features: feats },
      backdrop: { type: 'FeatureCollection', features: india },
      fitTo: { type: 'FeatureCollection', features: india },
      questions,
    }
  }

  // parks
  const parksRaw = await fetch(asset('data/india-national-parks.json')).then(r => r.json()) as {
    parks: { id: number; name: string; state: string; lon: number; lat: number }[]
  }
  const feats = parksRaw.parks.map(p => ({
    type: 'Feature',
    id: String(p.id),
    properties: { name: p.name, state: p.state },
    geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
  }))
  const questions = shuffle(parksRaw.parks)
    .slice(0, 10)
    .map(p => ({ id: String(p.id), label: p.name, hint: p.state, targetFeatureId: String(p.id) }))
  return {
    kind: 'point',
    data: { type: 'FeatureCollection', features: feats },
    backdrop: { type: 'FeatureCollection', features: india },
    fitTo: { type: 'FeatureCollection', features: india },
    questions,
  }
}

/**
 * Maps Practice — fully native Penni screen. Home cards expand into a
 * full-bleed d3 drill (find the country / river / park on the map) with
 * GSAP-choreographed questions, feedback and results. No embedded app,
 * no foreign chrome: same header, nav, cards and motion as everything else.
 */
export function MapsArcade() {
  const setScreen = useAppStore((s) => s.setScreen)
  const { state, startQuiz, selectFeature, nextQuestion, reset } = useMapQuiz()
  const [collection, setCollection] = useState<CollectionId | null>(null)
  const [loaded, setLoaded] = useState<LoadedCollection | null>(null)
  const [loading, setLoading] = useState<CollectionId | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const originRect = useRef<DOMRect | null>(null)

  const active = COLLECTIONS.find(c => c.id === collection)
  const current = state.questions[state.currentIndex]

  // Home entrance choreography
  useEffect(() => {
    const el = rootRef.current
    if (!el || collection || reducedMotion()) return
    const tl = gsap.timeline({ defaults: { ease: EASE.out } })
    tl.fromTo(el.querySelector('.screen-header'), { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.4 })
      .fromTo(el.querySelector('.maps-subtitle'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4 }, '-=0.2')
      .fromTo(el.querySelectorAll('.mp-card'),
        { opacity: 0, y: 26, scale: 0.965 },
        { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: EASE.expo, stagger: 0.09, clearProps: 'transform' }, '-=0.2')
    return () => { tl.kill() }
  }, [collection])

  // Card → stage expansion
  useEffect(() => {
    const el = stageRef.current
    const from = originRect.current
    if (!collection || !el || reducedMotion() || !from) return
    const to = el.getBoundingClientRect()
    const tween = gsap.fromTo(el,
      {
        transformOrigin: 'top left',
        x: from.left - to.left, y: from.top - to.top,
        scaleX: from.width / to.width, scaleY: from.height / to.height,
        opacity: 0.85,
      },
      { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1, duration: 0.6, ease: EASE.expo, clearProps: 'transform' })
    return () => { tween.kill() }
  }, [collection])

  // Question pill swap + result feedback
  useEffect(() => {
    const el = pillRef.current
    if (!el || reducedMotion()) return
    if (state.phase === 'playing') {
      gsap.fromTo(el, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: EASE.out })
    } else if (state.phase === 'result') {
      if (state.isCorrect) gsap.fromTo(el, { scale: 0.96 }, { scale: 1, duration: 0.45, ease: EASE.micro, clearProps: 'scale' })
      else gsap.fromTo(el, { x: -6 }, { x: 0, duration: 0.4, ease: 'elastic.out(1,0.35)', clearProps: 'x' })
    }
  }, [state.phase, state.currentIndex, state.isCorrect])

  async function openCollection(id: CollectionId, cardEl: HTMLElement) {
    if (loading) return
    setLoading(id)
    try {
      const lc = await loadCollection(id)
      originRect.current = cardEl.getBoundingClientRect()
      setLoaded(lc)
      setCollection(id)
      const meta = COLLECTIONS.find(c => c.id === id)!
      startQuiz(meta.mode, lc.questions, meta.title)
    } finally {
      setLoading(null)
    }
  }

  const closeStage = useCallback(() => {
    reset()
    setCollection(null)
    setLoaded(null)
  }, [reset])

  async function retry() {
    if (!collection) return
    const lc = await loadCollection(collection)
    setLoaded(lc)
    startQuiz(COLLECTIONS.find(c => c.id === collection)!.mode, lc.questions, active?.title ?? '')
  }

  const pct = state.questions.length ? Math.round((state.score / state.questions.length) * 100) : 0

  return (
    <div ref={rootRef} className="screen active" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Standard app header */}
      <div className="screen-header">
        <button onClick={() => (collection ? closeStage() : setScreen('feed'))} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2>Maps Practice</h2>
        {collection && state.phase !== 'complete' && (
          <span className="mp-hud">
            <b>{Math.min(state.currentIndex + 1, state.questions.length)}</b>/{state.questions.length}
            <i>·</i>
            <b>{state.score}</b> pts
          </span>
        )}
      </div>

      {/* ── Home ── */}
      {!collection && (
        <>
          <p className="maps-subtitle">Master places, rivers and parks through quick map drills.</p>
          <div className="mp-body">
            <div className="mp-cards">
              {COLLECTIONS.map((c) => (
                <button
                  key={c.id}
                  className="mp-card"
                  style={{ '--glow': c.glow } as CSSProperties}
                  onClick={(e) => openCollection(c.id, e.currentTarget)}
                  disabled={loading !== null}
                >
                  <div className="mp-card-top">
                    <span className="mp-emoji">{c.emoji}</span>
                  </div>
                  <h3>{c.title}</h3>
                  <p>{c.desc}</p>
                  <div className="mp-modes">
                    {c.chips.map((m) => (
                      <span key={m.label}><FontAwesomeIcon icon={m.icon} /> {m.label}</span>
                    ))}
                  </div>
                  <span className="mp-cta">{loading === c.id ? 'Loading…' : 'Start drilling →'}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Drill stage ── */}
      {collection && loaded && (
        <div ref={stageRef} className="mp-stage">
          {state.phase !== 'complete' && current && (
            <div ref={pillRef} className={`mp-pill ${state.phase === 'result' ? (state.isCorrect ? 'ok' : 'no') : ''}`}>
              <em>{state.phase === 'result' ? (state.isCorrect ? 'Correct!' : `That was wrong — it’s highlighted`) : 'Find on the map'}</em>
              <strong>{current.label}</strong>
              {current.hint && <span>{current.hint}</span>}
            </div>
          )}

          <div className="mp-map">
            <MapSVG
              geoData={loaded.data as never}
              backdrop={loaded.backdrop as never}
              fitTo={loaded.fitTo as never}
              kind={loaded.kind}
              quizState={state}
              onFeatureClick={selectFeature}
            />
          </div>

          {state.phase === 'result' && (
            <button className="pn-btn mp-next" onClick={nextQuestion}>
              {state.currentIndex + 1 >= state.questions.length ? 'See results' : 'Next place'}
            </button>
          )}

          {state.phase === 'complete' && (
            <div className="mp-done">
              <div className="qz-ring" style={{ '--p': pct } as CSSProperties}>
                <div className="qz-ring-inner">
                  <b>{pct}<i>%</i></b>
                  <span>{state.score} / {state.questions.length}</span>
                </div>
              </div>
              <h3 className="qz-result-title">
                {pct >= 80 ? 'Cartographer! 🗺️' : pct >= 50 ? 'Getting there 🧭' : 'Keep exploring 🌱'}
              </h3>
              <div className="qz-result-actions">
                <button className="pn-btn" onClick={retry}>
                  <FontAwesomeIcon icon={faRotateRight} style={{ marginRight: 8 }} />
                  Play again
                </button>
                <button className="pn-btn ghost" onClick={closeStage}>All collections</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
