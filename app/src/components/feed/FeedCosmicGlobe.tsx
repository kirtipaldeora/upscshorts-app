import { useEffect, useRef } from 'react'
import Globe from 'globe.gl'
import type { GlobeInstance } from 'globe.gl'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import { reducedMotion } from '@/anim/animations'
import { useThemeStore } from '@/stores/useThemeStore'
import { asset } from '@/utils/asset'

type GlobeMaterial = {
  color: { set: (color: string) => void }
  emissive?: { set: (color: string) => void }
  shininess?: number
}

type GlobeControls = {
  autoRotate: boolean
  autoRotateSpeed: number
  enableRotate: boolean
  enableZoom: boolean
  enablePan?: boolean
}

export function FeedCosmicGlobe() {
  const hostRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeInstance | null>(null)
  const { theme } = useThemeStore()
  const themeRef = useRef(theme)

  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  useEffect(() => {
    const host = hostRef.current
    if (!host || globeRef.current) return
    let disposed = false

    fetch(asset('data/countries-110m.json'))
      .then(response => response.json())
      .then((topo: Topology) => {
        if (disposed || !hostRef.current) return
        const initialTheme = themeRef.current
        const countries = feature(topo, topo.objects.countries) as unknown as { features: object[] }
        const world = new Globe(hostRef.current)
        world
          .backgroundColor('rgba(0,0,0,0)')
          .showAtmosphere(true)
          .atmosphereAltitude(0.28)
          .atmosphereColor(initialTheme === 'dark' ? '#8fb8ff' : '#8dd8ff')
          .polygonsData(countries.features)
          .polygonCapColor(() => initialTheme === 'dark' ? 'rgba(91,154,220,0.46)' : 'rgba(69,151,179,0.3)')
          .polygonSideColor(() => initialTheme === 'dark' ? 'rgba(34,78,132,0.34)' : 'rgba(47,120,145,0.22)')
          .polygonStrokeColor(() => initialTheme === 'dark' ? 'rgba(204,229,255,0.34)' : 'rgba(37,87,112,0.2)')
          .polygonAltitude(0.01)
          .width(hostRef.current.clientWidth)
          .height(hostRef.current.clientHeight)
          .pointOfView({ lat: 19, lng: 77, altitude: 2.28 }, 0)

        const mat = world.globeMaterial() as unknown as GlobeMaterial
        mat.color.set(initialTheme === 'dark' ? '#071a3d' : '#d9f2ff')
        mat.emissive?.set(initialTheme === 'dark' ? '#04142e' : '#b9e8ff')
        if ('shininess' in mat) mat.shininess = initialTheme === 'dark' ? 11 : 4

        const controls = world.controls() as GlobeControls
        controls.autoRotate = !reducedMotion()
        controls.autoRotateSpeed = 0.08
        controls.enableRotate = false
        controls.enableZoom = false
        if ('enablePan' in controls) controls.enablePan = false

        globeRef.current = world
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
    const world = globeRef.current
    if (!world) return
    world
      .atmosphereColor(theme === 'dark' ? '#8fb8ff' : '#8dd8ff')
      .polygonCapColor(() => theme === 'dark' ? 'rgba(91,154,220,0.46)' : 'rgba(69,151,179,0.3)')
      .polygonSideColor(() => theme === 'dark' ? 'rgba(34,78,132,0.34)' : 'rgba(47,120,145,0.22)')
      .polygonStrokeColor(() => theme === 'dark' ? 'rgba(204,229,255,0.34)' : 'rgba(37,87,112,0.2)')
    const mat = world.globeMaterial() as unknown as GlobeMaterial
    mat.color.set(theme === 'dark' ? '#071a3d' : '#d9f2ff')
    mat.emissive?.set(theme === 'dark' ? '#04142e' : '#b9e8ff')
  }, [theme])

  useEffect(() => {
    function resize() {
      const world = globeRef.current
      const host = hostRef.current
      if (world && host) {
        world.width(host.clientWidth)
        world.height(host.clientHeight)
      }
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  return <div ref={hostRef} className="feed-cosmic-globe" />
}
