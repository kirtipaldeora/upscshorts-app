import { useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'globe.gl'
import type { GlobeInstance } from 'globe.gl'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight, faLocationDot } from '@fortawesome/free-solid-svg-icons'
import { useAppStore, type SourceFocus } from '@/stores/useAppStore'
import { useAllArticles } from '@/hooks/useAllArticles'
import { LoadingBadge } from '@/components/layout/LoadingBadge'
import { asset } from '@/utils/asset'
import { CATEGORY_COLORS } from '@/constants/categories'
import { isSourceVisible, sourceKeysFor } from '@/constants/sources'
import { isGlobalNewsArticle, resolveGlobalNewsLocation } from '@/utils/globalNews'
import type { Article } from '@/types/article'

interface Story extends Article {
  lat: number
  lon: number
  place: string
}

interface GlobalNewsViewProps {
  loading?: boolean
}

type GlobeWithHtml = GlobeInstance & {
  htmlElementsData: (data: object[]) => GlobeWithHtml
  htmlLat: (fn: (data: object) => number) => GlobeWithHtml
  htmlLng: (fn: (data: object) => number) => GlobeWithHtml
  htmlAltitude: (fn: (data: object) => number) => GlobeWithHtml
  htmlElement: (fn: (data: object) => HTMLElement) => GlobeWithHtml
  htmlElementVisibilityModifier: (fn: (element: HTMLElement, visible: boolean) => void) => GlobeWithHtml
}

function matchesSourceFocus(article: Article, focus: SourceFocus) {
  if (!focus) return true
  const keys = sourceKeysFor(article.source)
  if (focus === 'pib') return keys.includes('pib')
  if (focus === 'govt') return keys.some(key => ['rbi', 'mea', 'prs', 'airdd'].includes(key))
  return keys.includes(focus)
}

/**
 * The Global feed mode. It owns the same animated globe experience that used
 * to live in an overlay, but now occupies the feed's content stage directly.
 */
