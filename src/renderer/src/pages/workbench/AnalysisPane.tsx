import { useEffect, useMemo, useState } from 'react'
import { ImageCompareViewer } from '@renderer/components/ImageCompareViewer'
import { notesFromPfdbi, pfdbiFromNotes, PFDBI_KEYS, PFDBI_LABELS, type PfdbiKey } from '@renderer/lib/pfdbi-notes'
import type { ProjectDetail } from '@shared/ipc'

/**
 * 双图对比预览 + 人眼 PFDBI 设计分析。
 */
export function AnalysisPane({
  detail,
  onSavePfdbi
}: {
  detail: ProjectDetail
  onSavePfdbi: (next: ReturnType<typeof pfdbiFromNotes>) => Promise<void>
}): React.JSX.Element {
  const images = detail.images
  const primary = images.find((item) => item.role === 'primary') ?? images[0]
  const other =
    images.find((item) => item.role === 'other' && item.id !== primary?.id) ??
    images.find((item) => item.id !== primary?.id) ??
    primary
  const [leftId, setLeftId] = useState(primary?.id ?? '')
  const [rightId, setRightId] = useState(other?.id ?? '')
  const [tab, setTab] = useState<PfdbiKey>('P')
  const [notes, setNotes] = useState(notesFromPfdbi(detail.pfdbi))

  useEffect(() => {
    setNotes(notesFromPfdbi(detail.pfdbi))
  }, [detail.id, detail.pfdbi])

  useEffect(() => {
    if (primary?.id) setLeftId(primary.id)
    if (other?.id) setRightId(other.id)
  }, [primary?.id, other?.id])

  const activeLabel = useMemo(() => PFDBI_LABELS[tab], [tab])

  return (
    <section className="workbench-section analysis-section">
      <header>
        <h2>设计分析</h2>
        <p>左右对照看图，滚轮缩放、左键拖移。下面按 PFDBI 标签写下人眼观察，不自动下审美结论。</p>
      </header>
      <div className="analysis-compare">
        <ImageCompareViewer images={images} selectedId={leftId} onSelect={setLeftId} label="图 1" />
        <ImageCompareViewer images={images} selectedId={rightId} onSelect={setRightId} label="图 2" />
      </div>
      <div className="pfdbi-human">
        <div className="pfdbi-human-tabs" role="tablist" aria-label="PFDBI 维度">
          {PFDBI_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? 'is-active' : ''}
              onClick={() => setTab(key)}
            >
              {PFDBI_LABELS[key]}
            </button>
          ))}
        </div>
        <label htmlFor="pfdbiNote">
          {activeLabel}
          <textarea
            id="pfdbiNote"
            value={notes[tab]}
            placeholder="写下这张图上能看见的设计事实、推断和你的判断，三者尽量分开。"
            onChange={(event) => setNotes((current) => ({ ...current, [tab]: event.target.value }))}
            onBlur={() => {
              const next = pfdbiFromNotes(detail.topic, notes, detail.pfdbi)
              void onSavePfdbi(next)
            }}
          />
        </label>
      </div>
    </section>
  )
}
