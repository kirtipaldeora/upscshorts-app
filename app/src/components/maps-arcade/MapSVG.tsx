import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { gsap, reducedMotion } from '@/anim/animations'

export type AtlasView = 'world' | 'continent' | 'world-physical' | 'india' | 'river-system' | 'parks'
export type AtlasMode = 'locate' | 'name'
export type AtlasPhase = 'browse' | 'playing' | 'answered' | 'results' | 'learn'

export interface AtlasCountry {
  id: number
  name: string
  continent: string
  feature: Feature
}

export interface AtlasRiver {
  id: number
  name: string
  system: string
  region: string
  major?: boolean
  source?: { type: string; name: string; place: string }
  geometry: Geometry
  labelPoint?: [number, number]
  labelAngle?: number
}

export interface AtlasPark {
  id: number
  name: string
  state: string
  region: string
  lon: number
  lat: number
}

export interface AtlasAnswer {
  targetId: string | number
  chosenId: string | number | null
  correct: boolean
  park?: { name: string; lon: number; lat: number }
}

export interface MapSVGHandle {
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
}

interface MapSVGProps {
  view: AtlasView
  mode: AtlasMode
  phase: AtlasPhase
  countries: AtlasCountry[]
  indiaStates: FeatureCollection | null
  rivers: AtlasRiver[]
  parks: AtlasPark[]
  activeContinent: string | null
  activeRiverSystem: string | null
  activeParkRegion: string | null
  activePracticeRegion?: string | null
  activeParkState?: string | null
  activeParkId?: number | null
  learnRiverNames?: string[]
  activePracticeState?: string | null
  stateName: (name: string) => string
  targetId: string | number | null
  chosenId: string | number | null
  history: AtlasAnswer[]
  onAnswer: (id: string | number) => void
  onParkFocus?: (park: AtlasPark) => void
}

const WORLD_BOUNDS: Record<string, [[number, number], [number, number]]> = {
  Europe: [[-25, 34], [42, 71]],
  Asia: [[25, -11], [150, 78]],
  Africa: [[-18, -35], [52, 38]],
  'North America': [[-168, 7], [-52, 72]],
  'South America': [[-82, -56], [-34, 13]],
  Oceania: [[112, -48], [180, 2]],
}

const C = {
  country: ['#6e9fbd', '#76a96f', '#a887c7', '#c49152', '#5fa79e', '#c07183'],
  inactive: '#d5d0c2',
  ocean: '#eaf7fa',
  border: '#f9fcff',
  india: '#fbeddc',
  indiaStroke: '#c5a67a',
  river: '#2e75b8',
  riverLight: '#7fb3da',
  park: '#23845c',
  target: '#e7a832',
  correct: '#27966b',
  wrong: '#d85c64',
  text: '#173042',
}

function featureId(d: Feature): string {
  return String(d.id ?? (d.properties as { id?: string | number } | undefined)?.id ?? '')
}

function boundsFeature(bounds: [[number, number], [number, number]]): Geometry {
  const [[minX, minY], [maxX, maxY]] = bounds
  return {
    type: 'MultiPoint',
    coordinates: [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]],
  }
}

function pointFeature(lon: number, lat: number): Feature {
  return { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lon, lat] } }
}

function stateFeatureName(feature: Feature): string {
  const props = feature.properties as { NAME_1?: string; ST_NM?: string; name?: string } | null
  return String(props?.NAME_1 ?? props?.ST_NM ?? props?.name ?? '')
}

function paddedFeatureBounds(feature: Feature | FeatureCollection, minSpan = 4.2, pad = 0.85): Geometry {
  const [[minLon, minLat], [maxLon, maxLat]] = d3.geoBounds(feature as never)
  const midLon = (minLon + maxLon) / 2
  const midLat = (minLat + maxLat) / 2
  const lonSpan = Math.max(maxLon - minLon + pad * 2, minSpan)
  const latSpan = Math.max(maxLat - minLat + pad * 2, minSpan)
  return boundsFeature([
    [midLon - lonSpan / 2, midLat - latSpan / 2],
    [midLon + lonSpan / 2, midLat + latSpan / 2],
  ])
}

