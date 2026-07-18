import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons'
import { useThemeStore } from '@/stores/useThemeStore'

export function FeedThemeToggle() {
  const { theme, toggle } = useThemeStore()
  const nextTheme = theme === 'light' ? 'dark' : 'light'

  return (
    <button
      type="button"
      className={`feed-theme-toggle is-${theme}`}
      onClick={toggle}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      <span aria-hidden="true"><FontAwesomeIcon icon={theme === 'dark' ? faMoon : faSun} /></span>
    </button>
  )
}
