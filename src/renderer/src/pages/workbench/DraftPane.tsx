import { useEffect, useMemo, useState } from 'react'
import { countCopyWords } from '@renderer/lib/text'
import { CONTENT_TYPES, WORDS_PER_MINUTE, type ContentType } from '@shared/constants'
import type { ProjectDetail } from '@shared/ipc'

/**
 * 初稿正文与辅助检查：标题、内容类型、预期时长和当前字数。
 */
export function DraftPane({
  detail,
  onSave
}: {
  detail: ProjectDetail
  onSave: (patch: {
    title?: string
    contentType?: string
    durationSeconds?: number
    finalScript?: string
  }) => Promise<void>
}): React.JSX.Element {
  const [title, setTitle] = useState(detail.title || detail.topic)
  const [contentType, setContentType] = useState(detail.contentType)
  const [minutes, setMinutes] = useState(Math.max(1, Math.round(detail.durationSeconds / 60)))
  const [script, setScript] = useState(detail.finalDraft?.script ?? detail.baseDraft?.script ?? '')

  useEffect(() => {
    setTitle(detail.title || detail.topic)
    setContentType(detail.contentType)
    setMinutes(Math.max(1, Math.round(detail.durationSeconds / 60)))
    setScript(detail.finalDraft?.script ?? detail.baseDraft?.script ?? '')
  }, [detail.id, detail.title, detail.topic, detail.contentType, detail.durationSeconds, detail.finalDraft, detail.baseDraft])

  const wordCount = useMemo(() => countCopyWords(script), [script])
  const targetWords = minutes * WORDS_PER_MINUTE

  return (
    <section className="draft-layout">
      <div className="draft-editor">
        <textarea
          aria-label="初稿正文"
          value={script}
          placeholder="在这里写本期口播初稿。"
          onChange={(event) => setScript(event.target.value)}
          onBlur={() => {
            const stored = detail.finalDraft?.script ?? detail.baseDraft?.script ?? ''
            if (script !== stored) void onSave({ finalScript: script, title })
          }}
        />
        <div className="draft-wordcount">
          当前 {wordCount} 字 · 目标约 {targetWords} 字（{minutes} 分钟 × {WORDS_PER_MINUTE} 字）
        </div>
      </div>
      <aside className="draft-meta">
        <h3>文案设置</h3>
        <label htmlFor="draftTitle">
          文案标题
          <input
            id="draftTitle"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              const next = title.trim()
              if (next && next !== detail.title) void onSave({ title: next })
            }}
          />
        </label>
        <label htmlFor="draftType">
          内容类型
          <select
            id="draftType"
            value={contentType}
            onChange={(event) => {
              const next = event.target.value as ContentType
              setContentType(next)
              if (next !== detail.contentType) void onSave({ contentType: next })
            }}
          >
            {CONTENT_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="draftMinutes">
          预期时长（分钟）
          <input
            id="draftMinutes"
            type="number"
            min={1}
            value={minutes}
            onChange={(event) => {
              const next = Math.max(1, Number(event.target.value) || 1)
              setMinutes(next)
            }}
            onBlur={() => {
              const seconds = minutes * 60
              if (seconds !== detail.durationSeconds) void onSave({ durationSeconds: seconds })
            }}
          />
        </label>
        <p className="draft-meta-hint">
          字数检查按每分钟 {WORDS_PER_MINUTE} 字估算。当前 {wordCount} / {targetWords}。
        </p>
      </aside>
    </section>
  )
}