export const MapSVG = forwardRef<MapSVGHandle, MapSVGProps>(function MapSVG({
  view,
  mode,
  phase,
  countries,
  indiaStates,
  rivers,
  parks,
  activeContinent,
  activeRiverSystem,
  activeParkRegion,
  activePracticeRegion,
  activeParkState,
  activeParkId,
  learnRiverNames = [],
  activePracticeState,
  stateName,
  targetId,
  chosenId,
  history,
  onAnswer,
  onParkFocus,
}, ref) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const focusRef = useRef<string>('')
  const [layoutSize, setLayoutSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    let lastWidth = 0
    let lastHeight = 0
    const syncSize = () => {
      const rect = wrap.getBoundingClientRect()
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)
      if (!width || !height || (width === lastWidth && height === lastHeight)) return
      lastWidth = width
      lastHeight = height
      setLayoutSize({ width, height })
    }
    syncSize()
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(syncSize)
      observer.observe(wrap)
      return () => observer.disconnect()
    }
    window.addEventListener('resize', syncSize)
    return () => window.removeEventListener('resize', syncSize)
  }, [])

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      const svg = svgRef.current
      const zoom = zoomRef.current
      if (svg && zoom) d3.select(svg).transition().duration(240).call(zoom.scaleBy, 1.45)
    },
    zoomOut: () => {
      const svg = svgRef.current
      const zoom = zoomRef.current
      if (svg && zoom) d3.select(svg).transition().duration(240).call(zoom.scaleBy, 0.7)
    },
    resetZoom: () => {
      const svg = svgRef.current
      const zoom = zoomRef.current
      if (svg && zoom) d3.select(svg).transition().duration(260).call(zoom.transform, d3.zoomIdentity)
    },
  }), [])

  useEffect(() => {
    const wrap = wrapRef.current
    const svgEl = svgRef.current
    if (!wrap || !svgEl) return

    const rect = wrap.getBoundingClientRect()
    const measuredWidth = layoutSize.width || Math.round(rect.width)
    const measuredHeight = layoutSize.height || Math.round(rect.height)
    if (!measuredWidth || !measuredHeight) return
    const w = Math.max(320, measuredWidth)
    const h = Math.max(320, measuredHeight)
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false
    const parkLearnSideDock = view === 'parks' && phase === 'learn' && w >= 700
    const parkLearnDockWidth = Math.min(330, Math.max(270, w * 0.36))
    const svg = d3.select(svgEl).attr('viewBox', `0 0 ${w} ${h}`)
    const oldMarks = svgEl.querySelectorAll('*')
    if (oldMarks.length) gsap.killTweensOf(oldMarks)
    gsap.killTweensOf(svgEl)
    svg.selectAll('*').remove()

    const g = svg.append('g')
    g.append('rect').attr('x', -w).attr('y', -h).attr('width', w * 3).attr('height', h * 3).attr('fill', C.ocean)

    const isIndiaView = view === 'india' || view === 'river-system' || view === 'parks'
    const projection = isIndiaView ? d3.geoMercator() : d3.geoNaturalEarth1()
    const path = d3.geoPath(projection)
    const worldFc: FeatureCollection = { type: 'FeatureCollection', features: countries.map(c => c.feature) }
    const indiaFeature = countries.find(c => c.id === 356)?.feature

    const activeParkStateId = activeParkState ? stateName(activeParkState) : null
    const focusedState = activePracticeState ?? (phase === 'learn' ? activeParkStateId : null)
    const activeStateFeature = isIndiaView && indiaStates && focusedState
      ? indiaStates.features.find(feature => stateName(stateFeatureName(feature)) === focusedState)
      : null
    const visibleSystemRivers = view === 'river-system'
      ? rivers.filter(river => !activeRiverSystem || river.system === activeRiverSystem)
      : []
    const targetRiver = view === 'river-system'
      ? visibleSystemRivers.find(river => String(river.id) === String(targetId))
      : null
    const visibleLearnRivers = view === 'parks' && phase === 'learn'
      ? rivers.filter(river => learnRiverNames.includes(river.name))
      : []

    if (view === 'continent' && activeContinent && WORLD_BOUNDS[activeContinent]) {
      projection.fitExtent([[20, 18], [w - 20, h - 18]], boundsFeature(WORLD_BOUNDS[activeContinent]) as never)
    } else if (isIndiaView) {
      const effectiveParkRegion = activePracticeRegion ?? activeParkRegion
      const isQuizPhase = phase === 'playing' || phase === 'answered'
      const shortLandscape = h < 560 && w > h
      const topGutter = isQuizPhase ? (shortLandscape ? 72 : w < 640 ? 136 : 122) : 32
      const bottomGutter = isQuizPhase ? (shortLandscape ? 104 : 166) : 74
      const mapBottom = Math.max(topGutter + 96, h - bottomGutter)
      if (view === 'river-system' && visibleSystemRivers.length) {
        const targetFeature: Feature | null = targetRiver
          ? { type: 'Feature', properties: {}, geometry: targetRiver.geometry }
          : null
        const systemFeatures: FeatureCollection = {
          type: 'FeatureCollection',
          features: visibleSystemRivers.map(river => ({ type: 'Feature', properties: {}, geometry: river.geometry })),
        }
        const focusGeometry = mode === 'name' && targetFeature && (phase === 'playing' || phase === 'answered')
          ? paddedFeatureBounds(targetFeature, 6.2, 1.1)
          : paddedFeatureBounds(systemFeatures, 10, 2)
        projection.fitExtent(
          [[44, topGutter], [w - 44, mapBottom]],
          focusGeometry as never,
        )
      } else if (view === 'parks' && activeStateFeature) {
        const compact = w < 640
        projection.fitExtent(
          phase === 'learn'
            ? parkLearnSideDock
              ? [[36, 112], [Math.max(260, w - parkLearnDockWidth - 24), Math.max(260, h - 28)]]
              : [[compact ? 24 : 38, compact ? 106 : 104], [w - (compact ? 24 : 38), Math.max(compact ? 226 : 224, h - (compact ? 252 : 184))]]
            : [[30, topGutter], [w - 30, mapBottom]],
          paddedFeatureBounds(activeStateFeature) as never,
        )
      } else {
        const region = view === 'parks' && effectiveParkRegion
        ? parks.filter(p => p.region === effectiveParkRegion)
        : []
        if (region.length) {
          const lon = region.map(p => p.lon)
          const lat = region.map(p => p.lat)
          projection.fitExtent(
            [[28, 24], [w - 28, h - 74]],
            boundsFeature([[Math.min(...lon) - 1.1, Math.min(...lat) - 1], [Math.max(...lon) + 1.1, Math.max(...lat) + 1]]) as never,
          )
        } else {
          projection.fitExtent([[28, 22], [w - 28, h - 28]], boundsFeature([[67.5, 6], [97.8, 37.5]]) as never)
        }
      }
    } else {
      projection.fitExtent([[12, 12], [w - 12, h - 12]], worldFc as never)
    }

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 10])
      .translateExtent([[0, 0], [w, h]])
      .extent([[0, 0], [w, h]])
      .on('zoom', (event) => { g.attr('transform', event.transform) })
    svg.call(zoom).on('dblclick.zoom', null)
    zoomRef.current = zoom

    const answerable = phase === 'playing' && mode === 'locate'
    const shouldShowCountries = view === 'world' || view === 'continent'
    const shouldShowIndia = isIndiaView
    const occupiedMapLabels: { x1: number; y1: number; x2: number; y2: number }[] = []

    if (shouldShowCountries) {
      const countryLayer = g.append('g').attr('class', 'atlas-country-layer')
      const countryPaths = countryLayer.selectAll('path')
        .data(countries)
        .join('path')
        .attr('d', d => path(d.feature as never) ?? '')
        .attr('data-id', d => d.id)
        .attr('data-continent', d => d.continent)
        .attr('data-answer', d => {
          if (String(d.id) === String(targetId)) return 'target'
          if (String(d.id) === String(chosenId)) return 'chosen'
          return null
        })
        .attr('fill', d => {
          if (phase === 'answered') {
            if (String(d.id) === String(chosenId)) return String(chosenId) === String(targetId) ? C.correct : C.wrong
            if (String(d.id) === String(targetId)) return C.correct
          }
          if (phase === 'playing' && mode === 'name' && String(d.id) === String(targetId)) return C.target
          if (view === 'continent' && activeContinent && d.continent !== activeContinent) return C.inactive
          return C.country[Math.abs(d.id * 7) % C.country.length]
        })
        .attr('stroke', C.border)
        .attr('stroke-width', d => String(d.id) === String(targetId) && (phase === 'answered' || mode === 'name') ? 2 : 0.95)
        .attr('vector-effect', 'non-scaling-stroke')
        .style('cursor', d => answerable && view === 'continent' && d.continent === activeContinent ? 'pointer' : 'default')
        .on('click', (_event, d) => {
          if (answerable && view === 'continent' && d.continent === activeContinent) onAnswer(d.id)
        })

      if (phase === 'answered') {
        const target = countries.find(c => String(c.id) === String(targetId))
        const chosen = countries.find(c => String(c.id) === String(chosenId))
        const badges = [
          target ? { country: target, kind: 'answer' as const, label: 'Answer', color: C.correct } : null,
          chosen && String(chosen.id) !== String(targetId) ? { country: chosen, kind: 'pick' as const, label: 'Your pick', color: C.wrong } : null,
        ].filter(Boolean) as { country: AtlasCountry; kind: 'answer' | 'pick'; label: string; color: string }[]
        const badgeLayer = g.append('g').attr('class', 'atlas-country-feedback')
        badges.forEach(({ country, kind, label, color }, index) => {
          const centroid = path.centroid(country.feature as never)
          if (!Number.isFinite(centroid[0]) || !Number.isFinite(centroid[1])) return
          const name = country.name.length > 18 ? `${country.name.slice(0, 17)}...` : country.name
          const bw = Math.max(92, Math.min(158, name.length * 7 + 34))
          const bh = 44
          const x = Math.max(48, Math.min(w - bw / 2 - 8, centroid[0]))
          const y = Math.max(32, centroid[1] - 36 - index * 10)
          const badge = badgeLayer.append('g')
            .attr('data-answer', kind === 'answer' ? 'target' : 'chosen')
            .attr('transform', `translate(${x},${y})`)
            .attr('opacity', reducedMotion() ? 1 : 0)
          badge.append('line')
            .attr('x1', 0)
            .attr('y1', bh / 2)
            .attr('x2', centroid[0] - x)
            .attr('y2', centroid[1] - y)
            .attr('stroke', color)
            .attr('stroke-width', 1.4)
            .attr('stroke-linecap', 'round')
            .attr('opacity', 0.8)
          badge.append('rect')
            .attr('x', -bw / 2)
            .attr('y', -bh / 2)
            .attr('width', bw)
            .attr('height', bh)
            .attr('rx', 12)
            .attr('fill', '#fff')
            .attr('stroke', color)
            .attr('stroke-width', 1.6)
            .attr('filter', 'drop-shadow(0 8px 16px rgba(22,43,58,.18))')
          badge.append('text')
            .attr('x', 0)
            .attr('y', -4)
            .attr('text-anchor', 'middle')
            .attr('font-size', 9.5)
            .attr('font-weight', 900)
            .attr('letter-spacing', 0.6)
            .attr('fill', color)
            .text(label.toUpperCase())
          badge.append('text')
            .attr('x', 0)
            .attr('y', 12)
            .attr('text-anchor', 'middle')
            .attr('font-size', 12)
            .attr('font-weight', 900)
            .attr('fill', C.text)
            .text(name)
          badge.append('circle')
            .attr('cx', centroid[0] - x)
            .attr('cy', centroid[1] - y)
            .attr('r', 4)
            .attr('fill', color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
          if (!reducedMotion()) gsap.to(badge.node(), { opacity: 1, y: y - 4, duration: 0.34, delay: index * 0.08, ease: 'back.out(1.7)' })
        })
      }
      if (!reducedMotion() && phase === 'playing' && mode === 'name') {
        countryPaths.filter(d => String(d.id) === String(targetId))
          .each(function () {
            gsap.fromTo(this,
              { filter: 'drop-shadow(0 0 0px rgba(231,168,50,0))' },
              { filter: 'drop-shadow(0 0 12px rgba(231,168,50,.42))', duration: 0.7, yoyo: true, repeat: 1, ease: 'sine.inOut' })
          })
      }
    }

    if (view === 'river-system') {
      const basinCountryIds = activeRiverSystem === 'indus_ref'
        ? new Set([4, 156, 356, 586])
        : activeRiverSystem === 'brahmaputra_ref'
          ? new Set([50, 64, 104, 156, 356])
          : activeRiverSystem === 'ganga_ref'
            ? new Set([50, 156, 356, 524])
            : new Set([356])
      g.append('g')
        .attr('class', 'atlas-basin-context')
        .selectAll('path')
        .data(countries.filter(country => basinCountryIds.has(country.id)))
        .join('path')
        .attr('d', country => path(country.feature as never) ?? '')
        .attr('fill', country => country.id === 356 ? C.india : '#f4e7d5')
        .attr('stroke', country => country.id === 356 ? C.indiaStroke : '#cbb18c')
        .attr('stroke-width', country => country.id === 356 ? 1.05 : 0.7)
        .attr('vector-effect', 'non-scaling-stroke')
    }

    if (shouldShowIndia && indiaFeature) {
      g.append('path')
        .datum(indiaFeature)
        .attr('d', path as never)
        .attr('fill', C.india)
        .attr('stroke', '#d0b288')
        .attr('stroke-width', 1.1)
        .attr('vector-effect', 'non-scaling-stroke')
    }

    if (shouldShowIndia && indiaStates) {
      const states = g.append('g').attr('class', 'atlas-india-states')
      states.selectAll('path')
        .data(indiaStates.features)
        .join('path')
        .attr('d', d => path(d as never) ?? '')
        .attr('data-active-state', d => {
          const id = stateName(stateFeatureName(d))
          return view === 'parks' && phase === 'learn' && id === activeParkStateId ? 'true' : null
        })
        .attr('fill', d => {
          const id = stateName(stateFeatureName(d))
          if (phase === 'answered') {
            if (String(id) === String(chosenId)) return String(chosenId) === String(targetId) ? C.correct : C.wrong
            if (String(id) === String(targetId)) return C.correct
          }
          if (view === 'parks' && activePracticeState && id === activePracticeState && phase === 'playing') return '#fff3db'
          if (view === 'parks' && phase === 'learn' && activeParkStateId) return id === activeParkStateId ? '#d9edcf' : '#f5e9d8'
          return C.india
        })
        .attr('stroke', C.indiaStroke)
        .attr('opacity', d => {
          if (view !== 'parks' || phase !== 'learn' || !activeParkStateId) return 1
          return stateName(stateFeatureName(d)) === activeParkStateId ? 1 : 0.17
        })
        .attr('filter', d => {
          const id = stateName(stateFeatureName(d))
          return view === 'parks' && phase === 'learn' && id === activeParkStateId
            ? 'drop-shadow(0 5px 8px rgba(34,91,62,.18))'
            : null
        })
        .attr('stroke-width', d => {
          const id = stateName(stateFeatureName(d))
          if (view === 'parks' && activePracticeState && id === activePracticeState && phase === 'playing') return 1.5
          if (view === 'parks' && phase === 'learn' && id === activeParkStateId) return 1.6
          return String(id) === String(targetId) && (phase === 'answered' || mode === 'name') ? 1.6 : 0.55
        })
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('data-answer', d => {
          const id = stateName(stateFeatureName(d))
          if (view === 'parks' && phase !== 'answered') return null
          if (String(id) === String(targetId)) return 'target'
          if (String(id) === String(chosenId)) return 'chosen'
          return null
        })
        .style('cursor', answerable && view === 'parks' ? 'pointer' : 'default')
        .on('click', (_event, d) => {
          if (!answerable || view !== 'parks') return
          const name = stateFeatureName(d)
          onAnswer(stateName(name))
        })
    }

    if (view === 'river-system') {
      const visibleRivers = rivers.filter(r => !activeRiverSystem || r.system === activeRiverSystem)
      const riverLayer = g.append('g').attr('class', 'atlas-river-layer')
      const riverPaths = riverLayer.selectAll('path.river-visible')
        .data(visibleRivers)
        .join('path')
        .attr('class', 'river-visible')
        .attr('data-id', r => r.id)
        .attr('data-answer', r => {
          if (String(r.id) === String(targetId)) return 'target'
          if (String(r.id) === String(chosenId)) return 'chosen'
          return null
        })
        .attr('d', r => path(r.geometry as never) ?? '')
        .attr('fill', 'none')
        .attr('stroke', r => {
          if (phase === 'answered') {
            if (String(r.id) === String(chosenId)) return String(chosenId) === String(targetId) ? C.correct : C.wrong
            if (String(r.id) === String(targetId)) return C.correct
          }
          if (mode === 'name' && String(r.id) === String(targetId)) return C.target
          return r.major ? C.river : C.riverLight
        })
        .attr('stroke-width', r => String(r.id) === String(targetId) && (phase === 'answered' || mode === 'name') ? (r.major ? 6 : 5) : (r.major ? 3.1 : 2.1))
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('vector-effect', 'non-scaling-stroke')

      riverLayer.selectAll('path.river-hit')
        .data(visibleRivers)
        .join('path')
        .attr('class', 'river-hit')
        .attr('data-id', r => r.id)
        .attr('d', r => path(r.geometry as never) ?? '')
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 18)
        .attr('stroke-linecap', 'round')
        .style('cursor', answerable ? 'pointer' : 'default')
        .on('click', (event, fallback) => {
          if (!answerable) return
          const svgNode = svg.node()
          if (!svgNode) { onAnswer(fallback.id); return }
          const point = svgNode.createSVGPoint()
          point.x = event.clientX
          point.y = event.clientY
          const hits: { id: number; dist: number }[] = []
          riverPaths.each(function (r) {
            const p = this as SVGPathElement
            try {
              const local = point.matrixTransform(p.getScreenCTM()?.inverse())
              if (p.isPointInStroke?.(local)) hits.push({ id: r.id, dist: 0 })
            } catch { /* noop */ }
          })
          if (hits.some(h => String(h.id) === String(targetId))) onAnswer(targetId!)
          else onAnswer(hits[0]?.id ?? fallback.id)
        })

      visibleRivers.forEach(r => {
        if (phase !== 'browse') return
        const labelPoint = r.labelPoint ?? (d3.geoCentroid(r.geometry as never) as [number, number])
        const p = projection(labelPoint)
        if (!p) return
        g.append('text')
          .attr('x', p[0])
          .attr('y', p[1])
          .attr('text-anchor', 'middle')
          .attr('transform', `rotate(${r.labelAngle ?? 0}, ${p[0]}, ${p[1]})`)
          .attr('font-size', 10.5)
          .attr('font-weight', 800)
          .attr('fill', C.text)
          .attr('paint-order', 'stroke')
          .attr('stroke', '#fff')
          .attr('stroke-width', 3)
          .text(r.name.toUpperCase())
      })

      if (phase === 'answered') {
        const river = rivers.find(r => String(r.id) === String(targetId))
        const coords = river?.geometry.type === 'LineString' ? river.geometry.coordinates[0] : null
        if (river?.source && Array.isArray(coords)) {
          const p = projection(coords as [number, number])
          if (p) {
            const marker = g.append('g').attr('transform', `translate(${p[0]},${p[1]})`).attr('opacity', 0)
            marker.append('circle').attr('r', 8).attr('fill', '#fff').attr('stroke', C.target).attr('stroke-width', 2)
            marker.append('circle').attr('r', 3.2).attr('fill', C.target)
            marker.append('text')
              .attr('x', 12)
              .attr('y', 4)
              .attr('font-size', 11)
              .attr('font-weight', 800)
              .attr('fill', C.text)
              .attr('paint-order', 'stroke')
              .attr('stroke', '#fff')
              .attr('stroke-width', 3)
              .text(river.source.name)
            if (!reducedMotion()) gsap.to(marker.node(), { opacity: 1, duration: 0.25 })
            else marker.attr('opacity', 1)
          }
        }
      }
    }

    if (view === 'parks' && phase === 'learn' && visibleLearnRivers.length) {
      const learnRiverLayer = g.append('g').attr('class', 'atlas-park-river-layer')
      const learnRiverPaths = learnRiverLayer.selectAll('path')
        .data(visibleLearnRivers)
        .join('path')
        .attr('class', 'park-river-visible')
        .attr('d', river => path(river.geometry as never) ?? '')
        .attr('fill', 'none')
        .attr('stroke', river => river.major ? '#2f79b8' : '#6ba9d2')
        .attr('stroke-width', river => river.major ? 2.4 : 1.65)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('opacity', river => river.major ? 0.9 : 0.72)
        .style('pointer-events', 'none')

      const labelLimit = w < 640 ? 2 : parkLearnSideDock ? 4 : 3
      const labelCandidates = visibleLearnRivers
        .slice()
        .sort((a, b) => Number(Boolean(b.major)) - Number(Boolean(a.major)))
        .slice(0, labelLimit)
      const safeRight = parkLearnSideDock ? w - parkLearnDockWidth - 18 : w - 14
      const safeBottom = parkLearnSideDock ? h - 14 : h - (w < 640 ? 248 : 178)
      learnRiverPaths
        .filter(river => labelCandidates.some(candidate => candidate.id === river.id))
        .each(function (river) {
          const riverPath = this as SVGPathElement
          const length = riverPath.getTotalLength?.() ?? 0
          if (length < 28) return
          const labelWidth = Math.max(42, Math.min(92, river.name.length * 5.6 + 14))
          const fractions = [0.5, 0.34, 0.66, 0.2, 0.8]
          let labelPoint: { x: number; y: number } | null = null
          for (const fraction of fractions) {
            const point = riverPath.getPointAtLength(length * fraction)
            const rect = { x1: point.x - labelWidth / 2, y1: point.y - 10, x2: point.x + labelWidth / 2, y2: point.y + 8 }
            const inFrame = rect.x1 > 12 && rect.x2 < safeRight && rect.y1 > 108 && rect.y2 < safeBottom
            const collides = occupiedMapLabels.some(other => !(rect.x2 < other.x1 || rect.x1 > other.x2 || rect.y2 < other.y1 || rect.y1 > other.y2))
            if (inFrame && !collides) {
              occupiedMapLabels.push(rect)
              labelPoint = point
              break
            }
          }
          if (!labelPoint) return
          const label = learnRiverLayer.append('g')
            .attr('class', 'park-river-label')
            .attr('transform', `translate(${labelPoint.x},${labelPoint.y})`)
            .style('pointer-events', 'none')
          label.append('rect')
            .attr('x', -labelWidth / 2)
            .attr('y', -10)
            .attr('width', labelWidth)
            .attr('height', 18)
            .attr('rx', 7)
            .attr('fill', 'rgba(244,251,255,.92)')
            .attr('stroke', '#6ba9d2')
            .attr('stroke-width', 0.8)
          label.append('text')
            .attr('y', 2.8)
            .attr('text-anchor', 'middle')
            .attr('font-size', 8.8)
            .attr('font-weight', 900)
            .attr('fill', '#245b84')
            .text(river.name)
        })
    }

    if (view === 'parks') {
      const effectiveParkRegion = activePracticeRegion ?? activeParkRegion
      const regionParks = parks.filter(p => !effectiveParkRegion || p.region === effectiveParkRegion)
      const visibleParks = phase === 'learn'
        ? regionParks.filter(p => !activeParkState || p.state === activeParkState)
        : regionParks.filter(p => history.some(h => h.park?.name === p.name))
      const doneParks = history.filter(h => h.park)
      const compactLearnLabels = phase === 'learn' && w < 640
      const occupiedLabels = occupiedMapLabels
      const labelOffsets = [
        { dx: 10, dy: 4, anchor: 'start' as const },
        { dx: 10, dy: -10, anchor: 'start' as const },
        { dx: -10, dy: 4, anchor: 'end' as const },
        { dx: -10, dy: -10, anchor: 'end' as const },
        { dx: 0, dy: 18, anchor: 'middle' as const },
        { dx: 0, dy: -18, anchor: 'middle' as const },
        { dx: 16, dy: 16, anchor: 'start' as const },
        { dx: -16, dy: 16, anchor: 'end' as const },
      ]
      const projectedParks = visibleParks
        .map(park => {
          const xy = projection([park.lon, park.lat])
          if (!xy) return null
          const name = park.name.replace(/ National Park/g, '')
          const shortName = name.length > 20 ? `${name.slice(0, 19)}...` : name
          const widthEstimate = Math.max(48, Math.min(132, shortName.length * 5.9 + 16))
          const heightEstimate = 18
          let label: { dx: number; dy: number; anchor: 'start' | 'middle' | 'end'; text: string } | null = null
          const isActivePark = phase === 'learn' && park.id === activeParkId
          if (isActivePark && compactLearnLabels) {
            label = { dx: 0, dy: xy[1] < 128 ? 25 : -20, anchor: 'middle', text: shortName }
          } else if ((phase === 'learn' && !compactLearnLabels) || doneParks.some(h => h.park?.name === park.name)) {
            for (const offset of labelOffsets) {
              const left = offset.anchor === 'start'
                ? xy[0] + offset.dx
                : offset.anchor === 'end'
                  ? xy[0] + offset.dx - widthEstimate
                  : xy[0] + offset.dx - widthEstimate / 2
              const top = xy[1] + offset.dy - heightEstimate + 4
              const rect = { x1: left - 4, y1: top - 3, x2: left + widthEstimate + 4, y2: top + heightEstimate + 3 }
              const topLimit = phase === 'learn' ? 104 : 8
              const rightLimit = parkLearnSideDock && phase === 'learn' ? w - parkLearnDockWidth - 14 : w - 8
              const bottomLimit = phase === 'learn' && !parkLearnSideDock ? h - (w < 640 ? 245 : 176) : h - 8
              const outOfFrame = rect.x1 < 8 || rect.x2 > rightLimit || rect.y1 < topLimit || rect.y2 > bottomLimit
              const collides = occupiedLabels.some(other => !(rect.x2 < other.x1 || rect.x1 > other.x2 || rect.y2 < other.y1 || rect.y1 > other.y2))
              if (!outOfFrame && !collides) {
                occupiedLabels.push(rect)
                label = { ...offset, text: shortName }
                break
              }
            }
          }
          return { park, x: xy[0], y: xy[1], label }
        })
        .filter(Boolean) as { park: AtlasPark; x: number; y: number; label: { dx: number; dy: number; anchor: 'start' | 'middle' | 'end'; text: string } | null }[]
      const parkLayer = g.append('g').attr('class', 'atlas-park-layer')
      parkLayer.selectAll('g.park')
        .data(projectedParks)
        .join('g')
        .attr('class', 'park')
        .attr('data-id', p => p.park.id)
        .attr('data-active', p => phase === 'learn' && p.park.id === activeParkId ? 'true' : null)
        .attr('data-answer', p => doneParks.find(h => h.park?.name === p.park.name)?.correct ? 'target' : doneParks.some(h => h.park?.name === p.park.name) ? 'chosen' : null)
        .attr('transform', p => `translate(${p.x},${p.y})`)
        .style('cursor', phase === 'learn' ? 'pointer' : 'default')
        .on('click', (_event, p) => { if (phase === 'learn') onParkFocus?.(p.park) })
        .each(function (p) {
          const node = d3.select(this)
          const visual = node.append('g').attr('class', 'park-visual')
          const answered = doneParks.find(h => h.park?.name === p.park.name)
          const color = answered ? (answered.correct ? C.correct : C.wrong) : C.park
          const active = phase === 'learn' && p.park.id === activeParkId
          if (active) {
            visual.append('circle').attr('r', compactLearnLabels ? 10 : 12).attr('fill', 'rgba(35,132,92,.14)').attr('stroke', color).attr('stroke-width', 1.4)
          }
          visual.append('circle').attr('r', active ? 6.8 : phase === 'learn' ? 4.5 : 4).attr('fill', color).attr('stroke', '#fff').attr('stroke-width', active ? 2.6 : 2)
          if (p.label) {
            if (Math.abs(p.label.dx) > 0 || Math.abs(p.label.dy) > 8) {
              visual.append('line')
                .attr('x1', p.label.dx > 0 ? 4 : p.label.dx < 0 ? -4 : 0)
                .attr('y1', p.label.dy > 0 ? 4 : p.label.dy < 0 ? -4 : 0)
                .attr('x2', p.label.dx)
                .attr('y2', p.label.dy - 4)
                .attr('stroke', color)
                .attr('stroke-width', 1)
                .attr('opacity', 0.55)
            }
            if (active) {
              const pillWidth = Math.max(58, Math.min(146, p.label.text.length * 6.05 + 18))
              const pillX = p.label.anchor === 'start' ? p.label.dx - 7 : p.label.anchor === 'end' ? p.label.dx - pillWidth + 7 : p.label.dx - pillWidth / 2
              visual.append('rect')
                .attr('x', pillX)
                .attr('y', p.label.dy - 14)
                .attr('width', pillWidth)
                .attr('height', 20)
                .attr('rx', 8)
                .attr('fill', 'rgba(255,255,255,.96)')
                .attr('stroke', color)
                .attr('stroke-width', 1.2)
                .attr('filter', 'drop-shadow(0 5px 10px rgba(22,43,58,.16))')
            }
            visual.append('text')
              .attr('x', p.label.dx)
              .attr('y', p.label.dy)
              .attr('text-anchor', p.label.anchor)
              .attr('font-size', active ? 10.5 : 10)
              .attr('font-weight', 800)
              .attr('fill', C.text)
              .attr('paint-order', 'stroke')
              .attr('stroke', '#fff')
              .attr('stroke-width', 3.5)
              .text(p.label.text)
          }
        })
    }

    if (!reducedMotion() && !coarsePointer) {
      const focusKey = [
        view,
        activeContinent,
        activeRiverSystem,
        activeParkRegion,
        activePracticeRegion,
        activeParkState,
        activeParkId,
        learnRiverNames,
        activePracticeState,
        targetId,
      ].filter(Boolean).join(':')
      const changedFocus = focusRef.current && focusRef.current !== focusKey
      focusRef.current = focusKey
      gsap.fromTo(g.node(),
        {
          opacity: changedFocus ? 0.42 : 0.76,
          scale: changedFocus ? (view === 'parks' ? 0.965 : view === 'continent' || view === 'river-system' ? 0.84 : 0.9) : 1,
          transformOrigin: '50% 50%',
        },
        {
          opacity: 1,
          scale: 1,
          duration: changedFocus ? (view === 'parks' ? 0.52 : 0.68) : 0.28,
          ease: view === 'parks' ? 'power3.out' : 'expo.out',
          clearProps: 'transform,opacity',
        })
      const mapMarks = svgEl.querySelectorAll('.atlas-country-layer path, .river-visible, .park-river-visible, .park')
      if (mapMarks.length) {
        gsap.fromTo(mapMarks,
          { opacity: 0.74 },
          { opacity: 1, duration: 0.35, stagger: 0.001, ease: 'power2.out', clearProps: 'opacity' })
      }
      const stateLayer = svgEl.querySelector('.atlas-india-states')
      if (stateLayer) {
        gsap.fromTo(stateLayer,
          { opacity: 0.78 },
          { opacity: 1, duration: 0.32, ease: 'power2.out', clearProps: 'opacity' })
      }
      const riversToDraw = svgEl.querySelectorAll('.river-visible')
      riversToDraw.forEach(pathNode => {
        const pathEl = pathNode as SVGPathElement
        const length = Math.min(2200, Math.max(120, pathEl.getTotalLength?.() || 0))
        gsap.fromTo(pathEl,
          { strokeDasharray: length, strokeDashoffset: length },
          { strokeDashoffset: 0, duration: changedFocus ? 0.85 : 0.48, ease: 'power2.out', clearProps: 'strokeDasharray,strokeDashoffset' })
      })
      const parkRiversToDraw = svgEl.querySelectorAll('.park-river-visible')
      parkRiversToDraw.forEach((pathNode, index) => {
        const pathEl = pathNode as SVGPathElement
        const length = Math.min(1800, Math.max(100, pathEl.getTotalLength?.() || 0))
        gsap.fromTo(pathEl,
          { strokeDasharray: length, strokeDashoffset: length, opacity: 0.2 },
          { strokeDashoffset: 0, opacity: Number(pathEl.getAttribute('opacity') ?? 0.8), duration: 0.62, delay: index * 0.035, ease: 'power2.out', clearProps: 'strokeDasharray,strokeDashoffset' })
      })
      const parkDots = svgEl.querySelectorAll('.park circle')
      if (parkDots.length) {
        gsap.fromTo(parkDots,
          { scale: 0.2, transformOrigin: '50% 50%' },
          { scale: 1, duration: 0.42, stagger: 0.035, ease: 'back.out(2)', clearProps: 'transform' })
      }
      const activeParkVisual = svgEl.querySelector('.park[data-active="true"] .park-visual')
      if (activeParkVisual) {
        gsap.timeline()
          .fromTo(activeParkVisual, { y: 5, opacity: 0.68 }, { y: -7, opacity: 1, duration: 0.38, ease: 'back.out(1.7)' })
          .to(activeParkVisual, { y: 0, duration: 0.42, delay: 0.9, ease: 'power2.inOut', clearProps: 'transform,opacity' })
      }
      const activeStatePath = svgEl.querySelector('.atlas-india-states path[data-active-state="true"]')
      if (activeStatePath) {
        gsap.timeline()
          .fromTo(activeStatePath,
            { scale: 0.985, opacity: 0.62, transformOrigin: '50% 50%', filter: 'drop-shadow(0 0 0 rgba(34,91,62,0))' },
            { scale: 1, opacity: 1, filter: 'drop-shadow(0 8px 12px rgba(34,91,62,.24))', duration: 0.46, ease: 'power3.out' })
          .to(activeStatePath, { filter: 'drop-shadow(0 4px 8px rgba(34,91,62,.16))', duration: 0.42, delay: 0.35, clearProps: 'transform' })
      }
      const selectedStates = svgEl.querySelectorAll('.atlas-india-states [data-answer="target"], .atlas-india-states [data-answer="chosen"]')
      if (selectedStates.length) {
        gsap.fromTo(selectedStates,
          { strokeWidth: 4 },
          { strokeWidth: 1.6, duration: 0.55, ease: 'power2.out' })
      }
      const answered = svgEl.querySelectorAll('[data-answer="target"], [data-answer="chosen"]')
      if (answered.length) {
        gsap.fromTo(answered,
          { filter: 'drop-shadow(0 0 0px rgba(46,117,184,0))' },
          { filter: 'drop-shadow(0 0 10px rgba(46,117,184,.45))', duration: 0.38, yoyo: true, repeat: 1, ease: 'power2.out' })
      }
    }
  }, [view, mode, phase, countries, indiaStates, rivers, parks, activeContinent, activeRiverSystem, activeParkRegion, activePracticeRegion, activeParkState, activeParkId, learnRiverNames, activePracticeState, stateName, targetId, chosenId, history, onAnswer, onParkFocus, layoutSize.width, layoutSize.height])

  return (
    <div ref={wrapRef} className="atlas-map-canvas">
      <svg ref={svgRef} />
    </div>
  )
})
