import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faHouse,
  faBookOpen,
  faEarthAsia,
  faScroll,
  faUser,
} from '@fortawesome/free-solid-svg-icons'
import { useAppStore, type Screen } from '@/stores/useAppStore'
import { useHaptic } from '@/hooks/useHaptic'

interface NavItem {
  screen?: Screen
  icon: typeof faHouse
  label: string
  action?: () => void
}

interface BottomNavProps {
  onOpenMapsArcade: () => void
  onOpenPYQ: () => void
}

export function BottomNav({ onOpenMapsArcade, onOpenPYQ }: BottomNavProps) {
  const { activeScreen, setScreen } = useAppStore()
  const haptic = useHaptic()

  const items: NavItem[] = [
    { screen: 'feed', icon: faHouse, label: 'Feed' },
    { screen: 'revise', icon: faBookOpen, label: 'Revise' },
    { icon: faEarthAsia, label: 'Arcade', action: onOpenMapsArcade },
    { icon: faScroll, label: 'PYQ', action: onOpenPYQ },
    { screen: 'profile', icon: faUser, label: 'Profile' },
  ]

  async function handleTap(item: NavItem) {
    await haptic()
    if (item.action) {
      item.action()
    } else if (item.screen) {
      setScreen(item.screen)
    }
  }

  return (
    <nav
      style={{
        position: 'absolute',
        bottom: 'calc(16px + env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 11,
        zIndex: 100,
      }}
    >
      {items.map((item) => {
        const isActive = item.screen ? activeScreen === item.screen : false
        return (
          <button
            key={item.label}
            onClick={() => handleTap(item)}
            className={`nav-item ${isActive ? 'active' : ''}`}
            style={{
              width: 54,
              height: 54,
              borderRadius: 19,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.3s cubic-bezier(0.3, 1.2, 0.4, 1)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Premium liquid glass gloss highlight overlay */}
            <span
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '50%',
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 100%)',
                pointerEvents: 'none',
              }}
            />
            <FontAwesomeIcon
              icon={item.icon}
              style={{
                fontSize: 19,
                transition: 'transform 0.3s',
                transform: isActive ? 'scale(1.08)' : 'scale(1)',
              }}
            />
          </button>
        )
      })}
    </nav>
  )
}
