import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AUTO_DESIGN_TRIVIA } from '@renderer/content/auto-trivia'
import { STYLE_EXTRACT_STEPS } from '@shared/constants'
import type { WorkflowProgress } from '@shared/ipc'

/**
 * Style DNA 提取等待层：分步进度 + 汽车设计冷知识轮播。
 */
export function ExtractionWaitOverlay({
  progress,
  documentTotal
}: {
  progress: WorkflowProgress | null
  documentTotal?: number
}): React.JSX.Element {
  const [triviaIndex, setTriviaIndex] = useState(0)
  const stepIndex = Math.max(
    0,
    STYLE_EXTRACT_STEPS.findIndex((item) => item.id === progress?.stage)
  )
  const percent = Math.max(0, Math.min(100, progress?.percent ?? 0))
  const trivia = AUTO_DESIGN_TRIVIA[triviaIndex % AUTO_DESIGN_TRIVIA.length]
  const startOffset = useMemo(() => Math.floor(Math.random() * AUTO_DESIGN_TRIVIA.length), [])

  useEffect(() => {
    setTriviaIndex(startOffset)
    const timer = window.setInterval(() => {
      setTriviaIndex((current) => current + 1)
    }, 5500)
    return () => window.clearInterval(timer)
  }, [startOffset])

  return (
    <div className="extract-wait-overlay" role="status" aria-live="polite" aria-busy="true">
      <section className="extract-wait-card">
        <div className="extract-wait-heading">
          <Loader2 className="extract-wait-spinner" size={18} />
          <div>
            <h3>正在提取 Style DNA</h3>
            <p>{progress?.message ?? '正在准备分析样本…'}</p>
          </div>
        </div>
        <div className="extract-wait-bar" aria-hidden="true">
          <i style={{ width: `${percent}%` }} />
        </div>
        <div className="extract-wait-percent">{percent}%</div>
        <ol className="extract-wait-steps">
          {STYLE_EXTRACT_STEPS.map((step, index) => {
            const state = index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'pending'
            return (
              <li key={step.id} data-state={state}>
                <span>{step.label}</span>
                {step.id === 'document_analysis' && documentTotal ? (
                  <b>共 {documentTotal} 篇</b>
                ) : null}
              </li>
            )
          })}
        </ol>
        <blockquote className="extract-wait-trivia">
          <span>汽车设计冷知识</span>
          <p key={triviaIndex}>{trivia}</p>
        </blockquote>
      </section>
    </div>
  )
}