export function GlobalNewsView({ loading = false }: GlobalNewsViewProps) {
  const {
    selectedDate,
    articlesByDate,
    gsFilter,
    sourceFilter,
    sourceFocus,
    gsFocus,
    setActiveArticle,
    setDeepDiveReturnOverlay,
    setOverlay,
  } = useAppStore()
  useAllArticles()

  const hostRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeInstance | null>(null)
  const [index, setIndex] = useState(0)
  const [ready, setReady] = useState(false)

  const stories = useMemo<Story[]>(() => {
    return (articlesByDate[selectedDate] ?? [])
      .filter(article => gsFilter[article.gsPaper])
      .filter(article => isSourceVisible(article.source, sourceFilter))
      .filter(article => matchesSourceFocus(article, sourceFocus))
      .filter(article => !gsFocus || article.gsPaper === gsFocus)
      .filter(isGlobalNewsArticle)
      .flatMap<Story>(article => {
        const location = resolveGlobalNewsLocation(article)
        if (!location) return []
        return [{
          ...article,
          lat: location.lat,
          lon: location.lon,
          place: location.place,
        }]
      })
  }, [articlesByDate, gsFilter, gsFocus, selectedDate, sourceFilter, sourceFocus])

  const storyIds = useMemo(() => stories.map(story => story.id).join('\u001f'), [stories])
  const current = stories[index]

  useEffect(() => {
    setIndex(0)
  }, [storyIds])

  useEffect(() => {
    if (index >= stories.length) setIndex(0)
  }, [index, stories.length])

  useEffect(() => {
    const host = hostRef.current
    if (!host || globeRef.current) return
    let disposed = false

    fetch(asset('data/countries-110m.json'))
      .then(response => response.json())
      .then((topology: Topology) => {
        if (disposed || !hostRef.current) return
        const countries = feature(topology, topology.objects.countries) as unknown as { features: object[] }
        const globe = new Globe(hostRef.current)
        globe
          .backgroundColor('rgba(0,0,0,0)')
          .showAtmosphere(true)
          .atmosphereColor('#79a7ff')
          .atmosphereAltitude(0.2)
          .polygonsData(countries.features)
          .polygonCapColor(() => '#45a673')
          .polygonSideColor(() => 'rgba(24,70,52,0.55)')
          .polygonStrokeColor(() => 'rgba(221,255,238,0.38)')
          .polygonAltitude(0.01)
          .width(hostRef.current.clientWidth)
          .height(hostRef.current.clientHeight)

        const material = globe.globeMaterial() as unknown as {
          color: { set: (color: string) => void }
          emissive?: { set: (color: string) => void }
          shininess?: number
        }
        material.color.set('#0e2f5a')
        material.emissive?.set('#08203f')
        if ('shininess' in material) material.shininess = 8

        const controls = globe.controls() as {
          autoRotate: boolean
          autoRotateSpeed: number
          enableZoom: boolean
        }
        controls.autoRotate = true
        controls.autoRotateSpeed = 0.5
        controls.enableZoom = true

        globeRef.current = globe
        setReady(true)
      })
      .catch(() => {})

    return () => {
      disposed = true
      const globe = globeRef.current as (GlobeInstance & { _destructor?: () => void }) | null
      try { globe?._destructor?.() } catch { /* noop */ }
      globeRef.current = null
    }
  }, [])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe || !ready) return

    if (!stories.length) {
      globe.pointsData([])
      globe.ringsData([])
      ;(globe as GlobeWithHtml).htmlElementsData([])
      return
    }

    const activeId = current?.id
    globe
      .pointsData(stories as unknown as object[])
      .pointLat(data => (data as Story).lat)
      .pointLng(data => (data as Story).lon)
      .pointColor(data => CATEGORY_COLORS[(data as Story).category] ?? '#ffffff')
      .pointAltitude(data => (data as Story).id === activeId ? 0.09 : 0.015)
      .pointRadius(data => (data as Story).id === activeId ? 0.5 : 0.28)
      .pointsMerge(false)
      .onPointClick(data => {
        const nextIndex = stories.findIndex(story => story.id === (data as Story).id)
        if (nextIndex >= 0) setIndex(nextIndex)
      })

    globe
      .ringsData(current ? [current as unknown as object] : [])
      .ringLat(data => (data as Story).lat)
      .ringLng(data => (data as Story).lon)
      .ringColor(() => (progress: number) => `rgba(157,162,242,${1 - progress})`)
      .ringMaxRadius(5)
      .ringPropagationSpeed(2.2)
      .ringRepeatPeriod(850)

    ;(globe as GlobeWithHtml)
      .htmlElementsData(current ? [current as unknown as object] : [])
      .htmlLat(data => (data as Story).lat)
      .htmlLng(data => (data as Story).lon)
      .htmlAltitude(() => 0.13)
      .htmlElement(data => {
        const story = data as Story
        const element = document.createElement('button')
        element.className = 'globe-map-snippet'
        element.type = 'button'
        element.style.setProperty('--snippet-color', CATEGORY_COLORS[story.category] ?? '#9da2f2')
        element.onclick = () => openStory(story)

        const place = document.createElement('span')
        place.className = 'globe-map-snippet-place'
        place.textContent = story.place
        const headline = document.createElement('b')
        headline.textContent = story.headline
        const summary = document.createElement('span')
        summary.className = 'globe-map-snippet-summary'
        summary.textContent = story.summary
        element.append(place, headline, summary)
        return element
      })
      .htmlElementVisibilityModifier((element, visible) => {
        element.style.opacity = visible ? '1' : '0'
        element.style.pointerEvents = visible ? 'auto' : 'none'
      })
  // openStory only uses stable Zustand actions; listing those actions directly
  // would recreate every HTML marker without changing its content.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, ready, stories])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe || !ready || !current) return
    globe.pointOfView({ lat: current.lat, lng: current.lon, altitude: 1.6 }, 1200)
    const controls = globe.controls() as { autoRotate: boolean }
    controls.autoRotate = false
    const timer = window.setTimeout(() => {
      const nextControls = globeRef.current?.controls() as { autoRotate: boolean } | undefined
      if (nextControls) nextControls.autoRotate = true
    }, 4500)
    return () => window.clearTimeout(timer)
  }, [current, ready])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const resize = () => {
      const globe = globeRef.current
      if (globe) {
        globe.width(host.clientWidth)
        globe.height(host.clientHeight)
      }
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()
    return () => observer.disconnect()
  }, [ready])

  function move(delta: number) {
    if (stories.length < 2) return
    setIndex(currentIndex => (currentIndex + delta + stories.length) % stories.length)
  }

  function openStory(story: Story) {
    setActiveArticle(story)
    setDeepDiveReturnOverlay(null)
    setOverlay('deep-dive')
  }

  return (
    <section className="feed-global-view" aria-label="Global News — International Relations">
      <div ref={hostRef} className="globe-canvas" />

      {stories.length === 0 && (
        loading
          ? <LoadingBadge label="Mapping global stories" full />
          : <div className="globe-empty">No mapped global stories match these filters.</div>
      )}

      {current && (
        <div className="globe-card">
          <div className="globe-card-nav">
            <button type="button" onClick={() => move(-1)} aria-label="Previous global story">
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
            <span>{index + 1} <i>of</i> {stories.length}</span>
            <button type="button" onClick={() => move(1)} aria-label="Next global story">
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>
          <button type="button" className="globe-card-body" onClick={() => openStory(current)}>
            <div className="globe-card-place">
              <FontAwesomeIcon icon={faLocationDot} style={{ color: CATEGORY_COLORS[current.category] }} />
              {current.place}
            </div>
            <div className="globe-card-headline">{current.headline}</div>
            <div className="globe-card-meta">
              <span className="tag tag-cat" style={{ color: CATEGORY_COLORS[current.category], borderColor: CATEGORY_COLORS[current.category] + '30', background: CATEGORY_COLORS[current.category] + '14' }}>
                {current.category}
              </span>
              <span className="tag tag-src">{current.source}</span>
              <span className="globe-card-cta">Read →</span>
            </div>
          </button>
        </div>
      )}
    </section>
  )
}
