import { useEffect, useState } from 'react'

interface SplashScreenProps {
  onDone: () => void
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    // Show splash for 1.6s (matching original), then animate exit
    const timer = setTimeout(() => {
      setExiting(true)
      // Wait for exit animation (0.5s) before calling onDone
      setTimeout(onDone, 500)
    }, 1600)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div id="splash" className={exiting ? 'exit' : ''}>
      {/* Logo box */}
      <div className="slw">
        <div className="sl">m</div>
      </div>

      {/* App name */}
      <div className="st">
        michi
        <span>.</span>
      </div>
    </div>
  )
}
