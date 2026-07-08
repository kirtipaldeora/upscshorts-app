import { useEffect, useRef, useState, useMemo } from 'react'
import Globe from 'globe.gl'
import type { GlobeInstance } from 'globe.gl'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faChevronLeft, faChevronRight, faLocationDot } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useAllArticles } from '@/hooks/useAllArticles'
import { asset } from '@/utils/asset'
import { CATEGORY_COLORS } from '@/constants/categories'
import type { Article } from '@/types/article'

interface Story extends Article {
  lat: number
  lon: number
  place: string
}

/**
 * 3D vector news globe (globe.gl / three.js) — a dark dotted-continent globe
 * that flies to each geolocated story, Ground-News style. Rendered as vectors
 * (no satellite texture) so it stays fast; the whole component is lazy-loaded.
 */
export default function NewsGlobe() {
  const { articlesByDate, setActiveArticle, setOverlay } = useAppStore()
  useAllArticles()
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeInstance | null>(null)
  const [idx, setIdx] = useState(0)
  const [ready, setReady] = useState(false)

  const stories = useMemo<Story[]>(() => {
    return Object.values(articlesByDate)
      .flat()
      .filter((a) => a.location)
      .map((a) => ({ ...a, lat: a.location!.lat, lon: a.location!.lon, place: a.location!.place }))
      .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : a.headline.localeCompare(b.headline)))
  }, [articlesByDate])

  // Initialise the globe once
  useEffect(() => {
    const el = containerRef.current
    if (!el || globeRef.current) return
    let world: GlobeInstance | null = null
    let disposed = false

    fetch(asset('data/countries-110m.json'))
      .then((r) => r.json())
      .then((topo: Topology) => {
        if (disposed || !containerRef.current) return
        const countries = feature(topo, topo.objects.countries) as unknown as { features: object[] }
        world = new Globe(containerRef.current)
        world
          .backgroundColor('rgba(0,0,0,0)')
          .showAtmosphere(true)
          .atmosphereColor('#79a7ff')
          .atmosphereAltitude(0.2)
          .polygonsData(countries.features)
          .polygonCapColor(() => '#45a673')
          .polygonSideColor(() => 'rgba(24,70,52,0.55)')
          .polygonStrokeColor(() => 'rgba(221,255,238,0.38)')
          .polygonAltitude(0.01)
          .width(containerRef.current.clientWidth)
          .height(containerRef.current.clientHeight)

        // Clean ocean-blue globe surface (no satellite texture, renders fast).
        const mat = world.globeMaterial() as unknown as { color: { set: (c: string) => void }; emissive?: { set: (c: string) => void }; shininess?: number }
        mat.color.set('#0e2f5a')
        mat.emissive?.set('#08203f')
        if ('shininess' in mat) mat.shininess = 8

        const ctrls = world.controls() as { autoRotate: boolean; autoRotateSpeed: number; enableZoom: boolean; minDistance: number; maxDistance: number }
        ctrls.autoRotate = true
        ctrls.autoRotateSpeed = 0.5
        ctrls.enableZoom = true

        globeRef.current = world
        setReady(true)
      })
      .catch(() => {})

    return () => {
      disposed = true
      const w = globeRef.current as (GlobeInstance & { _destructor?: () => void }) | null
      try { w?._destructor?.() } catch { /* noop */ }
      globeRef.current = null
    }
  }, [])

  // Markers + active ripple ring
  useEffect(() => {
    const w = globeRef.current
    if (!w || !ready || !stories.length) return
    const activeId = stories[idx]?.id
    w.pointsData(stories as unknown as object[])
      .pointLat((d) => (d as Story).lat)
      .pointLng((d) => (d as Story).lon)
      .pointColor((d) => CATEGORY_COLORS[(d as Story).category] ?? '#ffffff')
      .pointAltitude((d) => ((d as Story).id === activeId ? 0.09 : 0.015))
      .pointRadius((d) => ((d as Story).id === activeId ? 0.5 : 0.28))
      .pointsMerge(false)
      .onPointClick((d) => {
        const i = stories.findIndex((s) => s.id === (d as Story).id)
        if (i >= 0) setIdx(i)
      })

    const active = stories[idx]
    w.ringsData(active ? [active as unknown as object] : [])
      .ringLat((d) => (d as Story).lat)
      .ringLng((d) => (d as Story).lon)
      .ringColor(() => (t: number) => `rgba(157,162,242,${1 - t})`)
      .ringMaxRadius(5)
      .ringPropagationSpeed(2.2)
      .ringRepeatPeriod(850)
  }, [stories, idx, ready])

  // Fly to the current story
  useEffect(() => {
    const w = globeRef.current
    const s = stories[idx]
    if (!w || !ready || !s) return
    w.pointOfView({ lat: s.lat, lng: s.lon, altitude: 1.7 }, 1200)
    const ctrls = w.controls() as { autoRotate: boolean }
    ctrls.autoRotate = false
    const t = setTimeout(() => {
      const c = globeRef.current?.controls() as { autoRotate: boolean } | undefined
      if (c) c.autoRotate = true
    }, 4500)
    return () => clearTimeout(t)
  }, [idx, stories, ready])

  // Keep the canvas sized to its container
  useEffect(() => {
    function onResize() {
      const w = globeRef.current
      const el = containerRef.current
      if (w && el) { w.width(el.clientWidth); w.height(el.clientHeight) }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const cur = stories[idx]
  const go = (delta: number) => setIdx((i) => (i + delta + stories.length) % stories.length)
  const openStory = () => {
    if (!cur) return
    setActiveArticle(cur)
    setOverlay('deep-dive')
  }

  return (
    <div className="globe-screen">
      <div className="globe-header">
        <button onClick={() => setOverlay(null)} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2>News <span>Globe</span></h2>
      </div>

      <div ref={containerRef} className="globe-canvas" />

      {stories.length === 0 && (
        <div className="globe-empty">Spinning up the globe…</div>
      )}

      {cur && (
        <div className="globe-card">
          <div className="globe-card-nav">
            <button onClick={() => go(-1)} aria-label="Previous story"><FontAwesomeIcon icon={faChevronLeft} /></button>
            <span>{idx + 1} <i>of</i> {stories.length}</span>
            <button onClick={() => go(1)} aria-label="Next story"><FontAwesomeIcon icon={faChevronRight} /></button>
          </div>
          <button className="globe-card-body" onClick={openStory}>
            <div className="globe-card-place">
              <FontAwesomeIcon icon={faLocationDot} style={{ color: CATEGORY_COLORS[cur.category] }} />
              {cur.place}
            </div>
            <div className="globe-card-headline">{cur.headline}</div>
            <div className="globe-card-meta">
              <span className="tag tag-cat" style={{ color: CATEGORY_COLORS[cur.category], borderColor: CATEGORY_COLORS[cur.category] + '30', background: CATEGORY_COLORS[cur.category] + '14' }}>{cur.category}</span>
              <span className="tag tag-src">{cur.source}</span>
              <span className="globe-card-cta">Read →</span>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
