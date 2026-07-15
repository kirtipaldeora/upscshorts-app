import type { PyqSolution } from '@/types/pyq'

interface PyqSolutionViewProps {
  solution: PyqSolution
  answerLabel?: string
  compact?: boolean
}

function paragraphs(text: string) {
  return text
    .replace(/\\n/g, '\n')
    .split(/\n{2,}|(?=\n[-•]\s)/)
    .map((part) => part.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
}

export function PyqSolutionView({ solution, answerLabel, compact = false }: PyqSolutionViewProps) {
  return (
    <div className={`pyq-solution ${compact ? 'compact' : ''}`}>
      <div className="pyq-solution-verdict">
        <span>Answer</span>
        <b>{answerLabel ? `${answerLabel} · ` : ''}{solution.verdict}</b>
      </div>

      {!!solution.statements?.length && (
        <div className="pyq-solution-section">
          <h4>Statement check</h4>
          <div className="pyq-statement-list">
            {solution.statements.map((statement, index) => (
              <div key={`${statement.label}-${index}`} className={`pyq-statement ${statement.verdict}`}>
                <span>{statement.label}</span>
                <div>
                  <b>{statement.verdict}</b>
                  <p>{statement.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pyq-solution-section">
        <h4>Why this is correct</h4>
        <div className="pyq-solution-copy">
          {paragraphs(solution.detail).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
      </div>

      {!!solution.optionNotes?.length && (
        <div className="pyq-solution-section">
          <h4>Option analysis</h4>
          <div className="pyq-option-notes">
            {solution.optionNotes.map((note) => (
              <p key={note.option}><b>{String.fromCharCode(65 + note.option)}</b>{note.text}</p>
            ))}
          </div>
        </div>
      )}

      {solution.extraEdge && (
        <div className="pyq-solution-note edge">
          <span>Exam edge</span>
          <p>{solution.extraEdge}</p>
        </div>
      )}

      {solution.trick && (
        <div className="pyq-solution-note trick">
          <span>Elimination approach</span>
          <p>{solution.trick}</p>
        </div>
      )}
    </div>
  )
}
