import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faArrowRight, faKey } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { mainsPool } from '@/utils/practiceUtils'
import type { MainsQuestion } from '@/utils/practiceUtils'
import { MainsDetail } from './MainsDetail'
import { TODAY } from '@/constants/categories'

interface MainsScreenProps {
  onClose: () => void
  onShowToast: (msg: string) => void
  onOpenSettings: () => void
}

export function MainsScreen({ onClose, onShowToast, onOpenSettings }: MainsScreenProps) {
  const { articlesByDate } = useAppStore()
  const { settings, mainsQuota, pyqData } = usePracticeStore()
  const [selectedQ, setSelectedQ] = useState<MainsQuestion | null>(null)

  const allArticles = Object.values(articlesByDate).flat()
  const pool = mainsPool(allArticles, pyqData)
  const left = 5 - (mainsQuota[TODAY] ?? 0)

  if (selectedQ) {
    return (
      <MainsDetail
        question={selectedQ}
        onClose={() => setSelectedQ(null)}
        onShowToast={onShowToast}
        onOpenSettings={onOpenSettings}
      />
    )
  }

  return (
    <div className="quiz-overlay">
      <div className="quiz-header">
        <span className="qz-title">Mains Answer Writing</span>
        <button className="icon-btn" onClick={onClose}>
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
      <div className="quiz-body">
        {/* Quota */}
        <div className={`pn-quota ${left > 0 ? '' : 'out'}`}>
          {left > 0 ? `${left} of 5 evaluations left today` : 'Daily limit reached — resets tomorrow'}
        </div>

        {/* API key nudge */}
        {!settings.key && (
          <div className="pn-warn" onClick={onOpenSettings} style={{ cursor: 'pointer' }}>
            <FontAwesomeIcon icon={faKey} />
            {' '}Add your Claude API key in Settings to enable AI evaluation →
          </div>
        )}

        {/* Question list */}
        {pool.length === 0 ? (
          <p className="pn-empty" style={{ marginTop: 24 }}>No mains questions available. Import content with mains questions first.</p>
        ) : (
          pool.map((m, i) => (
            <div key={m.id} className="pn-qcard" onClick={() => setSelectedQ(m)}>
              <div className="pn-qcard-top">
                <span className="pv-tag subject">{m.subject || 'GS'}</span>
                <span className="qz-src">{m.srcLabel}</span>
              </div>
              <p>{m.q}</p>
              <span className="pn-link">
                Write &amp; upload <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 4 }} />
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
