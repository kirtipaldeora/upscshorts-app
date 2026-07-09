import { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'
import Globe from 'globe.gl'
import type { GlobeInstance } from 'globe.gl'
import { gsap, reducedMotion } from '@/anim/animations'
import type { AtlasCountry, AtlasMode, AtlasPhase, AtlasView } from './MapSVG'
import type { WorldPhysicalFeature } from './MapsArcade'

type GlobeGeoJsonGeometry = { type: string; coordinates: number[] }

type GlobeWithLayers = GlobeInstance & {
  polygonsData: (data: object[]) => GlobeWithLayers
  polygonGeoJsonGeometry: (fn: (d: object) => GlobeGeoJsonGeometry) => GlobeWithLayers
  polygonCapColor: (fn: (d: object) => string) => GlobeWithLayers
  polygonSideColor: (fn: (d: object) => string) => GlobeWithLayers
  polygonStrokeColor: (fn: (d: object) => string) => GlobeWithLayers
  polygonAltitude: (fn: (d: object) => number) => GlobeWithLayers
  polygonsTransitionDuration: (ms: number) => GlobeWithLayers
  pointsData: (data: object[]) => GlobeWithLayers
  pointLat: (fn: (d: object) => number) => GlobeWithLayers
  pointLng: (fn: (d: object) => number) => GlobeWithLayers
  pointColor: (fn: (d: object) => string) => GlobeWithLayers
  pointAltitude: (fn: (d: object) => number) => GlobeWithLayers
  pointRadius: (fn: (d: object) => number) => GlobeWithLayers
  pointsMerge: (merge: boolean) => GlobeWithLayers
  ringsData: (data: object[]) => GlobeWithLayers
  ringLat: (fn: (d: object) => number) => GlobeWithLayers
  ringLng: (fn: (d: object) => number) => GlobeWithLayers
  ringColor: (fn: (d: object) => (t: number) => string) => GlobeWithLayers
  ringMaxRadius: (fn: (d: object) => number) => GlobeWithLayers
  ringPropagationSpeed: (speed: number) => GlobeWithLayers
  ringRepeatPeriod: (ms: number) => GlobeWithLayers
  htmlElementsData: (data: object[]) => GlobeWithLayers
  htmlLat: (fn: (d: object) => number) => GlobeWithLayers
  htmlLng: (fn: (d: object) => number) => GlobeWithLayers
  htmlAltitude: (fn: (d: object) => number) => GlobeWithLayers
  htmlElement: (fn: (d: object) => HTMLElement) => GlobeWithLayers
  htmlElementVisibilityModifier: (fn: (el: HTMLElement, visible: boolean) => void) => GlobeWithLayers
  pathsData: (data: object[]) => GlobeWithLayers
  pathPoints: (fn: (d: object) => [number, number][]) => GlobeWithLayers
  pathPointLat: (fn: (p: [number, number]) => number) => GlobeWithLayers
  pathPointLng: (fn: (p: [number, number]) => number) => GlobeWithLayers
  pathPointAlt: (fn: (p: [number, number]) => number) => GlobeWithLayers
  pathLabel: (fn: (d: object) => string) => GlobeWithLayers
  pathColor: (fn: (d: object) => string | string[]) => GlobeWithLayers
  pathStroke: (fn: (d: object) => number) => GlobeWithLayers
  pathDashLength: (fn: (d: object) => number) => GlobeWithLayers
  pathDashGap: (fn: (d: object) => number) => GlobeWithLayers
  pathDashAnimateTime: (fn: (d: object) => number) => GlobeWithLayers
  onPathClick: (fn: (d: object) => void) => GlobeWithLayers
}

interface AtlasGlobeProps {
  view: AtlasView
  mode: AtlasMode
  phase: AtlasPhase
  countries: AtlasCountry[]
  physicalFeatures: WorldPhysicalFeature[]
  physicalKind: 'river' | 'mountain' | null
  activeContinent: string | null
  targetId: string | number | null
  chosenId: string | number | null
  onAnswer: (id: string | number) => void
}

interface GlobeCountry extends AtlasCountry {
  lat: number
  lng: number
}

interface GlobeMarker {
  id: string
  lat: number
  lng: number
  label: string
  name: string
  kind: 'target' | 'chosen' | 'hint'
}

interface PhysicalNode {
  id: string
  featureId: string
  lat: number
  lng: number
  label: string
  name: string
  primary?: boolean
  kind: 'river-node' | 'mountain-node' | 'target' | 'chosen' | 'hint'
}

const COUNTRY_PALETTE = [
  '#4f8fc7',
  '#4fae83',
  '#d08b45',
  '#b879cf',
  '#d86274',
  '#48a9aa',
  '#c6a044',
  '#7f93df',
  '#73a84e',
  '#d17655',
  '#53a0d8',
  '#c35f9a',
]

const CONTINENT_POV: Record<string, { lat: number; lng: number; altitude: number }> = {
  Africa: { lat: 1, lng: 20, altitude: 0.92 },
  Europe: { lat: 53, lng: 12, altitude: 0.78 },
  Asia: { lat: 33, lng: 83, altitude: 0.98 },
  'North America': { lat: 43, lng: -101, altitude: 0.92 },
  'South America': { lat: -20, lng: -61, altitude: 0.88 },
  Oceania: { lat: -22, lng: 145, altitude: 0.84 },
}

type GlobeControls = {
  autoRotate: boolean
  autoRotateSpeed: number
  enableDamping: boolean
  enableZoom: boolean
  enableRotate?: boolean
  rotateSpeed?: number
  minDistance: number
  maxDistance: number
}

function centroid(country: AtlasCountry): [number, number] {
  const c = d3.geoCentroid(country.feature as never)
  return [Number.isFinite(c[0]) ? c[0] : 0, Number.isFinite(c[1]) ? c[1] : 0]
}

function shortName(name: string): string {
  return name.length > 18 ? `${name.slice(0, 17)}...` : name
}

function countryFill(country: AtlasCountry): string {
  return COUNTRY_PALETTE[Math.abs(country.id * 11 + country.name.length * 7) % COUNTRY_PALETTE.length]
}

function featureMidpoint(feature: WorldPhysicalFeature): [number, number] {
  if (feature.labelPoint) return feature.labelPoint
  return feature.coordinates[Math.floor(feature.coordinates.length / 2)] ?? [0, 0]
}

function physicalColor(feature: WorldPhysicalFeature, active: boolean, selected: boolean): string {
  if (feature.kind === 'river') return selected ? '#5fe4ff' : active ? '#44c7f4' : '#2f8bad'
  return selected ? '#ffd36d' : active ? '#f3b13f' : '#a87930'
}

export function AtlasGlobe({
  view,
  mode,
  phase,
  countries,
  physicalFeatures,
  physicalKind,
  activeContinent,
  targetId,
  chosenId,
  onAnswer,
}: AtlasGlobeProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeWithLayers | null>(null)
  const povKeyRef = useRef<string>('')

  const globeCountries = useMemo<GlobeCountry[]>(() => {
    return countries.map(country => {
      const [lng, lat] = centroid(country)
      return { ...country, lat, lng }
    })
  }, [countries])

  const visiblePhysical = useMemo(() => {
    return physicalKind
      ? physicalFeatures.filter(feature => feature.kind === physicalKind && (!activeContinent || feature.continent === activeContinent))
      : []
  }, [activeContinent, physicalFeatures, physicalKind])

  useEffect(() => {
    const el = wrapRef.current
    if (!el || globeRef.current) return
    const world = new Globe(el) as GlobeWithLayers
    world
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor('#9fb7ff')
      .atmosphereAltitude(0.18)
      .width(el.clientWidth)
      .height(el.clientHeight)

    const material = world.globeMaterial() as unknown as {
      color: { set: (value: string) => void }
      emissive?: { set: (value: string) => void }
      shininess?: number
    }
    material.color.set('#113858')
    material.emissive?.set('#071b2f')
    if ('shininess' in material) material.shininess = 7

    const controls = world.controls() as GlobeControls
    controls.autoRotate = false
    controls.autoRotateSpeed = 0
    controls.enableDamping = true
    controls.enableZoom = true
    controls.enableRotate = true
    controls.rotateSpeed = 0.16
    controls.minDistance = 120
    controls.maxDistance = 470

    try { world.renderer().setPixelRatio(Math.min(2, window.devicePixelRatio || 1)) } catch { /* noop */ }
    globeRef.current = world

    if (!reducedMotion()) {
      gsap.fromTo(el, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.75, ease: 'power3.out', clearProps: 'transform,opacity' })
    }

    return () => {
      const instance = globeRef.current as (GlobeWithLayers & { _destructor?: () => void }) | null
      try { instance?._destructor?.() } catch { /* noop */ }
      globeRef.current = null
    }
  }, [])

  useEffect(() => {
    const onResize = () => {
      const globe = globeRef.current
      const el = wrapRef.current
      if (globe && el) {
        globe.width(el.clientWidth)
        globe.height(el.clientHeight)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    const controls = globe.controls() as GlobeControls
    const focused = view === 'continent' || phase === 'playing' || phase === 'answered'
    controls.autoRotate = false
    controls.autoRotateSpeed = 0
    controls.rotateSpeed = focused ? 0.1 : 0.18
    controls.enableRotate = true
  }, [phase, view])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    const isPhysical = view === 'world-physical'
    const answerable = phase === 'playing' && mode === 'locate' && view === 'continent'
    const physicalAnswerable = phase === 'playing' && mode === 'locate' && isPhysical
    const target = globeCountries.find(c => String(c.id) === String(targetId))
    const chosen = globeCountries.find(c => String(c.id) === String(chosenId))
    const targetPhysical = visiblePhysical.find(feature => String(feature.id) === String(targetId))
    const chosenPhysical = visiblePhysical.find(feature => String(feature.id) === String(chosenId))

    const countryColor = (country: GlobeCountry) => {
      if (isPhysical) return 'rgba(55,103,83,0.5)'
      const isTarget = String(country.id) === String(targetId)
      const isChosen = String(country.id) === String(chosenId)
      if (phase === 'answered') {
        if (isChosen) return isTarget ? '#35c88c' : '#f05f73'
        if (isTarget) return '#35c88c'
      }
      if (phase === 'playing' && mode === 'name' && isTarget) return '#f4b63f'
      if (view === 'continent' && activeContinent && country.continent !== activeContinent) return 'rgba(110,128,138,0.28)'
      return countryFill(country)
    }

    globe
      .polygonsData(globeCountries as unknown as object[])
      .polygonGeoJsonGeometry((d) => (d as GlobeCountry).feature.geometry as unknown as GlobeGeoJsonGeometry)
      .polygonCapColor((d) => countryColor(d as GlobeCountry))
      .polygonSideColor((d) => {
        const country = d as GlobeCountry
        if (isPhysical) return 'rgba(11,42,46,0.34)'
        return view === 'continent' && activeContinent && country.continent !== activeContinent
          ? 'rgba(28,48,58,0.18)'
          : 'rgba(12,42,52,0.62)'
      })
      .polygonStrokeColor((d) => {
        const country = d as GlobeCountry
        const isAnswer = String(country.id) === String(targetId) || String(country.id) === String(chosenId)
        return isAnswer ? 'rgba(255,255,255,0.9)' : isPhysical ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.24)'
      })
      .polygonAltitude((d) => {
        const country = d as GlobeCountry
        const isAnswer = String(country.id) === String(targetId) || String(country.id) === String(chosenId)
        if (isPhysical) return 0.006
        if (phase === 'answered' && isAnswer) return 0.055
        if (phase === 'playing' && mode === 'name' && String(country.id) === String(targetId)) return 0.045
        return view === 'continent' && activeContinent && country.continent !== activeContinent ? 0.004 : 0.018
      })
      .polygonsTransitionDuration(reducedMotion() ? 0 : 450)
      .polygonLabel(() => '')
      .onPolygonClick((d) => {
        const country = d as GlobeCountry
        if (answerable && country.continent === activeContinent) onAnswer(country.id)
      })
      .showPointerCursor((kind, d) => {
        const country = d as GlobeCountry | undefined
        if (kind === 'path' && physicalAnswerable) return true
        return kind === 'polygon' && Boolean(answerable && country?.continent === activeContinent)
      })

    const pathGlobe = globe as GlobeWithLayers
    pathGlobe.pathsData(isPhysical ? visiblePhysical as unknown as object[] : [])
    pathGlobe.pathPoints((d: object) => (d as WorldPhysicalFeature).coordinates)
    pathGlobe.pathPointLat((p) => p[1])
    pathGlobe.pathPointLng((p) => p[0])
    pathGlobe.pathPointAlt(() => physicalKind === 'mountain' ? 0.034 : 0.026)
    pathGlobe.pathLabel(() => '')
    pathGlobe.pathColor((d: object) => {
      const feature = d as WorldPhysicalFeature
      const isTarget = String(feature.id) === String(targetId)
      const isChosen = String(feature.id) === String(chosenId)
      const selected = phase === 'answered' && (isTarget || isChosen)
      const active = phase !== 'playing' || (mode === 'name' && isTarget)
      return physicalColor(feature, active, selected)
    })
    pathGlobe.pathStroke((d: object) => (d as WorldPhysicalFeature).kind === 'mountain' ? 3.4 : 4.2)
    pathGlobe.pathDashLength((d: object) => (d as WorldPhysicalFeature).kind === 'river' ? 0.72 : 0.34)
    pathGlobe.pathDashGap((d: object) => (d as WorldPhysicalFeature).kind === 'river' ? 0.14 : 0.08)
    pathGlobe.pathDashAnimateTime((d: object) => reducedMotion() ? 0 : (d as WorldPhysicalFeature).kind === 'river' ? 2400 : 4200)
    pathGlobe.onPathClick((d: object) => {
      if (physicalAnswerable) onAnswer((d as WorldPhysicalFeature).id)
    })

    const markers: GlobeMarker[] = []
    if (phase === 'playing' && mode === 'name' && target) {
      markers.push({ id: `hint-${target.id}`, lat: target.lat, lng: target.lng, label: 'Highlighted', name: 'Which country?', kind: 'hint' })
    }
    if (phase === 'answered' && target) {
      markers.push({ id: `target-${target.id}`, lat: target.lat, lng: target.lng, label: 'Answer', name: target.name, kind: 'target' })
    }
    if (phase === 'answered' && chosen && String(chosen.id) !== String(targetId)) {
      markers.push({ id: `chosen-${chosen.id}`, lat: chosen.lat, lng: chosen.lng, label: 'Your pick', name: chosen.name, kind: 'chosen' })
    }

    if (isPhysical) {
      const physicalNodes: PhysicalNode[] = visiblePhysical.flatMap(feature => {
        const [lng, lat] = featureMidpoint(feature)
        const mainNode: PhysicalNode = {
          id: `node-${feature.id}`,
          featureId: feature.id,
          lat,
          lng,
          label: feature.kind === 'river' ? 'River' : 'Range',
          name: phase === 'browse' || phase === 'learn' || phase === 'results' ? feature.name : '',
          primary: true,
          kind: feature.kind === 'river' ? 'river-node' : 'mountain-node',
        }
        if (feature.kind === 'river') return [mainNode]
        return [
          mainNode,
          ...feature.coordinates.map(([ridgeLng, ridgeLat], ridgeIndex) => ({
            id: `ridge-${feature.id}-${ridgeIndex}`,
            featureId: feature.id,
            lat: ridgeLat,
            lng: ridgeLng,
            label: 'Ridge',
            name: '',
            kind: 'mountain-node' as const,
          })),
        ]
      })
      const feedbackNodes: PhysicalNode[] = []
      if (phase === 'playing' && mode === 'name' && targetPhysical) {
        const [lng, lat] = featureMidpoint(targetPhysical)
        feedbackNodes.push({ id: `hint-${targetPhysical.id}`, featureId: targetPhysical.id, lat, lng, label: 'Highlighted', name: 'Which feature?', kind: 'hint' })
      }
      if (phase === 'answered' && targetPhysical) {
        const [lng, lat] = featureMidpoint(targetPhysical)
        feedbackNodes.push({ id: `target-${targetPhysical.id}`, featureId: targetPhysical.id, lat, lng, label: 'Answer', name: targetPhysical.name, kind: 'target' })
      }
      if (phase === 'answered' && chosenPhysical && String(chosenPhysical.id) !== String(targetId)) {
        const [lng, lat] = featureMidpoint(chosenPhysical)
        feedbackNodes.push({ id: `chosen-${chosenPhysical.id}`, featureId: chosenPhysical.id, lat, lng, label: 'Your pick', name: chosenPhysical.name, kind: 'chosen' })
      }

      globe
        .pointsData(feedbackNodes as unknown as object[])
        .pointLat((d) => (d as PhysicalNode).lat)
        .pointLng((d) => (d as PhysicalNode).lng)
        .pointColor((d) => (d as PhysicalNode).kind === 'chosen' ? '#f05f73' : (d as PhysicalNode).kind === 'hint' ? '#f4b63f' : '#35c88c')
        .pointAltitude(() => 0.08)
        .pointRadius(() => 0.46)
        .pointsMerge(false)
        .ringsData((feedbackNodes.length ? feedbackNodes : phase === 'playing' && mode === 'name' && targetPhysical ? [{ ...(() => {
          const [lng, lat] = featureMidpoint(targetPhysical)
          return { id: `ring-${targetPhysical.id}`, featureId: targetPhysical.id, lat, lng, label: '', name: '', kind: 'hint' as const }
        })() }] : []) as unknown as object[])
        .ringLat((d) => (d as PhysicalNode).lat)
        .ringLng((d) => (d as PhysicalNode).lng)
        .ringColor((d: object) => {
          const node = d as PhysicalNode
          const color = node.kind === 'chosen' ? '240,95,115' : node.kind === 'target' ? '53,200,140' : physicalKind === 'river' ? '68,199,244' : '243,177,63'
          return (t: number) => `rgba(${color},${1 - t})`
        })
        .ringMaxRadius(() => physicalKind === 'river' ? 5.4 : 4.4)
        .ringPropagationSpeed(2.1)
        .ringRepeatPeriod(950)
        .htmlElementsData([...physicalNodes, ...feedbackNodes] as unknown as object[])
        .htmlLat((d) => (d as PhysicalNode).lat)
        .htmlLng((d) => (d as PhysicalNode).lng)
        .htmlAltitude(() => 0.13)
        .htmlElement((d) => {
          const node = d as PhysicalNode
          const button = document.createElement('button')
          button.type = 'button'
          button.className = `atlas-physical-node ${node.kind} ${node.primary ? 'primary' : ''}`
          button.disabled = !physicalAnswerable || node.kind === 'target' || node.kind === 'chosen' || node.kind === 'hint'
          button.onclick = () => {
            if (physicalAnswerable) onAnswer(node.featureId)
          }
          const symbol = node.kind === 'mountain-node' ? '▲' : ''
          button.innerHTML = node.kind === 'target' || node.kind === 'chosen' || node.kind === 'hint'
            ? `<span>${node.label}</span><b>${shortName(node.name)}</b>`
            : `<i>${symbol}</i>${node.name ? `<em>${shortName(node.name)}</em>` : ''}`
          return button
        })
        .htmlElementVisibilityModifier((el, visible) => {
          el.style.opacity = visible ? '1' : '0'
          el.style.pointerEvents = visible ? 'auto' : 'none'
        })
      return
    }

    globe
      .pointsData(markers as unknown as object[])
      .pointLat((d) => (d as GlobeMarker).lat)
      .pointLng((d) => (d as GlobeMarker).lng)
      .pointColor((d) => (d as GlobeMarker).kind === 'chosen' ? '#f05f73' : (d as GlobeMarker).kind === 'hint' ? '#f4b63f' : '#35c88c')
      .pointAltitude((d) => (d as GlobeMarker).kind === 'hint' ? 0.07 : 0.08)
      .pointRadius((d) => (d as GlobeMarker).kind === 'hint' ? 0.38 : 0.48)
      .pointsMerge(false)
      .ringsData(markers.filter(marker => marker.kind !== 'chosen') as unknown as object[])
      .ringLat((d) => (d as GlobeMarker).lat)
      .ringLng((d) => (d as GlobeMarker).lng)
      .ringColor((d: object) => {
        const color = (d as GlobeMarker).kind === 'hint' ? '244,182,63' : '53,200,140'
        return (t: number) => `rgba(${color},${1 - t})`
      })
      .ringMaxRadius((d) => (d as GlobeMarker).kind === 'hint' ? 4.5 : 6.2)
      .ringPropagationSpeed(2.1)
      .ringRepeatPeriod(900)
      .htmlElementsData(markers as unknown as object[])
      .htmlLat((d) => (d as GlobeMarker).lat)
      .htmlLng((d) => (d as GlobeMarker).lng)
      .htmlAltitude(() => 0.12)
      .htmlElement((d) => {
        const marker = d as GlobeMarker
        const el = document.createElement('div')
        el.className = `atlas-globe-badge ${marker.kind}`
        el.innerHTML = `<span>${marker.label}</span><b>${shortName(marker.name)}</b>`
        return el
      })
      .htmlElementVisibilityModifier((el, visible) => {
        el.style.opacity = visible ? '1' : '0'
        el.style.pointerEvents = 'none'
      })
  }, [activeContinent, chosenId, globeCountries, mode, onAnswer, phase, physicalKind, targetId, view, visiblePhysical])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    const target = globeCountries.find(c => String(c.id) === String(targetId))
    if (view === 'world-physical') {
      const point = activeContinent && CONTINENT_POV[activeContinent]
        ? [CONTINENT_POV[activeContinent].lng, CONTINENT_POV[activeContinent].lat] as [number, number]
        : physicalKind === 'river'
          ? [18, 10] as [number, number]
          : [58, 24] as [number, number]
      const key = [view, physicalKind, activeContinent ?? 'all'].filter(Boolean).join(':')
      if (povKeyRef.current === key) return
      povKeyRef.current = key
      const continentAltitude = activeContinent
        ? Math.max((CONTINENT_POV[activeContinent]?.altitude ?? 1) + 0.62, 1.42)
        : 1.95
      globe.pointOfView({ lat: point[1], lng: point[0], altitude: continentAltitude }, reducedMotion() ? 0 : 1000)
      return
    }
    const shouldFlyToCountry = Boolean(target && (phase === 'answered' || (phase === 'playing' && mode === 'name')))
    const key = shouldFlyToCountry
      ? [view, activeContinent, mode, phase, targetId, chosenId].filter(Boolean).join(':')
      : [view, activeContinent].filter(Boolean).join(':')
    if (povKeyRef.current === key) return
    povKeyRef.current = key

    if (shouldFlyToCountry && target) {
      globe.pointOfView({ lat: target.lat, lng: target.lng, altitude: 0.86 }, reducedMotion() ? 0 : 1000)
      return
    }
    if (view === 'continent' && activeContinent && CONTINENT_POV[activeContinent]) {
      globe.pointOfView(CONTINENT_POV[activeContinent], reducedMotion() ? 0 : 1000)
      return
    }
    globe.pointOfView({ lat: 22, lng: 78, altitude: 1.55 }, reducedMotion() ? 0 : 900)
  }, [activeContinent, chosenId, globeCountries, mode, phase, physicalKind, targetId, view, visiblePhysical])

  return (
    <div className="atlas-globe-surface">
      <div ref={wrapRef} className="atlas-globe-canvas" />
      <div className="atlas-globe-vignette" />
    </div>
  )
}
