import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import type { Topology } from 'topojson-specification'
import type { AtlasState, QuizItem } from '@/types/quiz'
import {
  CONT_COLOR, CONT_DATA, CONT_ORDER, PALETTE,
  RIVERS, RIVER_COLOR, OCEAN_COLOR, GREEN, WORLD_TOPO_URL,
  PARK_COLOR,
} from './atlasData'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AtlasMapHandle {
  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void
}

interface Props {
  atlasState: AtlasState
  parks: QuizItem[]
  onAnswer: (id: string | number) => void
  onReady?: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const W = 1000, H = 548
const INDIA_ID = 356

// build idToCont map from CONT_DATA
const ID_TO_CONT: Record<number, string> = {}
Object.entries(CONT_DATA).forEach(([cont, entries]) => {
  entries.forEach(([id]) => { ID_TO_CONT[id] = cont })
})

// ─── Mutable state accessible from D3 event handlers ─────────────────────────
// (avoids stale closures without re-binding D3 events on every render)
interface LiveRefs {
  atlasState: AtlasState
  onAnswer: (id: string | number) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AtlasMap = forwardRef<AtlasMapHandle, Props>(function AtlasMap(
  { atlasState, parks, onAnswer, onReady },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)

  const live = useRef<LiveRefs>({ atlasState, onAnswer })
  live.current = { atlasState, onAnswer }

  // Internal D3 objects
  const d3Ref = useRef<{
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
    g: d3.Selection<SVGGElement, unknown, null, undefined>
    zoom: d3.ZoomBehavior<SVGSVGElement, unknown>
    proj: d3.GeoProjection
    pathGen: d3.GeoPath
    gCountries: d3.Selection<SVGPathElement, d3.GeoPermissibleObjects, SVGGElement, unknown>
    gIndia: d3.Selection<SVGGElement, unknown, null, undefined>
    gRivers: d3.Selection<SVGGElement, unknown, null, undefined>
    gRiverLabels: d3.Selection<SVGGElement, unknown, null, undefined>
    gParks: d3.Selection<SVGGElement, unknown, null, undefined>
    riverClipPath: d3.Selection<SVGPathElement, unknown, null, undefined>
    indiaFeat: d3.GeoPermissibleObjects | null
  } | null>(null)

  // ─── Expose zoom controls ─────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    zoomIn() {
      const r = d3Ref.current
      if (!r) return
      r.svg.transition().duration(300).call(r.zoom.scaleBy, 1.5)
    },
    zoomOut() {
      const r = d3Ref.current
      if (!r) return
      r.svg.transition().duration(300).call(r.zoom.scaleBy, 1 / 1.5)
    },
    zoomReset() {
      const r = d3Ref.current
      if (!r) return
      r.svg.transition().duration(300).call(r.zoom.transform, d3.zoomIdentity)
    },
  }))

  // ─── One-time map init ────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el || d3Ref.current) return

    async function init() {
      const res = await fetch(WORLD_TOPO_URL)
      const topo = await res.json() as Topology
      const feats = (topojson.feature(topo, topo.objects.countries) as d3.ExtendedFeatureCollection)
        .features.filter((f: d3.ExtendedFeature) => String(f.id) !== '10') as d3.GeoPermissibleObjects[]

      const fc: d3.ExtendedFeatureCollection = {
        type: 'FeatureCollection',
        features: feats as d3.ExtendedFeature[],
      }
      const indiaFeature = feats.find((f) => featId(f) === INDIA_ID) ?? null

      const proj = d3.geoNaturalEarth1().fitExtent([[14, 10], [W - 14, H - 10]], fc)
      const pathGen = d3.geoPath(proj)

      // SVG root
      const svg = d3.select(el).append<SVGSVGElement>('svg')
        .attr('viewBox', `0 0 ${W} ${H}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', '100%')
        .style('display', 'block')
        .style('cursor', 'grab')

      // River clip path
      const clipId = `india-clip-${Math.random().toString(36).slice(2)}`
      const riverClipPath = svg.append('defs').append('clipPath').attr('id', clipId)
        .append<SVGPathElement>('path')

      const g = svg.append<SVGGElement>('g')

      // Ocean background
      g.append('rect')
        .attr('x', -3000).attr('y', -3000)
        .attr('width', W + 6000).attr('height', H + 6000)
        .attr('fill', OCEAN_COLOR)

      // Country paths
      const gCountries = g.selectAll<SVGPathElement, d3.GeoPermissibleObjects>('path.country')
        .data(feats)
        .join<SVGPathElement>('path')
        .attr('class', 'country')
        .attr('d', (d) => pathGen(d) ?? '')
        .attr('fill', (d) => baseFill(featId(d)))
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 0.7)
        .attr('stroke-linejoin', 'round')
        .style('transition', 'fill .12s')
        .on('mouseover', function(_, d) {
          const { atlasState: st } = live.current
          if (st.screen !== 'play' || st.answeredThisRound || st.category !== 'world') return
          const id = featId(d)
          if (ID_TO_CONT[id] !== st.continent) return
          d3.select(this).attr('fill', '#FFD27A')
        })
        .on('mouseout', function(_, d) {
          const id = featId(d)
          d3.select(this).attr('fill', baseFill(id))
        })
        .on('click', (_, d) => {
          const { atlasState: st, onAnswer: cb } = live.current
          if (st.screen !== 'play' || st.answeredThisRound || st.category !== 'world') return
          const id = featId(d)
          if (ID_TO_CONT[id] !== st.continent) return
          cb(id)
        })

      // India state overlay
      const gIndia = g.append<SVGGElement>('g').attr('id', 'india-states').style('display', 'none')

      // Rivers layer
      const gRivers = g.append<SVGGElement>('g').attr('id', 'rivers')
        .attr('clip-path', `url(#${clipId})`).style('display', 'none')

      RIVERS.forEach(r => {
        if (!r.geo) return
        const coords = r.geo.coordinates as [number, number][]
        const geom: d3.GeoPermissibleObjects = { type: 'LineString', coordinates: coords } as unknown as d3.GeoPermissibleObjects
        const dStr = pathGen(geom) ?? ''

        // Invisible hit target
        gRivers.append('path')
          .attr('data-rid', String(r.id))
          .attr('d', dStr)
          .attr('fill', 'none')
          .attr('stroke', 'rgba(0,0,0,0)')
          .attr('stroke-width', 14)
          .attr('stroke-linecap', 'round')
          .style('cursor', 'pointer')
          .on('click', () => {
            const { atlasState: st, onAnswer: cb } = live.current
            if (st.screen !== 'play' || st.answeredThisRound || st.category !== 'india-rivers') return
            cb(r.id)
          })

        // Visible river line
        gRivers.append('path')
          .attr('data-rid', String(r.id))
          .attr('class', 'river-vis')
          .attr('d', dStr)
          .attr('fill', 'none')
          .attr('stroke', RIVER_COLOR)
          .attr('stroke-width', r.major ? 3.2 : 2)
          .attr('stroke-linecap', 'round')
          .attr('stroke-linejoin', 'round')
          .attr('opacity', r.major ? 1 : 0.82)
          .style('pointer-events', 'none')
      })

      // River labels
      const gRiverLabels = g.append<SVGGElement>('g').attr('id', 'river-labels')
        .attr('clip-path', `url(#${clipId})`).style('display', 'none').style('pointer-events', 'none')

      RIVERS.forEach(r => {
        const lbl = r.label
        if (!lbl) return
        const xy = proj(lbl.point)
        if (!xy) return
        gRiverLabels.append('text')
          .attr('x', xy[0]).attr('y', xy[1])
          .attr('transform', `rotate(${-lbl.angle}, ${xy[0]}, ${xy[1]})`)
          .attr('font-family', 'Fredoka, sans-serif').attr('font-weight', 700)
          .attr('font-size', lbl.size ?? 10.5)
          .attr('fill', '#24435F').attr('paint-order', 'stroke')
          .attr('stroke', '#FFF8E8').attr('stroke-width', 3.2).attr('stroke-linejoin', 'round')
          .attr('text-anchor', 'middle')
          .text(lbl.name ?? r.name.toUpperCase())
      })

      // Parks group
      const gParks = g.append<SVGGElement>('g').attr('id', 'parks').style('display', 'none')

      // Zoom behaviour
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 12])
        .translateExtent([[0, 0], [W, H]])
        .extent([[0, 0], [W, H]])
        .on('zoom', (e: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
          g.attr('transform', e.transform.toString())
        })
      svg.call(zoom).on('dblclick.zoom', null)

      d3Ref.current = {
        svg, g, zoom, proj, pathGen, gCountries,
        gIndia, gRivers, gRiverLabels, gParks, riverClipPath, indiaFeat: indiaFeature,
      }
      if (indiaFeature) riverClipPath.datum(indiaFeature).attr('d', pathGen)

      // Load India states in background
      loadIndiaStates(gIndia, pathGen, (feat) => {
        if (d3Ref.current) {
          d3Ref.current.indiaFeat = d3Ref.current.indiaFeat ?? feat
          riverClipPath.datum(d3Ref.current.indiaFeat).attr('d', pathGen)
        }
      }, (feat) => {
        const { atlasState: st, onAnswer: cb } = live.current
        if (st.screen !== 'play' || st.answeredThisRound || st.category !== 'india-parks' || st.playMode !== 'locate') return
        cb(normalizeStateName(featureName(feat)))
      })

      onReady?.()
      applyVisuals()
    }

    init().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Re-apply visuals whenever props change ───────────────────────────────
  useEffect(() => {
    if (!d3Ref.current) return
    applyVisuals()
  })

  function applyVisuals() {
    const r = d3Ref.current
    if (!r) return
    const st = atlasState

    // ── Layer visibility ──────────────────────────────────────────────────────
    const isIndia = st.category === 'india-rivers' || st.category === 'india-parks'
    const showRivers = st.category === 'india-rivers' && (st.screen === 'play' || st.screen === 'riverSystems' || st.screen === 'setup')
    const showParks = st.category === 'india-parks' && (st.screen === 'play' || st.screen === 'parkLearn' || st.screen === 'parkRegions' || st.screen === 'setup')

    r.gIndia.style('display', isIndia ? '' : 'none')
    r.gRivers.style('display', showRivers ? '' : 'none')
    r.gRiverLabels.style('display', showRivers ? '' : 'none')
    r.gParks.style('display', showParks ? '' : 'none')

    // ── Country fills ─────────────────────────────────────────────────────────
    const targetId = st.target ? String(st.target.id) : null
    r.gCountries
      .attr('fill', (d) => {
        const id = featId(d)
        const sid = String(id)
        if (st.screen === 'play' && st.answeredThisRound && targetId && sid === targetId) return GREEN
        if (st.category === 'world' && st.continent && ID_TO_CONT[id] !== st.continent) {
          return PALETTE[Math.max(0, CONT_ORDER.indexOf(st.continent)) % PALETTE.length] + '44'
        }
        return baseFill(id)
      })
      .attr('class', (d) => {
        const sid = String(featId(d))
        if (st.screen === 'play' && !st.answeredThisRound && targetId && sid === targetId) return 'country qz-target'
        return 'country'
      })
      .style('pointer-events', (d) => {
        if (st.category !== 'world' || st.screen !== 'play') return 'none'
        const id = featId(d)
        return ID_TO_CONT[id] === st.continent ? 'auto' : 'none'
      })

    // ── India state fills / answerability ─────────────────────────────────────
    const targetStateKey = st.target?.state ? normalizeStateName(st.target.state) : null
    const chosenStateKey = normalizeStateName(st.chosenId ?? '')
    r.gIndia.selectAll<SVGPathElement, d3.GeoPermissibleObjects>('path.india-state')
      .attr('fill', (d) => {
        const key = normalizeStateName(featureName(d))
        if (st.category === 'india-parks' && st.screen === 'play' && st.answeredThisRound) {
          if (targetStateKey && key === targetStateKey) return GREEN
          if (chosenStateKey && key === chosenStateKey) return '#FF9B9F'
        }
        return '#FFEFD8'
      })
      .attr('stroke', (d) => {
        const key = normalizeStateName(featureName(d))
        if (st.category === 'india-parks' && st.screen === 'play' && targetStateKey && key === targetStateKey && st.answeredThisRound) return '#15784E'
        return '#9E7A4E'
      })
      .attr('stroke-width', (d) => {
        const key = normalizeStateName(featureName(d))
        return st.category === 'india-parks' && st.screen === 'play' && targetStateKey && key === targetStateKey && st.answeredThisRound ? 1.4 : 0.55
      })
      .style('pointer-events', st.category === 'india-parks' && st.screen === 'play' && st.playMode === 'locate' && !st.answeredThisRound ? 'auto' : 'none')
      .style('cursor', st.category === 'india-parks' && st.screen === 'play' && st.playMode === 'locate' && !st.answeredThisRound ? 'pointer' : 'default')

    // ── River highlights ──────────────────────────────────────────────────────
    if (showRivers) {
      r.gRivers.selectAll<SVGPathElement, unknown>('path.river-vis').each(function() {
        const rid = this.getAttribute('data-rid') ?? ''
        if (targetId && rid === targetId && st.answeredThisRound) {
          d3.select(this).attr('stroke', GREEN).attr('stroke-width', 4).attr('class', 'river-vis')
        } else if (targetId && rid === targetId && !st.answeredThisRound) {
          d3.select(this).attr('stroke', '#FFB020').attr('stroke-width', 3.5).attr('class', 'river-vis qz-target')
        } else {
          const rv = RIVERS.find(x => String(x.id) === rid)
          d3.select(this).attr('stroke', RIVER_COLOR).attr('stroke-width', rv?.major ? 3.2 : 2).attr('class', 'river-vis')
        }
      })
    }

    // ── Park markers ─────────────────────────────────────────────────────────
    if (showParks) {
      renderParks(r.gParks, r.proj, parks, st, onAnswer)
    }

    // ── Fit India view on enter ───────────────────────────────────────────────
    if (isIndia && st.screen === 'play') {
      const INDIA_BOUNDS: [[number,number],[number,number]] = [[65, 6], [98, 38]]
      const p1 = r.proj([INDIA_BOUNDS[0][0], INDIA_BOUNDS[1][1]])
      const p2 = r.proj([INDIA_BOUNDS[1][0], INDIA_BOUNDS[0][1]])
      if (p1 && p2) {
        const dx = p2[0] - p1[0], dy = p2[1] - p1[1]
        const scale = Math.min(W / dx, H / dy) * 0.85
        const tx = (W - scale * (p1[0] + p2[0])) / 2
        const ty = (H - scale * (p1[1] + p2[1])) / 2
        r.svg.call(r.zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
      }
    }

    // ── Update river clip ─────────────────────────────────────────────────────
    if (r.indiaFeat) {
      r.riverClipPath.datum(r.indiaFeat).attr('d', r.pathGen)
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  )
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function featId(d: d3.GeoPermissibleObjects): number {
  return +((d as {id?: unknown}).id as number) || 0
}

function baseFill(id: number): string {
  const cont = ID_TO_CONT[id]
  if (cont && CONT_COLOR[cont]) return lighten(CONT_COLOR[cont], 0.52)
  return '#D6CFC2'
}

function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`
}

// ─── India state loader ───────────────────────────────────────────────────────

async function loadIndiaStates(
  gIndia: d3.Selection<SVGGElement, unknown, null, undefined>,
  pathGen: d3.GeoPath,
  onLoaded: (feat: d3.GeoPermissibleObjects) => void,
  onStateClick: (feat: d3.GeoPermissibleObjects) => void,
) {
  const SOURCES = [
    '/data/india-states.json',
  ]
  for (const url of SOURCES) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const gj: { features: d3.GeoPermissibleObjects[] } = await res.json()
      const feats = (gj.features ?? []).filter((f) => (f as {geometry?:unknown}).geometry)
      if (!feats.length) continue
      gIndia.selectAll<SVGPathElement, d3.GeoPermissibleObjects>('path')
        .data(feats)
        .join('path')
        .attr('class', 'india-state')
        .attr('data-state', (d) => normalizeStateName(featureName(d)))
        .attr('d', (d) => pathGen(d) ?? '')
        .attr('fill', '#FFEFD8')
        .attr('stroke', '#9E7A4E')
        .attr('stroke-width', 0.55)
        .attr('stroke-linejoin', 'round')
        .style('pointer-events', 'none')
        .style('transition', 'fill .12s, stroke .12s')
        .on('mouseover', function(_, d) {
          const el = d3.select(this)
          if (el.style('pointer-events') !== 'auto') return
          el.attr('fill', '#FFD27A')
        })
        .on('mouseout', function(_, d) {
          const el = d3.select(this)
          if (el.style('pointer-events') !== 'auto') return
          el.attr('fill', '#FFEFD8')
        })
        .on('click', (_, d) => onStateClick(d))
      // Build a union bounding box feature for clip path — use India country feat fallback
      // We just signal success; caller attaches it to clip when a world feat is found
      onLoaded(feats[0]) // approximate; real clip comes from world feat
      return
    } catch { /* try next */ }
  }
}

// ─── Park marker renderer ─────────────────────────────────────────────────────

function renderParks(
  gParks: d3.Selection<SVGGElement, unknown, null, undefined>,
  proj: d3.GeoProjection,
  parks: QuizItem[],
  st: AtlasState,
  onAnswer: (id: string | number) => void,
) {
  gParks.selectAll('*').remove()
  const targetId = st.target ? String(st.target.id) : null
  const answerable = st.screen === 'play' && st.category !== 'india-parks' && !st.answeredThisRound

  parks.forEach(p => {
    if (p.lon == null || p.lat == null) return
    const xy = proj([p.lon, p.lat])
    if (!xy) return
    const isTarget = String(p.id) === targetId && st.screen === 'play'
    const color = PARK_COLOR

    const group = gParks.append('g')
      .attr('transform', `translate(${xy[0]},${xy[1]})`)
      .style('cursor', answerable ? 'pointer' : 'default')
      .on('click', () => {
        if (answerable) onAnswer(p.id)
      })

    group.append('circle').attr('r', 7)
      .attr('fill', '#fff').attr('stroke', color).attr('stroke-width', 2)
      .attr('class', isTarget ? 'qz-rtarget' : '')

    group.append('circle').attr('r', 4).attr('fill', color).attr('opacity', 0.9)

    if (st.screen === 'parkLearn') {
      group.append('text')
        .attr('y', -12).attr('text-anchor', 'middle')
        .attr('font-family', 'Fredoka, sans-serif').attr('font-weight', 600).attr('font-size', 10)
        .attr('fill', '#21432B').attr('paint-order', 'stroke').attr('stroke', '#fff').attr('stroke-width', 3)
        .text(p.name.replace(/ National Park$/, ''))
    }

    if (st.screen === 'play' && isTarget) {
      group.append('text')
        .attr('y', -12).attr('text-anchor', 'middle')
        .attr('font-family', 'Fredoka, sans-serif').attr('font-weight', 700).attr('font-size', 10)
        .attr('fill', '#21432B').attr('paint-order', 'stroke').attr('stroke', '#fff').attr('stroke-width', 3)
        .text(p.name.replace(/ National Park$/, ''))
    }
  })
}

function featureName(d: d3.GeoPermissibleObjects): string {
  const props = (d as { properties?: Record<string, unknown> }).properties ?? {}
  return String(
    props.ST_NM ??
    props.NAME_1 ??
    props.NAME ??
    props.name ??
    props.state ??
    props.State_Name ??
    ''
  )
}

function normalizeStateName(value: string | number | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\bislands\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
