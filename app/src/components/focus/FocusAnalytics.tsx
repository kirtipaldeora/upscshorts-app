import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarDays, faChartLine, faClock, faFire, faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import type { FocusActivityRecord, FocusPeriod, FocusProfile, FocusSessionRecord, FocusSubject } from './focusTypes'
import { compactFocusTime, FocusSectionHeading } from './FocusPrimitives'

interface FocusAnalyticsProps {
  profile: FocusProfile
  sessions: FocusSessionRecord[]
  activityLog: FocusActivityRecord[]
  subjects: FocusSubject[]
}

const PERIODS: FocusPeriod[] = ['day', 'week', 'month']

function startOfDay(value = new Date()) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function periodStart(period: FocusPeriod) {
  const date = startOfDay()
  if (period === 'week') date.setDate(date.getDate() - 6)
  if (period === 'month') date.setDate(date.getDate() - 29)
  return date.getTime()
}

function dateKey(timestamp: number) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function periodTitle(period: FocusPeriod) {
  return period === 'day' ? 'Today' : period === 'week' ? 'Last 7 days' : 'Last 30 days'
}

function formatClockMinute(value: number | null) {
  if (value === null) return '—'
  const hours = Math.floor(value / 60)
  const minutes = Math.round(value % 60)
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

function formatActivityRange(startedAt: number, endedAt: number) {
  const format = (value: number) => new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  return `${format(startedAt)}–${format(endedAt)}`
}

function activityType(activity: FocusActivityRecord) {
  if (activity.phase === 'short-break') return 'Short break'
  if (activity.phase === 'long-break') return 'Long break'
  return activity.mode === 'stopwatch' ? 'Stopwatch' : 'Pomodoro'
}

function createChartPoints(period: FocusPeriod, sessions: FocusSessionRecord[]) {
  if (period === 'day') {
    const bins = Array.from({ length: 8 }, (_, index) => ({ label: `${String(index * 3).padStart(2, '0')}:00`, seconds: 0 }))
    sessions.forEach(session => { bins[Math.min(7, Math.floor(new Date(session.startedAt).getHours() / 3))].seconds += session.focusedSeconds })
    return bins
  }
  const length = period === 'week' ? 7 : 30
  const days = Array.from({ length }, (_, index) => {
    const date = startOfDay()
    date.setDate(date.getDate() - (length - index - 1))
    const key = dateKey(date.getTime())
    return { key, label: period === 'week' ? date.toLocaleDateString('en-IN', { weekday: 'short' }) : index % 5 === 0 || index === length - 1 ? String(date.getDate()) : '', seconds: 0 }
  })
  const byDay = new Map(days.map(day => [day.key, day]))
  sessions.forEach(session => {
    const point = byDay.get(dateKey(session.endedAt))
    if (point) point.seconds += session.focusedSeconds
  })
  return days
}

export function FocusAnalytics({ profile, sessions, activityLog, subjects }: FocusAnalyticsProps) {
  const [period, setPeriod] = useState<FocusPeriod>('week')
  const completedSessions = useMemo(() => sessions.filter(session => session.completed && session.endedAt > session.startedAt && session.focusedSeconds > 0), [sessions])
  const selectedSessions = useMemo(() => completedSessions.filter(session => session.endedAt >= periodStart(period)), [completedSessions, period])
  const points = useMemo(() => createChartPoints(period, selectedSessions), [period, selectedSessions])
  const totalSeconds = selectedSessions.reduce((sum, session) => sum + session.focusedSeconds, 0)
  const activeDayCount = new Set(selectedSessions.map(session => dateKey(session.endedAt))).size
  const averageSeconds = activeDayCount ? Math.round(totalSeconds / activeDayCount) : 0
  const interruptionCount = selectedSessions.reduce((sum, session) => sum + session.interruptionCount, 0)
  const maxSeconds = Math.max(...points.map(point => point.seconds), 1)
  const averageStart = selectedSessions.length ? selectedSessions.reduce((sum, session) => { const date = new Date(session.startedAt); return sum + date.getHours() * 60 + date.getMinutes() }, 0) / selectedSessions.length : null
  const averageEnd = selectedSessions.length ? selectedSessions.reduce((sum, session) => { const date = new Date(session.endedAt); return sum + date.getHours() * 60 + date.getMinutes() }, 0) / selectedSessions.length : null
  const subjectTotals = subjects.map(subject => ({ ...subject, seconds: selectedSessions.filter(session => session.subjectId === subject.id).reduce((sum, session) => sum + session.focusedSeconds, 0) })).filter(subject => subject.seconds > 0)
  const primarySubject = subjectTotals.slice().sort((a, b) => b.seconds - a.seconds)[0]
  const primaryShare = primarySubject && totalSeconds ? Math.round(primarySubject.seconds / totalSeconds * 100) : 0
  const stoppedEarlyCount = activityLog.filter(activity => activity.outcome === 'stopped-early').length

  const heatmapDays = useMemo(() => {
    const totals = new Map<string, number>()
    completedSessions.forEach(session => totals.set(dateKey(session.endedAt), (totals.get(dateKey(session.endedAt)) ?? 0) + session.focusedSeconds))
    return Array.from({ length: 35 }, (_, index) => {
      const date = startOfDay()
      date.setDate(date.getDate() - (34 - index))
      const key = dateKey(date.getTime())
      return { key, seconds: totals.get(key) ?? 0 }
    })
  }, [completedSessions])

  return (
    <div className="focus-view focus-analytics-view">
      <FocusSectionHeading eyebrow="Focus analytics" title="See the rhythm, not just the hours." detail="Every chart uses completed focus-session timestamps. No estimated study time is added." />
      <div className="focus-period-tabs" role="tablist" aria-label="Analytics period">{PERIODS.map(item => <button key={item} role="tab" aria-selected={period === item} className={period === item ? 'active' : ''} onClick={() => setPeriod(item)}>{item}</button>)}</div>

      <section className="focus-metric-grid">
        <article><i><FontAwesomeIcon icon={faClock} /></i><span>Total focus</span><b>{totalSeconds ? compactFocusTime(totalSeconds) : '—'}</b><small>{periodTitle(period)}</small></article>
        <article><i><FontAwesomeIcon icon={faChartLine} /></i><span>Daily average</span><b>{averageSeconds ? compactFocusTime(averageSeconds) : '—'}</b><small>{activeDayCount ? `${activeDayCount} active day${activeDayCount === 1 ? '' : 's'}` : 'No completed sessions'}</small></article>
        <article><i><FontAwesomeIcon icon={faLayerGroup} /></i><span>Study blocks</span><b>{selectedSessions.length || '—'}</b><small>{interruptionCount} interruptions</small></article>
        <article className="streak"><i><FontAwesomeIcon icon={faFire} /></i><span>Current streak</span><b>{profile.currentStreak ? `${profile.currentStreak} days` : '—'}</b><small>Best · {profile.bestStreak || 0} days</small></article>
      </section>

      <section className="focus-card focus-activity-log-card">
        <FocusSectionHeading eyebrow="Today’s activity" title={activityLog.length ? `${activityLog.length} ${activityLog.length === 1 ? 'session' : 'sessions'} · ${stoppedEarlyCount} stopped early` : 'No sessions recorded today'} detail="A timestamped log of focused time, breaks, pauses and interruptions. Stopped-early blocks remain visible." />
        {activityLog.length ? <div className="focus-activity-log">{activityLog.map(activity => <article key={activity.id} className={activity.outcome}>
          <i style={{ background: activity.subjectColor }} />
          <div className="focus-activity-summary"><span>{activityType(activity)}</span><b>{activity.subjectLabel}</b><small>{formatActivityRange(activity.startedAt, activity.endedAt)}</small></div>
          <div className="focus-activity-metrics"><span><b>{compactFocusTime(activity.durationSeconds)}</b>{activity.phase === 'focus' ? 'focused' : 'break'}</span><span><b>{activity.pauseCount}</b>{activity.pauseCount === 1 ? 'pause' : 'pauses'} · {compactFocusTime(activity.pausedSeconds)}</span><span><b>{activity.interruptionCount}</b>{activity.interruptionCount === 1 ? 'interruption' : 'interruptions'}</span></div>
          <em>{activity.outcome === 'completed' ? 'Completed' : 'Stopped early'}</em>
        </article>)}</div> : <div className="focus-analytics-empty compact"><FontAwesomeIcon icon={faClock} /><b>Nothing logged yet</b><p>Finish or stop a focus block to add it here.</p></div>}
      </section>

      <section className="focus-card focus-chart-card">
        <FocusSectionHeading eyebrow={periodTitle(period)} title="Focused study time" detail="Grouped from the start and end timestamps of completed sessions." />
        {selectedSessions.length ? <>
          <div className={`focus-bar-chart ${period}`} role="img" aria-label={`Bar chart of actual focus time for ${periodTitle(period).toLowerCase()}`}>{points.map((point, index) => { const height = point.seconds ? Math.max(8, Math.round(point.seconds / maxSeconds * 100)) : 3; const valueLabel = point.seconds ? compactFocusTime(point.seconds) : 'No focus time'; return <div className={point.seconds ? 'has-data' : ''} key={`${point.label}-${index}`} title={`${point.label || `Day ${index + 1}`}: ${valueLabel}`}><span style={{ '--bar-height': `${height}%` } as CSSProperties} aria-label={valueLabel}><i /><b>{point.seconds ? compactFocusTime(point.seconds) : '—'}</b></span><small>{point.label}</small></div> })}</div>
          <div className="focus-chart-insight"><FontAwesomeIcon icon={faChartLine} /><p><b>Average start {formatClockMinute(averageStart)}</b> · Average end {formatClockMinute(averageEnd)} · {interruptionCount} recorded interruption{interruptionCount === 1 ? '' : 's'}.</p></div>
        </> : <AnalyticsEmpty />}
      </section>

      <div className="focus-analytics-grid">
        <section className="focus-card focus-heatmap-card">
          <FocusSectionHeading eyebrow="Consistency" title="Five-week activity" detail="Zero days remain visible; darker squares mean more completed focus time." />
          <div className="focus-heatmap-weekdays" aria-hidden="true"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
          <div className="focus-heatmap" role="img" aria-label="Actual focus activity heatmap for the last five weeks">{heatmapDays.map(point => { const level = point.seconds === 0 ? 0 : point.seconds < 4_500 ? 1 : point.seconds < 8_000 ? 2 : point.seconds < 11_000 ? 3 : 4; return <span key={point.key} data-level={level} title={`${point.key}: ${compactFocusTime(point.seconds)}`} /> })}</div>
          <div className="focus-heatmap-legend"><span>Less</span>{[0, 1, 2, 3, 4].map(level => <i key={level} data-level={level} />)}<span>More</span></div>
        </section>

        <section className="focus-card focus-mix-card">
          <FocusSectionHeading eyebrow={`${periodTitle(period)} mix`} title="Where the time went" detail="Calculated from the subject attached to each completed block." />
          {subjectTotals.length ? <div className="focus-donut-row"><div className="focus-donut" style={{ '--mix-share': `${primaryShare * 3.6}deg` } as CSSProperties}><span><b>{primaryShare}%</b><small>{primarySubject?.label}</small></span></div><div className="focus-mix-list">{subjectTotals.map(subject => <div key={subject.id}><i style={{ background: subject.color }} /><span>{subject.label}</span><b>{compactFocusTime(subject.seconds)}</b></div>)}</div></div> : <AnalyticsEmpty compact />}
        </section>
      </div>

      <section className="focus-streak-card"><div className="focus-streak-mark"><FontAwesomeIcon icon={faFire} /></div><div><span>Consistency streak</span><h3>{profile.currentStreak ? `${profile.currentStreak} focused days` : 'Your first streak starts here'}</h3><p>A day counts only after a completed focus block. Paused, break and abandoned time is excluded.</p></div><div className="focus-streak-calendar"><FontAwesomeIcon icon={faCalendarDays} /><b>{profile.bestStreak || '—'}</b><span>personal best</span></div></section>
    </div>
  )
}

function AnalyticsEmpty({ compact = false }: { compact?: boolean }) {
  return <div className={`focus-analytics-empty ${compact ? 'compact' : ''}`}><FontAwesomeIcon icon={faClock} /><b>No completed focus data</b><p>Finish a study block to populate this view. Penni will not manufacture missing chart values.</p></div>
}
