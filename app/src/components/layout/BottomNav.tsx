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
            aria-label={item.label}
            style={{
              width: 54,
              height: 54,
              borderRadius: 19,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.3s cubic-bezier(0.3,1.2,0.4,1)',
              border: '1px solid var(--panel-border)',
              background: isActive ? '#fff' : 'var(--panel)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              color: isActive ? '#E9B93B' : 'var(--on)',
              fontSize: 0,
            }}
          >
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
