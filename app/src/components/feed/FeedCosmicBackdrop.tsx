import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { getLunarPhase } from '@/utils/lunarPhase'

const STAR_COUNT = 36

export function FeedCosmicBackdrop() {
  const lunarPhase = useMemo(() => getLunarPhase(), [])
  const stars = useMemo(() => {
    return Array.from({ length: STAR_COUNT }, (_, i) => ({
      id: i,
      x: (i * 37) % 100,
      y: (i * 61) % 100,
      size: 1 + ((i * 13) % 22) / 10,
      delay: (i * 0.21) % 3.8,
      alpha: 0.24 + ((i * 19) % 42) / 100,
    }))
  }, [])
  const nightStyle = { '--moon-scale': lunarPhase.apparentScale } as CSSProperties
  return (
    <div className="feed-cosmic-backdrop feed-cosmic-subtle is-lite" aria-hidden="true">
      <div className="feed-daylight-system">
        <span className="feed-daylight-sun">
          <i className="feed-daylight-sun-core" />
          <i className="feed-daylight-sun-halo" />
        </span>
        <span className="feed-daylight-orbit orbit-one"><i /></span>
        <span className="feed-daylight-orbit orbit-two"><i /></span>
        <span className="feed-daylight-orbit orbit-three"><i /></span>
        <span className="feed-daylight-ray ray-one" />
        <span className="feed-daylight-ray ray-two" />
        <span className="feed-daylight-ray ray-three" />
      </div>
      <div className="feed-night-system" style={nightStyle}>
        <span className={`feed-night-moon moon-phase-${lunarPhase.index}`}>
          <i />
        </span>
        <span className="feed-night-ring ring-one"><i /></span>
        <span className="feed-night-ring ring-two"><i /></span>
      </div>
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
      <span className="feed-cosmic-shooting three" />
      <div className="feed-cosmic-haze" />
    </div>
  )
}
