import { useDailyLoadingBrief } from '@/utils/loadingBriefs'

interface DailyCaseStudyLoaderProps {
  label?: string
  full?: boolean
  className?: string
}

export function DailyCaseStudyLoader({ label = 'Preparing your page', full = false, className = '' }: DailyCaseStudyLoaderProps) {
  const brief = useDailyLoadingBrief()

  return (
    <div
      className={`case-study-loader ${full ? 'full' : 'compact'} ${className}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="case-study-loader-ambient" aria-hidden="true" />
      <div className="case-study-loader-sparks" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => <i key={index} />)}
      </div>
      <article key={`${brief.id}:${brief.summary}`} className="case-study-loader-story">
        <span className="case-study-loader-symbol" aria-hidden="true"><i /><b>✦</b></span>
        <div className="case-study-loader-copy">
          <div className="case-study-loader-kicker">A small case study</div>
          <h2>{brief.title}</h2>
          <p>{brief.summary}</p>
          <footer><span>{brief.category}</span><i /> <small>{label}</small></footer>
        </div>
      </article>
    </div>
  )
}
