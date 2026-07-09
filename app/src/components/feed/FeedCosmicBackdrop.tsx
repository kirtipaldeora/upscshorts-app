import { useEffect, useMemo, useRef } from 'react'
import Globe from 'globe.gl'
import type { GlobeInstance } from 'globe.gl'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import { gsap, reducedMotion } from '@/anim/animations'
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

const STAR_COUNT = 68

export function FeedCosmicBackdrop() {
  const shellRef = useRef<HTMLDivElement>(null)
  const globeWrapRef = useRef<HTMLDivElement>(null)
  const globeHostRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeInstance | null>(null)
  const { theme } = useThemeStore()
  const themeRef = useRef(theme)

  const stars = useMemo(() => {
    return Array.from({ length: STAR_COUNT }, (_, i) => ({
      id: i,
      x: (i * 37) % 100,
      y: (i * 61) % 100,
      size: 1 + ((i * 13) % 28) / 10,
      delay: (i * 0.17) % 3.8,
      alpha: 0.28 + ((i * 19) % 45) / 100,
    }))
  }, [])

  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.feed-cosmic-globe-wrap', { opacity: 0, scale: 0.9, y: 28 }, { opacity: 1, scale: 1, y: 0, duration: 1.4, ease: 'expo.out' })
      gsap.to('.feed-cosmic-ring', { rotate: 360, duration: 54, ease: 'none', repeat: -1, stagger: 7 })
      gsap.to('.feed-cosmic-star', { opacity: 'random(0.22,0.82)', scale: 'random(0.7,1.35)', duration: 'random(1.8,3.8)', repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 0.025 })
      gsap.to('.feed-cosmic-nebula', { xPercent: 4, yPercent: -3, scale: 1.05, duration: 9, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    }, shell)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const host = globeHostRef.current
    if (!host || globeRef.current) return
    let disposed = false

    fetch(asset('data/countries-110m.json'))
      .then(response => response.json())
      .then((topo: Topology) => {
        if (disposed || !globeHostRef.current) return
        const initialTheme = themeRef.current
        const countries = feature(topo, topo.objects.countries) as unknown as { features: object[] }
        const world = new Globe(globeHostRef.current)
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
          .width(globeHostRef.current.clientWidth)
          .height(globeHostRef.current.clientHeight)
          .pointOfView({ lat: 19, lng: 77, altitude: 2.28 }, 0)

        const mat = world.globeMaterial() as unknown as GlobeMaterial
        mat.color.set(initialTheme === 'dark' ? '#071a3d' : '#d9f2ff')
        mat.emissive?.set(initialTheme === 'dark' ? '#04142e' : '#b9e8ff')
        if ('shininess' in mat) mat.shininess = initialTheme === 'dark' ? 11 : 4

        const controls = world.controls() as GlobeControls
        controls.autoRotate = !reducedMotion()
        controls.autoRotateSpeed = 0.12
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
      const host = globeHostRef.current
      if (world && host) {
        world.width(host.clientWidth)
        world.height(host.clientHeight)
      }
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    if (reducedMotion()) return
    const target = globeWrapRef.current
    if (!target) return
    const move = (x: number, y: number) => {
      gsap.to(target, {
        x,
        y,
        rotateZ: x * 0.012,
        duration: 0.75,
        ease: 'power3.out',
        overwrite: true,
      })
    }
    const onPointer = (event: PointerEvent) => {
      const nx = (event.clientX / window.innerWidth - 0.5) * 2
      const ny = (event.clientY / window.innerHeight - 0.5) * 2
      move(nx * 18, ny * 12)
    }
    const onOrientation = (event: DeviceOrientationEvent) => {
      const gamma = Math.max(-18, Math.min(18, event.gamma ?? 0))
      const beta = Math.max(-18, Math.min(18, (event.beta ?? 0) - 45))
      move(gamma * 0.9, beta * 0.42)
    }
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('deviceorientation', onOrientation, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('deviceorientation', onOrientation)
      gsap.killTweensOf(target)
    }
  }, [])

  return (
    <div ref={shellRef} className="feed-cosmic-backdrop" aria-hidden="true">
      <div className="feed-cosmic-nebula" />
      <div className="feed-cosmic-stars">
        {stars.map(star => (
          <i
            key={star.id}
            className="feed-cosmic-star"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size,
              opacity: star.alpha,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>
      <span className="feed-cosmic-shooting one" />
      <span className="feed-cosmic-shooting two" />
      <div ref={globeWrapRef} className="feed-cosmic-globe-wrap">
        <div className="feed-cosmic-ring ring-a" />
        <div className="feed-cosmic-ring ring-b" />
        <div ref={globeHostRef} className="feed-cosmic-globe" />
      </div>
      <div className="feed-cosmic-haze" />
    </div>
  )
}
