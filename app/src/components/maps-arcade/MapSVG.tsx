import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { GeoPermissibleObjects } from 'd3-geo'
import type { QuizState } from '@/types/quiz'

export type FeatureKind = 'polygon' | 'line' | 'point'

interface MapSVGProps {
  geoData: GeoPermissibleObjects | null
  backdrop?: GeoPermissibleObjects | null   // non-interactive context layer (e.g. India outline)
  fitTo?: GeoPermissibleObjects | null      // what the projection frames (defaults to geoData)
  kind: FeatureKind
  quizState: QuizState
  onFeatureClick: (featureId: string | number) => void
}

const C = {
  base: '#aeb9ea',
  baseStroke: 'rgba(255,255,255,0.85)',
  backdrop: 'rgba(174,185,234,0.35)',
  backdropStroke: 'rgba(110,124,180,0.55)',
  line: '#5a8fd8',
  point: '#4f9d77',
  target: '#f0a43e',
  correct: '#2f9e6d',
  wrong: '#d5555f',
}

export function MapSVG({ geoData, backdrop, fitTo, kind, quizState, onFeatureClick }: MapSVGProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !geoData) return

    const svg = d3.select(svgRef.current)
    const { width, height } = containerRef.current.getBoundingClientRect()
    svg.attr('width', width).attr('height', height)

    const frame = (fitTo ?? geoData) as d3.ExtendedFeatureCollection
    const projection = d3.geoMercator().fitExtent([[12, 12], [width - 12, height - 12]], frame)
    const pathGen = d3.geoPath().projection(projection).pointRadius(7)

    const { phase, selectedFeatureId, isCorrect, questions, currentIndex } = quizState
    const target = questions[currentIndex]?.targetFeatureId

    svg.selectAll('*').remove()
    const g = svg.append('g')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 10])
      .on('zoom', (event) => { g.attr('transform', event.transform) })
    svg.call(zoom)

    // Context layer (never interactive)
    if (backdrop) {
      g.selectAll('.bk')
        .data((backdrop as d3.ExtendedFeatureCollection).features ?? [])
        .join('path')
        .attr('class', 'bk')
        .attr('d', (d) => pathGen(d) ?? '')
        .attr('fill', C.backdrop)
        .attr('stroke', C.backdropStroke)
        .attr('stroke-width', 0.8)
    }

    const idOf = (d: d3.ExtendedFeature) => String(d.id ?? (d.properties as { id?: string })?.id ?? '')
    const stateFill = (d: d3.ExtendedFeature): string => {
      const id = idOf(d)
      if (phase === 'result') {
        if (id === String(selectedFeatureId)) return isCorrect ? C.correct : C.wrong
        if (id === String(target)) return C.correct
      }
      return kind === 'point' ? C.point : C.base
    }
    const stateStroke = (d: d3.ExtendedFeature): string => {
      const id = idOf(d)
      if (phase === 'result') {
        if (id === String(selectedFeatureId)) return isCorrect ? C.correct : C.wrong
        if (id === String(target)) return C.correct
      }
      return kind === 'line' ? C.line : C.baseStroke
    }

    const features = (geoData as d3.ExtendedFeatureCollection).features ?? []
    const sel = g.selectAll('.ft')
      .data(features)
      .join('path')
      .attr('class', 'ft')
      .attr('d', (d) => pathGen(d) ?? '')
      .style('cursor', phase === 'playing' ? 'pointer' : 'default')
      .on('click', (_e, d) => { if (phase === 'playing') onFeatureClick(idOf(d)) })

    if (kind === 'line') {
      sel
        .attr('fill', 'none')
        .attr('stroke', stateStroke)
        .attr('stroke-width', (d) => (phase === 'result' && (idOf(d) === String(selectedFeatureId) || idOf(d) === String(target)) ? 4.5 : 2.2))
        .attr('stroke-linecap', 'round')
    } else {
      sel
        .attr('fill', stateFill)
        .attr('stroke', kind === 'point' ? 'rgba(255,255,255,0.9)' : C.baseStroke)
        .attr('stroke-width', kind === 'point' ? 1.4 : 0.5)
    }

    // Invisible fat hit-area on top of thin lines so rivers are tappable
    if (kind === 'line') {
      g.selectAll('.hit')
        .data(features)
        .join('path')
        .attr('class', 'hit')
        .attr('d', (d) => pathGen(d) ?? '')
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 14)
        .style('cursor', phase === 'playing' ? 'pointer' : 'default')
        .on('click', (_e, d) => { if (phase === 'playing') onFeatureClick(idOf(d)) })
    }
  }, [geoData, backdrop, fitTo, kind, quizState, onFeatureClick])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 0 }}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
    </div>
  )
}
