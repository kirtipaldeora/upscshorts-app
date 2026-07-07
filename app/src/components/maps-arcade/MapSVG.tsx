import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { GeoPermissibleObjects } from 'd3-geo'
import type { QuizState } from '@/types/quiz'

interface MapSVGProps {
  geoData: GeoPermissibleObjects | null
  quizState: QuizState
  onFeatureClick: (featureId: string | number) => void
  colorScale?: (id: string | number) => string
}

export function MapSVG({ geoData, quizState, onFeatureClick, colorScale }: MapSVGProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !geoData) return

    const svg = d3.select(svgRef.current)
    const container = containerRef.current
    const { width, height } = container.getBoundingClientRect()

    svg.attr('width', width).attr('height', height)

    const projection = d3.geoMercator().fitSize([width, height], geoData as d3.ExtendedFeatureCollection)
    const pathGen = d3.geoPath().projection(projection)

    const { phase, selectedFeatureId, isCorrect, questions, currentIndex } = quizState
    const currentTarget = questions[currentIndex]?.targetFeatureId

    svg.selectAll('*').remove()

    const g = svg.append('g')

    // Zoom behaviour
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })
    svg.call(zoom)

    const features = (geoData as d3.ExtendedFeatureCollection).features ?? []

    g.selectAll('path')
      .data(features)
      .join('path')
      .attr('d', (d) => pathGen(d) ?? '')
      .attr('fill', (d) => {
        const id = d.id ?? d.properties?.id ?? ''
        if (phase === 'result') {
          if (String(id) === String(selectedFeatureId)) {
            return isCorrect ? '#4CAF82' : '#E36D6D'
          }
          if (String(id) === String(currentTarget)) {
            return '#F6D66B' // show correct answer in yellow
          }
        }
        return colorScale ? colorScale(id) : '#8E93D9'
      })
      .attr('stroke', (d) => {
        const id = d.id ?? d.properties?.id ?? ''
        if (phase === 'playing' && String(id) === String(currentTarget)) {
          return '#F6D66B' // pulse target
        }
        return '#fff'
      })
      .attr('stroke-width', (d) => {
        const id = d.id ?? d.properties?.id ?? ''
        if (phase === 'playing' && String(id) === String(currentTarget)) return 2.6
        return 0.5
      })
      .attr('class', (d) => {
        const id = d.id ?? d.properties?.id ?? ''
        if (phase === 'playing' && String(id) === String(currentTarget)) return 'qz-target'
        return ''
      })
      .style('cursor', phase === 'playing' ? 'pointer' : 'default')
      .style('transition', 'fill 0.2s, stroke 0.2s')
      .on('click', (_event, d) => {
        if (phase !== 'playing') return
        const id = d.id ?? d.properties?.id ?? ''
        onFeatureClick(id)
      })

  }, [geoData, quizState, onFeatureClick, colorScale])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 0 }}>
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  )
}
