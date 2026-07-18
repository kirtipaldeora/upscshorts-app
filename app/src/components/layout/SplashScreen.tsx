import { useEffect, useState } from 'react'
import { DailyCaseStudyLoader } from './DailyCaseStudyLoader'

interface SplashScreenProps {
  prepare: () => Promise<void>
  onDone: () => void
}

export function SplashScreen({ prepare, onDone }: SplashScreenProps) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    let active = true
    let exitTimer: number | undefined

    // This exists only for real startup work; there is no artificial wait.
    void prepare().catch(() => undefined).then(() => {
      if (!active) return
      setExiting(true)
      exitTimer = window.setTimeout(onDone, 500)
    })

    return () => {
      active = false
      if (exitTimer !== undefined) window.clearTimeout(exitTimer)
    }
  }, [onDone, prepare])

  return (
    <div id="splash" className={exiting ? 'exit' : ''}>
      <DailyCaseStudyLoader label="Preparing today’s briefing" full />
    </div>
  )
}
