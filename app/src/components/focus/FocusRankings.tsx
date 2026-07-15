import { useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCrown, faMedal, faTrophy } from '@fortawesome/free-solid-svg-icons'
import type { FocusPeriod, FocusProfile, FocusRankingEntry } from './focusTypes'
import { compactFocusTime, FocusAvatar, FocusSectionHeading } from './FocusPrimitives'

interface FocusRankingsProps {
  profile: FocusProfile
  entries: FocusRankingEntry[]
  onScopeChange: (period: FocusPeriod) => void
}
const PERIODS: FocusPeriod[] = ['day', 'week', 'month']

function secondsFor(entry: FocusRankingEntry, period: FocusPeriod) {
  return period === 'day' ? entry.daySeconds : period === 'week' ? entry.weekSeconds : entry.monthSeconds
}

export function FocusRankings({ profile, entries, onScopeChange }: FocusRankingsProps) {
  const [period, setPeriod] = useState<FocusPeriod>('week')
  const ranked = useMemo(() => entries.filter(entry => secondsFor(entry, period) > 0).sort((a, b) => secondsFor(b, period) - secondsFor(a, period)), [entries, period])
  const selfIndex = ranked.findIndex(entry => entry.person.id === profile.id)

  function changePeriod(next: FocusPeriod) {
    setPeriod(next)
    onScopeChange(next)
  }

  return (
    <div className="focus-view focus-rankings-view">
      <FocusSectionHeading eyebrow="Focus rankings" title="Compare consistency, not worth." detail="Only verified completed focus time is ranked. Privacy settings can exclude an account entirely." />
      <div className="focus-period-tabs" role="tablist" aria-label="Ranking period">{PERIODS.map(item => <button key={item} role="tab" aria-selected={period === item} className={period === item ? 'active' : ''} onClick={() => changePeriod(item)}>{item}</button>)}</div>

      {ranked.length ? <>
        <section className="focus-podium">
          {ranked.slice(0, 3).map((entry, index) => <article key={entry.person.id} className={`place-${index + 1}`}><span>{index === 0 ? <FontAwesomeIcon icon={faCrown} /> : <FontAwesomeIcon icon={faMedal} />}</span><FocusAvatar name={entry.person.name} initials={entry.person.initials} avatarUrl={entry.person.avatarUrl} size="lg" /><b>{entry.person.id === profile.id ? 'You' : entry.person.name}</b><strong>{compactFocusTime(secondsFor(entry, period))}</strong><small>#{index + 1}</small></article>)}
        </section>

        {selfIndex >= 3 && <section className="focus-your-rank"><span>Your position</span><b>#{selfIndex + 1}</b><p>{compactFocusTime(secondsFor(ranked[selfIndex], period))} verified focus time</p></section>}

        <section className="focus-card focus-ranking-list">
          <FocusSectionHeading eyebrow={`${period} leaderboard`} title={`${ranked.length} ranked aspirants`} detail="Ties retain the server-provided order." />
          {ranked.map((entry, index) => <article key={entry.person.id} className={entry.person.id === profile.id ? 'self' : ''}><span className="focus-rank-number">{index === 0 ? <FontAwesomeIcon icon={faCrown} /> : index + 1}</span><FocusAvatar name={entry.person.name} initials={entry.person.initials} avatarUrl={entry.person.avatarUrl} live={entry.person.isLive} /><div><b>{entry.person.id === profile.id ? 'You' : entry.person.name}</b><span>{entry.person.streak}-day streak{entry.person.isLive ? ` · focusing on ${entry.person.subject}` : ''}</span></div><strong>{compactFocusTime(secondsFor(entry, period))}</strong></article>)}
        </section>
      </> : <section className="focus-rankings-empty"><FontAwesomeIcon icon={faTrophy} /><span>No ranking data yet</span><h3>Complete a focus block to join this period.</h3><p>Penni shows rankings only after the server returns verified, privacy-eligible focus totals.</p></section>}
    </div>
  )
}
