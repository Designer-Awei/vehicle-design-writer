import { useEffect, useState } from 'react'
import type { ProjectDetail } from '@shared/ipc'

/**
 * 选题、初步想法和事实补充。
 */
export function TopicPane({
  detail,
  onSave
}: {
  detail: ProjectDetail
  onSave: (patch: { topic?: string; draft?: string; facts?: string; title?: string }) => Promise<void>
}): React.JSX.Element {
  const [topic, setTopic] = useState(detail.topic)
  const [draft, setDraft] = useState(detail.draft)
  const [facts, setFacts] = useState(detail.facts ?? '')

  useEffect(() => {
    setTopic(detail.topic)
    setDraft(detail.draft)
    setFacts(detail.facts ?? '')
  }, [detail.id, detail.topic, detail.draft, detail.facts])

  return (
    <section className="workbench-section">
      <header>
        <h2>选题想法</h2>
        <p>先写清这期要回答什么。初步想法和事实补充都可空，之后仍能改。</p>
      </header>
      <label htmlFor="topicField">
        选题 / 核心问题
        <textarea
          id="topicField"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          onBlur={() => {
            const next = topic.trim()
            if (next && next !== detail.topic) void onSave({ topic: next, title: next })
          }}
        />
      </label>
      <label htmlFor="ideaField">
        初步想法（可选）
        <textarea
          id="ideaField"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft !== detail.draft) void onSave({ draft })
          }}
        />
      </label>
      <label htmlFor="factsField">
        事实补充（可选）
        <textarea
          id="factsField"
          className="workbench-facts"
          placeholder="参数、发布会原话、报道、设计历史等，只当素材，不进文风。"
          value={facts}
          onChange={(event) => setFacts(event.target.value)}
          onBlur={() => {
            if (facts !== (detail.facts ?? '')) void onSave({ facts })
          }}
        />
      </label>
    </section>
  )
}
