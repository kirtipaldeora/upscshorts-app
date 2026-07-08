import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as d3 from 'd3'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { gsap, reducedMotion } from '@/anim/animations'

export type AtlasView = 'world' | 'continent' | 'india' | 'river-system' | 'parks'
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

function paddedFeatureBounds(feature: Feature, minSpan = 4.2, pad = 0.85): Geometry {
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

    const { width, height } = wrap.getBoundingClientRect()
    const w = Math.max(320, Math.round(width))
    const h = Math.max(320, Math.round(height))
    const svg = d3.select(svgEl).attr('viewBox', `0 0 ${w} ${h}`)
    svg.selectAll('*').remove()

    const g = svg.append('g')
    g.append('rect').attr('x', -w).attr('y', -h).attr('width', w * 3).attr('height', h * 3).attr('fill', C.ocean)

    const isIndiaView = view === 'india' || view === 'river-system' || view === 'parks'
    const projection = isIndiaView ? d3.geoMercator() : d3.geoNaturalEarth1()
    const path = d3.geoPath(projection)
    const worldFc: FeatureCollection = { type: 'FeatureCollection', features: countries.map(c => c.feature) }
    const indiaFeature = countries.find(c => c.id === 356)?.feature

    const focusedState = activePracticeState ?? (phase === 'learn' ? activeParkState : null)
    const activeStateFeature = isIndiaView && indiaStates && focusedState
      ? indiaStates.features.find(feature => stateName(stateFeatureName(feature)) === focusedState)
      : null

    if (view === 'continent' && activeContinent && WORLD_BOUNDS[activeContinent]) {
      projection.fitExtent([[20, 18], [w - 20, h - 18]], boundsFeature(WORLD_BOUNDS[activeContinent]) as never)
    } else if (isIndiaView) {
      const effectiveParkRegion = activePracticeRegion ?? activeParkRegion
      const bottomGutter = phase === 'playing' || phase === 'answered' ? 166 : 74
      if (view === 'parks' && activeStateFeature) {
        projection.fitExtent(
          [[30, 34], [w - 30, h - (phase === 'learn' ? 128 : bottomGutter)]],
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
        .attr('fill', d => {
          const id = stateName(stateFeatureName(d))
          if (phase === 'answered') {
            if (String(id) === String(chosenId)) return String(chosenId) === String(targetId) ? C.correct : C.wrong
            if (String(id) === String(targetId)) return C.correct
          }
          if (view === 'parks' && activePracticeState && id === activePracticeState && phase === 'playing') return '#fff3db'
          return C.india
        })
        .attr('stroke', C.indiaStroke)
        .attr('stroke-width', d => {
          const id = stateName(stateFeatureName(d))
          if (view === 'parks' && activePracticeState && id === activePracticeState && phase === 'playing') return 1.5
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

    if (view === 'parks') {
      const effectiveParkRegion = activePracticeRegion ?? activeParkRegion
      const regionParks = parks.filter(p => !effectiveParkRegion || p.region === effectiveParkRegion)
      const visibleParks = phase === 'learn'
        ? regionParks.filter(p => !activeParkState || p.state === activeParkState)
        : regionParks.filter(p => history.some(h => h.park?.name === p.name))
      const doneParks = history.filter(h => h.park)
      const occupiedLabels: { x1: number; y1: number; x2: number; y2: number }[] = []
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
          if (phase === 'learn' || doneParks.some(h => h.park?.name === park.name)) {
            for (const offset of labelOffsets) {
              const left = offset.anchor === 'start'
                ? xy[0] + offset.dx
                : offset.anchor === 'end'
                  ? xy[0] + offset.dx - widthEstimate
                  : xy[0] + offset.dx - widthEstimate / 2
              const top = xy[1] + offset.dy - heightEstimate + 4
              const rect = { x1: left - 4, y1: top - 3, x2: left + widthEstimate + 4, y2: top + heightEstimate + 3 }
              const outOfFrame = rect.x1 < 8 || rect.x2 > w - 8 || rect.y1 < 8 || rect.y2 > h - 112
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
        .attr('data-answer', p => doneParks.find(h => h.park?.name === p.park.name)?.correct ? 'target' : doneParks.some(h => h.park?.name === p.park.name) ? 'chosen' : null)
        .attr('transform', p => `translate(${p.x},${p.y})`)
        .style('cursor', phase === 'learn' ? 'pointer' : 'default')
        .on('click', (_event, p) => { if (phase === 'learn') onParkFocus?.(p.park) })
        .each(function (p) {
          const node = d3.select(this)
          const answered = doneParks.find(h => h.park?.name === p.park.name)
          const color = answered ? (answered.correct ? C.correct : C.wrong) : C.park
          node.append('circle').attr('r', phase === 'learn' ? 5.5 : 4).attr('fill', color).attr('stroke', '#fff').attr('stroke-width', 2)
          if (p.label) {
            if (Math.abs(p.label.dx) > 0 || Math.abs(p.label.dy) > 8) {
              node.append('line')
                .attr('x1', p.label.dx > 0 ? 4 : p.label.dx < 0 ? -4 : 0)
                .attr('y1', p.label.dy > 0 ? 4 : p.label.dy < 0 ? -4 : 0)
                .attr('x2', p.label.dx)
                .attr('y2', p.label.dy - 4)
                .attr('stroke', color)
                .attr('stroke-width', 1)
                .attr('opacity', 0.55)
            }
            node.append('text')
              .attr('x', p.label.dx)
              .attr('y', p.label.dy)
              .attr('text-anchor', p.label.anchor)
              .attr('font-size', 10)
              .attr('font-weight', 800)
              .attr('fill', C.text)
              .attr('paint-order', 'stroke')
              .attr('stroke', '#fff')
              .attr('stroke-width', 3.5)
              .text(p.label.text)
          }
        })
    }

    if (!reducedMotion()) {
      const focusKey = [
        view,
        activeContinent,
        activeRiverSystem,
        activeParkRegion,
        activePracticeRegion,
        activeParkState,
        activePracticeState,
        targetId,
      ].filter(Boolean).join(':')
      const changedFocus = focusRef.current && focusRef.current !== focusKey
      focusRef.current = focusKey
      gsap.fromTo(g.node(),
        {
          opacity: changedFocus ? 0.42 : 0.76,
          scale: changedFocus ? (view === 'parks' || view === 'continent' ? 0.84 : 0.9) : 1,
          transformOrigin: '50% 50%',
        },
        {
          opacity: 1,
          scale: 1,
          duration: changedFocus ? 0.68 : 0.28,
          ease: 'expo.out',
          clearProps: 'transform,opacity',
        })
      gsap.fromTo(svgEl.querySelectorAll('.atlas-country-layer path, .atlas-india-states path, .river-visible, .park'),
        { opacity: 0.74 },
        { opacity: 1, duration: 0.35, stagger: 0.001, ease: 'power2.out' })
      const riversToDraw = svgEl.querySelectorAll('.river-visible')
      riversToDraw.forEach(pathNode => {
        const pathEl = pathNode as SVGPathElement
        const length = Math.min(2200, Math.max(120, pathEl.getTotalLength?.() || 0))
        gsap.fromTo(pathEl,
          { strokeDasharray: length, strokeDashoffset: length },
          { strokeDashoffset: 0, duration: changedFocus ? 0.85 : 0.48, ease: 'power2.out', clearProps: 'strokeDasharray,strokeDashoffset' })
      })
      const parkDots = svgEl.querySelectorAll('.park circle')
      if (parkDots.length) {
        gsap.fromTo(parkDots,
          { scale: 0.2, transformOrigin: '50% 50%' },
          { scale: 1, duration: 0.42, stagger: 0.035, ease: 'back.out(2)', clearProps: 'transform' })
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
  }, [view, mode, phase, countries, indiaStates, rivers, parks, activeContinent, activeRiverSystem, activeParkRegion, activePracticeRegion, activeParkState, activePracticeState, stateName, targetId, chosenId, history, onAnswer, onParkFocus])

  return (
    <div ref={wrapRef} className="atlas-map-canvas">
      <svg ref={svgRef} />
    </div>
  )
})
