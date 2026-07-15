import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBookOpen,
  faBullseye,
  faCheck,
  faChevronLeft,
  faChevronRight,
  faDumbbell,
  faFilePen,
  faFire,
  faMapLocationDot,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import type { MainsRecord } from '@/hooks/useMainsDB'
import type { DayStats, PracticeStats } from '@/stores/usePracticeStore'
import { TODAY } from '@/constants/categories'
import { calculateStreak, completesDailyActivity, STREAK_MILESTONES } from '@/utils/streak'
import { EASE, gsap, reducedMotion } from '@/anim/animations'
import { useHaptic } from '@/hooks/useHaptic'

interface ProgressDashboardProps {
  stats: PracticeStats
  target: number
  attemptYear?: string
  mainsRecords: MainsRecord[]
  onClose: () => void
  onPractice: () => void
}

type ProgressTab = 'overview' | 'prelims' | 'mains' | 'arcade'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TABS: { id: ProgressTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'prelims', label: 'Prelims' },
  { id: 'mains', label: 'Mains' },
  { id: 'arcade', label: 'Arcade' },
]

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftDate(key: string, amount: number) {
  const value = new Date(`${key}T12:00:00`)
  value.setDate(value.getDate() + amount)
  return dateKey(value)
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function calendarKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function periodDays(length: number) {
  return Array.from({ length }, (_, index) => shiftDate(TODAY, index - length + 1))
}

function sumDays(days: DayStats[]) {
  return days.reduce((total, day) => ({
    attempted: total.attempted + (day.n ?? 0),
    correct: total.correct + (day.c ?? 0),
    mains: total.mains + (day.mains ?? 0),
    learned: total.learned + (day.learned?.length ?? 0),
    arcadeAttempts: total.arcadeAttempts + (day.arcade?.attempts ?? 0),
    arcadeCorrect: total.arcadeCorrect + (day.arcade?.correct ?? 0),
    arcadePoints: total.arcadePoints + (day.arcade?.points ?? 0),
  }), { attempted: 0, correct: 0, mains: 0, learned: 0, arcadeAttempts: 0, arcadeCorrect: 0, arcadePoints: 0 })
}

export function ProgressDashboard({ stats, target, attemptYear, mainsRecords, onClose, onPractice }: ProgressDashboardProps) {
  const [tab, setTab] = useState<ProgressTab>('overview')
  const [period, setPeriod] = useState(30)
  const [month, setMonth] = useState(() => {
    const today = new Date(`${TODAY}T12:00:00`)
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const rootRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const haptic = useHaptic()
  const streak = useMemo(() => calculateStreak(stats.d, target, TODAY), [stats.d, target])
  const today = stats.d[TODAY] ?? { n: 0, c: 0 }
  const todayAccuracy = today.n ? Math.round((today.c / today.n) * 100) : null
  const lifetimeAttempted = Object.keys(stats.a).length
  const lifetimeCorrect = Object.values(stats.a).filter(([correct]) => correct === 1).length
  const lifetimeAccuracy = lifetimeAttempted ? Math.round((lifetimeCorrect / lifetimeAttempted) * 100) : null
  const pyqEntries = Object.entries(stats.a).filter(([id]) => id.startsWith('pyq-'))
  const pyqAttempted = pyqEntries.length
  const pyqCorrect = pyqEntries.filter(([, value]) => value[0] === 1).length
  const pyqAccuracy = pyqAttempted ? Math.round(pyqCorrect / pyqAttempted * 100) : null
  const allDays = Object.values(stats.d)
  const totals = sumDays(allDays)
  const achievedMilestones = STREAK_MILESTONES.filter(value => streak.longest >= value)
  const nextMilestone = STREAK_MILESTONES.find(value => streak.longest < value)
  const monthLabel = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const selectedMonthKey = monthKey(month)

  const selectedKeys = useMemo(() => periodDays(period), [period])
  const selectedDays = selectedKeys.map(key => stats.d[key] ?? { n: 0, c: 0 })
  const periodTotals = sumDays(selectedDays)
  const periodAccuracy = periodTotals.attempted ? Math.round(periodTotals.correct / periodTotals.attempted * 100) : null
  const chartKeys = selectedKeys.slice(-14)
  const maxQuestions = Math.max(1, ...chartKeys.map(key => stats.d[key]?.n ?? 0))
  const maxArcade = Math.max(1, ...chartKeys.map(key => stats.d[key]?.arcade?.attempts ?? 0))

  const subjectRows = useMemo(() => {
    const subjects = new Map<string, { attempted: number; correct: number }>()
    Object.values(stats.a).forEach(([correct, timestamp, subject]) => {
      if (timestamp < new Date(`${selectedKeys[0]}T00:00:00`).getTime()) return
      const key = subject || 'General Studies'
      const value = subjects.get(key) ?? { attempted: 0, correct: 0 }
      value.attempted++
      value.correct += correct
      subjects.set(key, value)
    })
    return [...subjects.entries()]
      .map(([subject, value]) => ({ subject, ...value, accuracy: Math.round(value.correct / value.attempted * 100) }))
      .sort((a, b) => b.attempted - a.attempted)
      .slice(0, 6)
  }, [stats.a, selectedKeys])

  const mainsAverage = mainsRecords.length
    ? Math.round(mainsRecords.reduce((sum, record) => sum + (record.eval.max_score ? record.eval.score / record.eval.max_score * 100 : 0), 0) / mainsRecords.length)
    : null
  const arcadeAccuracy = totals.arcadeAttempts ? Math.round(totals.arcadeCorrect / totals.arcadeAttempts * 100) : null

  const calendar = useMemo(() => {
    const year = month.getFullYear()
    const monthIndex = month.getMonth()
    const days = new Date(year, monthIndex + 1, 0).getDate()
    const mondayOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7
    return [
      ...Array.from({ length: mondayOffset }, () => null),
      ...Array.from({ length: days }, (_, index) => calendarKey(year, monthIndex, index + 1)),
    ]
  }, [selectedMonthKey])

  useEffect(() => {
    const root = rootRef.current
    if (!root || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.progress-drawer', { x: 46, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: EASE.expo })
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    if (!contentRef.current || reducedMotion()) return
    gsap.fromTo(contentRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.32, ease: EASE.expo, clearProps: 'transform,opacity' })
  }, [tab])

  async function selectTab(value: ProgressTab) {
    await haptic(5)
    setTab(value)
  }

  async function moveMonth(amount: number) {
    await haptic(5)
    setMonth(value => new Date(value.getFullYear(), value.getMonth() + amount, 1))
  }

  const streakLost = streak.current === 0 && Boolean(streak.last) && streak.last < shiftDate(TODAY, -1)

  return (
    <div ref={rootRef} className="progress-overlay" role="dialog" aria-modal="true" aria-label="Learning progress">
      <button className="progress-scrim" onClick={onClose} aria-label="Close progress" />
      <div className="progress-drawer">
        <header className="progress-header">
          <div><span>Your learning rhythm</span><h2>Progress</h2></div>
          <button onClick={onClose} aria-label="Close progress"><FontAwesomeIcon icon={faXmark} /></button>
        </header>
        <nav className="progress-tabs" aria-label="Progress area">
          {TABS.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => void selectTab(item.id)}>{item.label}</button>)}
        </nav>

        <div ref={contentRef} className="progress-scroll">
          {tab === 'overview' && (
            <>
              {attemptYear && (
                <section className="progress-exam-banner">
                  <span>Target attempt</span><b>UPSC CSE {attemptYear}</b><small>Keep the plan steady; your daily targets are the next milestone.</small>
                </section>
              )}
              <section className={`progress-streak progress-section ${completesDailyActivity(today, target) ? 'complete' : ''}`}>
                <div className="progress-fire"><FontAwesomeIcon icon={faFire} /></div>
                <div>
                  <span>{completesDailyActivity(today, target) ? 'Today is complete' : streakLost ? 'A fresh start' : 'Today is still open'}</span>
                  <h3>{streak.current}-day streak</h3>
                  <p>{completesDailyActivity(today, target) ? 'Your learning rhythm is protected.' : streakLost ? 'Your last run ended. One focused activity starts a new one.' : 'Complete one meaningful activity before the day ends.'}</p>
                </div>
              </section>

              <section className="progress-section">
                <div className="progress-section-head">
                  <div><span>Activity calendar</span><h3>{monthLabel}</h3></div>
                  <div className="progress-month-nav">
                    <button onClick={() => void moveMonth(-1)} aria-label="Previous month"><FontAwesomeIcon icon={faChevronLeft} /></button>
                    <button onClick={() => void moveMonth(1)} aria-label="Next month"><FontAwesomeIcon icon={faChevronRight} /></button>
                  </div>
                </div>
                <div className="progress-calendar">
                  {WEEKDAYS.map(day => <b key={day}>{day}</b>)}
                  {calendar.map((key, index) => {
                    if (!key) return <i key={`blank-${index}`} />
                    const day = stats.d[key]
                    const complete = completesDailyActivity(day, target)
                    const active = (day?.n ?? 0) > 0 || (day?.mains ?? 0) > 0 || (day?.learned?.length ?? 0) > 0 || (day?.arcade?.attempts ?? 0) > 0
                    return <span key={key} className={`${complete ? 'complete' : ''} ${active ? 'active' : ''} ${key === TODAY ? 'today' : ''}`}>{Number(key.slice(-2))}{complete && <FontAwesomeIcon icon={faFire} />}</span>
                  })}
                </div>
              </section>

              <section className="progress-section">
                <div className="progress-section-head"><div><span>Today</span><h3>Activity</h3></div></div>
                <div className="progress-today-grid">
                  <div><FontAwesomeIcon icon={faDumbbell} /><b>{today.n}</b><span>MCQs</span></div>
                  <div><FontAwesomeIcon icon={faBullseye} /><b>{todayAccuracy === null ? '—' : `${todayAccuracy}%`}</b><span>Accuracy</span></div>
                  <div><FontAwesomeIcon icon={faBookOpen} /><b>{today.learned?.length ?? 0}</b><span>Deep Dives</span></div>
                  <div><FontAwesomeIcon icon={faFilePen} /><b>{today.mains ?? 0}</b><span>Mains</span></div>
                  <div><FontAwesomeIcon icon={faMapLocationDot} /><b>{today.arcade?.attempts ?? 0}</b><span>Arcade</span></div>
                </div>
                {!completesDailyActivity(today, target) && <button className="progress-practice" onClick={onPractice}>Continue today’s practice</button>}
              </section>

              <section className="progress-section">
                <div className="progress-section-head"><div><span>Lifetime</span><h3>Consistency</h3></div></div>
                <div className="progress-lifetime">
                  <div><b>{streak.longest}</b><span>Longest streak</span></div>
                  <div><b>{streak.completedDates.length}</b><span>Goal days</span></div>
                  <div><b>{lifetimeAttempted}</b><span>MCQs</span></div>
                  <div><b>{lifetimeAccuracy === null ? '—' : `${lifetimeAccuracy}%`}</b><span>Accuracy</span></div>
                  <div><b>{totals.learned}</b><span>Deep Dives</span></div>
                  <div><b>{totals.arcadeAttempts}</b><span>Arcade answers</span></div>
                </div>
              </section>

              <section className="progress-section">
                <div className="progress-section-head"><div><span>Milestones</span><h3>{nextMilestone ? `${nextMilestone} days is next` : 'Century rhythm reached'}</h3></div><strong>{achievedMilestones.length}/{STREAK_MILESTONES.length}</strong></div>
                <div className="progress-milestones">
                  {STREAK_MILESTONES.map(value => <div key={value} className={streak.longest >= value ? 'achieved' : ''}><span>{streak.longest >= value ? <FontAwesomeIcon icon={faCheck} /> : value}</span><b>{value} days</b></div>)}
                </div>
              </section>

              <section className="progress-rules progress-section">
                <div className="progress-section-head"><div><span>Daily goal</span><h3>Any one completes the day</h3></div></div>
                <div><FontAwesomeIcon icon={faDumbbell} /><span><b>{target} unique MCQs</b><small>Retries never increase the count.</small></span></div>
                <div><FontAwesomeIcon icon={faBookOpen} /><span><b>One completed Deep Dive</b><small>Reach most of the article or narration.</small></span></div>
                <div><FontAwesomeIcon icon={faFilePen} /><span><b>One evaluated Mains answer</b><small>Save one completed evaluation.</small></span></div>
                <div><FontAwesomeIcon icon={faMapLocationDot} /><span><b>Five Atlas answers</b><small>Any geography practice round counts.</small></span></div>
              </section>
            </>
          )}

          {tab === 'prelims' && (
            <>
              <PeriodControl value={period} onChange={setPeriod} />
              <section className="progress-section">
                <div className="progress-section-head"><div><span>Recent activity</span><h3>MCQ practice</h3></div></div>
                <div className="progress-chart" aria-label="Recent MCQ attempts">
                  {chartKeys.map(key => <div key={key}><i style={{ height: `${Math.max(4, (stats.d[key]?.n ?? 0) / maxQuestions * 100)}%` }} /><span>{Number(key.slice(-2))}</span></div>)}
                </div>
                <div className="progress-metric-row"><div><b>{periodTotals.attempted}</b><span>attempted</span></div><div><b>{periodAccuracy === null ? '—' : `${periodAccuracy}%`}</b><span>accuracy</span></div><div><b>{periodTotals.correct}</b><span>correct</span></div></div>
              </section>
              <section className="progress-section">
                <div className="progress-section-head"><div><span>Knowledge map</span><h3>Subject performance</h3></div></div>
                {subjectRows.length ? <div className="progress-subjects">{subjectRows.map(row => <div key={row.subject}><span><b>{row.subject}</b><small>{row.attempted} questions</small></span><i><em style={{ width: `${row.accuracy}%` }} /></i><strong>{row.accuracy}%</strong></div>)}</div> : <EmptyProgress text="Practice a few questions to unlock subject trends." />}
              </section>
              <section className="progress-section">
                <div className="progress-section-head"><div><span>Previous years</span><h3>PYQ completion</h3></div></div>
                <div className="progress-pyq-summary">
                  <div><b>{pyqAttempted}</b><span>attempted</span></div>
                  <div><b>{pyqAccuracy === null ? '—' : `${pyqAccuracy}%`}</b><span>accuracy</span></div>
                  <div><b>{pyqCorrect}</b><span>correct</span></div>
                </div>
                {!pyqAttempted && <p className="progress-note">Open PYQ Vault from Practice to begin a year-wise record.</p>}
              </section>
            </>
          )}

          {tab === 'mains' && (
            <>
              <section className="progress-section progress-focus-hero">
                <span>Answer writing</span><h3>{mainsRecords.length} evaluated answers</h3><p>{mainsAverage === null ? 'Your first evaluation will start the trend.' : `Average evaluation score: ${mainsAverage}%`}</p>
              </section>
              <section className="progress-section">
                <div className="progress-section-head"><div><span>Recent work</span><h3>Evaluation history</h3></div></div>
                {mainsRecords.length ? <div className="progress-records">{mainsRecords.slice(0, 6).map(record => <div key={record.ts}><span><b>{record.qtext}</b><small>{new Date(record.ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small></span><strong>{record.eval.score}/{record.eval.max_score}</strong></div>)}</div> : <EmptyProgress text="Write and evaluate a Mains answer to begin." />}
              </section>
            </>
          )}

          {tab === 'arcade' && (
            <>
              <section className="progress-section progress-focus-hero arcade">
                <span>Atlas Arcade</span><h3>{totals.arcadeAttempts} map answers</h3><p>{arcadeAccuracy === null ? 'Your map practice will appear here.' : `${arcadeAccuracy}% accuracy · ${totals.arcadePoints} points earned`}</p>
              </section>
              <section className="progress-section">
                <div className="progress-section-head"><div><span>Recent activity</span><h3>Map practice</h3></div></div>
                <div className="progress-chart arcade" aria-label="Recent Atlas Arcade answers">
                  {chartKeys.map(key => <div key={key}><i style={{ height: `${Math.max(4, (stats.d[key]?.arcade?.attempts ?? 0) / maxArcade * 100)}%` }} /><span>{Number(key.slice(-2))}</span></div>)}
                </div>
                <div className="progress-metric-row"><div><b>{totals.arcadeAttempts}</b><span>answers</span></div><div><b>{arcadeAccuracy === null ? '—' : `${arcadeAccuracy}%`}</b><span>accuracy</span></div><div><b>{totals.arcadePoints}</b><span>points</span></div></div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function PeriodControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <div className="progress-period">{[7, 30, 90, 365].map(days => <button key={days} className={value === days ? 'active' : ''} onClick={() => onChange(days)}>{days === 90 ? '3 months' : days === 365 ? '12 months' : `${days} days`}</button>)}</div>
}

function EmptyProgress({ text }: { text: string }) {
  return <div className="progress-empty"><FontAwesomeIcon icon={faBullseye} /><p>{text}</p></div>
}
