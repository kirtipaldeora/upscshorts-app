import { useAppStore } from '@/stores/useAppStore'
import { fmtShort, dayName, TODAY, YESTERDAY } from '@/constants/categories'

interface DateTabsProps {
  dates: string[]
}

export function DateTabs({ dates }: DateTabsProps) {
  const { selectedDate, setSelectedDate, getArticlesForDate } = useAppStore()

  function getLabel(d: string) {
    if (d === TODAY) return 'Today'
    if (d === YESTERDAY) return 'Yesterday'
    return dayName(d)
  }

  return (
    <div className="date-tabs">
      {dates.map((d) => {
        const active = d === selectedDate
        const articleCount = getArticlesForDate(d).length
        const dateLabel = fmtShort(d) // e.g. "7 Jul"
        
        return (
          <button
            key={d}
            onClick={() => setSelectedDate(d)}
            className={`date-tab ${active ? 'active' : ''} ${articleCount ? 'has-data' : ''}`}
          >
            {getLabel(d)}
            <span className="dt-day">
              {dateLabel}
              {articleCount > 0 ? ` · ${articleCount}` : ''}
            </span>
            <span className="dt-dot"></span>
          </button>
        )
      })}
    </div>
  )
}
