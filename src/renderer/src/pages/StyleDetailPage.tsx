import { useEffect, useState } from 'react'
import { FolderOpen, RefreshCw } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { ExtractionWaitOverlay } from '@renderer/components/ExtractionWaitOverlay'
import { StyleMetaEditor } from '@renderer/components/StyleMetaEditor'
import { STYLE_STAGES } from '@renderer/navigation'
import { ipcErrorMessage } from '@renderer/lib/utils'
import { useWorkspaceBar } from '@renderer/workspace/WorkspaceContext'
import type { StyleDetail, StyleRecord, WorkflowProgress } from '@shared/ipc'

const DETAIL_TABS = [
  { id: 'overview', label: '总览' },
  { id: 'language', label: '语言' },
  { id: 'templates', label: '结构模板' },
  { id: 'examples', label: '例子' },
  { id: 'commercial', label: '商业' }
] as const

type DetailTab = (typeof DETAIL_TABS)[number]['id']

/**
 * Style DNA 详情：档案信息与各分析标签在页面内切换，避免挤占顶栏。
 */
export function StyleDetailPage(): React.JSX.Element {
  const { id } = useParams()
  const [detail, setDetail] = useState<StyleDetail | null>(null)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [busy, setBusy] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<WorkflowProgress | null>(null)

  useWorkspaceBar({
    title: detail?.name ?? '风格详情',
    stages: [...STYLE_STAGES]
  })

  useEffect(() => {
    if (id) void window.api.styles.get(id).then(setDetail)
  }, [id])

  useEffect(() => {
    return window.api.onProgress((item) => {
      if (!item.styleId || item.styleId !== id) return
      setProgress(item)
    })
  }, [id])

  /**
   * 重新提取 Style DNA；失败时留在本页，可再试。
   */
  async function reextract(): Promise<void> {
    if (!id) return
    setExtracting(true)
    setError('')
    setProgress({ styleId: id, stage: 'document_analysis', message: '正在准备分析样本…', percent: 4 })
    try {
      const next = await window.api.styles.extract(id)
      setDetail(next)
      setTab('overview')
    } catch (item) {
      setError(ipcErrorMessage(item))
    } finally {
      setExtracting(false)
      setProgress(null)
    }
  }

  /**
   * 在现有档案上追加样本文档。
   */
  async function importMore(): Promise<void> {
    if (!id) return
    const files = await window.api.styles.importFolder(id)
    if (files.length === 0) return
    const next = await window.api.styles.get(id)
    setDetail(next)
  }

  /**
   * 用新文件夹替换样本，并清空旧的 Style DNA。
   */
  async function replaceFolder(): Promise<void> {
    if (!id) return
    setBusy(true)
    setError('')
    try {
      const files = await window.api.styles.replaceFolder(id)
      if (!files) return
      const next = await window.api.styles.get(id)
      setDetail(next)
      setTab('overview')
    } catch (item) {
      setError(ipcErrorMessage(item))
    } finally {
      setBusy(false)
    }
  }

  if (!detail) return <div className="page-fill text-sm text-[#9a8f82]">加载中…</div>
  const hasProfile = Boolean(detail.profile)
  const okDocs = detail.documents.filter((item) => item.parseStatus === 'ok').length
  const locked = busy || extracting

  return (
    <div className="page-fill">
      {error ? <div className="workflow-error">{error}</div> : null}

      <div className="style-detail-tabs" role="tablist" aria-label="风格详情">
        {DETAIL_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`style-detail-tab${tab === item.id ? ' style-detail-tab-active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <OverviewPane
          detail={detail}
          busy={locked}
          hasProfile={hasProfile}
          okDocs={okDocs}
          onSaved={(next) => setDetail((current) => (current ? { ...current, ...next } : current))}
          onImportMore={() => void importMore()}
          onReplaceFolder={() => void replaceFolder()}
          onExtract={() => void reextract()}
        />
      ) : null}
      {tab === 'language' ? (
        <DnaPane
          empty="还没有语言特征。请先提取 Style DNA。"
          hasContent={hasProfile}
          onExtract={() => void reextract()}
          busy={locked}
          okDocs={okDocs}
        >
          <pre className="whitespace-pre-wrap text-sm text-[#cfc3b5]">
            {JSON.stringify(detail.profile?.language, null, 2)}
          </pre>
        </DnaPane>
      ) : null}
      {tab === 'templates' ? (
        <DnaPane
          empty="还没有结构模板。请先提取 Style DNA。"
          hasContent={detail.templates.length > 0}
          onExtract={() => void reextract()}
          busy={locked}
          okDocs={okDocs}
        >
          <div className="space-y-4">
            {detail.templates.map((template, index) => (
              <div key={`${index}-${template.templateName}`} className="rounded-lg bg-[#0c0b0a] p-4">
                <div className="text-[#c4a574]">{template.templateName}</div>
                <div className="text-sm text-[#9a8f82]">{template.scenario}</div>
                {template.durationRange && template.durationRange !== '未指定' ? (
                  <div className="mt-1 text-xs text-[#9a8f82]">{template.durationRange}</div>
                ) : null}
                <ol className="mt-2 list-decimal pl-5 text-sm">
                  {template.sections.map((section, sectionIndex) => (
                    <li key={`${sectionIndex}-${section.name}`}>
                      {section.name} · {Math.round(section.timePercent * 100)}% · {section.purpose}
                      {section.instruction && section.instruction !== '样本中未体现' ? (
                        <div className="style-template-instruction">{section.instruction}</div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </DnaPane>
      ) : null}
      {tab === 'examples' ? (
        <DnaPane
          empty="还没有代表性片段。请先提取 Style DNA。"
          hasContent={detail.examples.length > 0}
          onExtract={() => void reextract()}
          busy={locked}
          okDocs={okDocs}
        >
          <div className="space-y-3">
            {detail.examples.map((example, index) => (
              <blockquote
                key={`${index}-${example.excerpt.slice(0, 24)}`}
                className="border-l-2 border-[#c4a574] pl-4 text-sm"
              >
                <div className="style-example-meta">
                  {example.scenario}
                  {example.structure && example.structure !== '样本中未体现'
                    ? ` · ${example.structure}`
                    : ''}
                </div>
                {example.excerpt}
                <div className="mt-1 text-xs text-[#9a8f82]">{example.whyRepresentative}</div>
              </blockquote>
            ))}
          </div>
        </DnaPane>
      ) : null}
      {tab === 'commercial' ? (
        <DnaPane
          empty="还没有商业表达特征。请先提取 Style DNA。"
          hasContent={Boolean(detail.profile)}
          onExtract={() => void reextract()}
          busy={locked}
          okDocs={okDocs}
        >
          <pre className="whitespace-pre-wrap text-sm">
            {JSON.stringify(detail.profile?.commercial, null, 2)}
          </pre>
        </DnaPane>
      ) : null}

      {extracting ? (
        <ExtractionWaitOverlay
          progress={progress}
          documentTotal={okDocs}
        />
      ) : null}
    </div>
  )
}

/**
 * 总览：档案信息、样本数量，以及提取后的语气指标。
 */
function OverviewPane({
  detail,
  busy,
  hasProfile,
  okDocs,
  onSaved,
  onImportMore,
  onReplaceFolder,
  onExtract
}: {
  detail: StyleDetail
  busy: boolean
  hasProfile: boolean
  okDocs: number
  onSaved: (next: StyleRecord) => void
  onImportMore: () => void
  onReplaceFolder: () => void
  onExtract: () => void
}): React.JSX.Element {
  const tone = detail.profile?.tone
  return (
    <>
      <section className="style-meta-panel">
        <div>
          <h3>档案信息</h3>
          <p>
            可随时改名称、平台、内容类型和风格简介，不会重新提取 Style DNA。
            {detail.isDemo ? ' 当前是 DEMO DATA（虚构演示，非真实博主）。' : ''}
          </p>
        </div>
        <StyleMetaEditor style={detail} onSaved={onSaved} />
      </section>
      <section className="style-meta-panel">
        <div>
          <h3>样本文档</h3>
          <p>
            {detail.documents.length} 篇导入 · {okDocs} 篇可提取
          </p>
        </div>
        <div className="style-recovery-actions">
          <button className="btn-ghost px-3 py-1.5 text-sm" disabled={busy} onClick={onImportMore}>
            <FolderOpen size={14} />
            补充文案
          </button>
          <button
            className="btn-ghost px-3 py-1.5 text-sm"
            disabled={busy}
            onClick={onReplaceFolder}
          >
            重新选择文件夹
          </button>
          <button
            className="btn-primary px-3 py-1.5 text-sm"
            disabled={busy || okDocs < 1}
            onClick={onExtract}
          >
            <RefreshCw size={14} />
            {hasProfile ? '重新提取' : '提取 Style DNA'}
          </button>
        </div>
        {detail.documents.length > 0 ? (
          <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-sm text-[#cfc3b5]">
            {detail.documents.map((doc) => (
              <li key={doc.id}>
                {doc.filename} · {doc.wordCount} 字 · {doc.parseStatus}
              </li>
            ))}
          </ul>
        ) : (
          <p className="style-meta-status">还没有样本文档，请先选择文件夹。</p>
        )}
      </section>
      {tone ? (
        <div className="rounded-2xl border border-[#2a241e] bg-[#161310] p-5">
          <p className="mb-3 text-xs text-[#9a8f82]">AI 分析指标，用于辅助理解风格特征。</p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {Object.entries(tone).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-[#0c0b0a] p-3">
                <div className="text-[#9a8f82]">{key}</div>
                <div className="text-xl text-[#c4a574]">{Math.round(value * 100)}</div>
              </div>
            ))}
            <div className="col-span-3 text-[#cfc3b5]">{detail.profile?.creator.description}</div>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <h2 className="text-lg">还没有 Style DNA</h2>
          <p className="mt-1 text-sm text-[#9a8f82]">
            {okDocs > 0
              ? '样本已就绪，提取失败也可以在本页直接重试，不必删档重建。'
              : '先补充或重新选择文案文件夹，再提取。'}
          </p>
        </div>
      )}
    </>
  )
}

/**
 * DNA 标签内容；没有提取结果时给出重试入口。
 */
function DnaPane({
  empty,
  hasContent,
  onExtract,
  busy,
  okDocs,
  children
}: {
  empty: string
  hasContent: boolean
  onExtract: () => void
  busy: boolean
  okDocs: number
  children: React.ReactNode
}): React.JSX.Element {
  if (!hasContent) {
    return (
      <div className="empty-state">
        <p className="text-sm text-[#9a8f82]">{empty}</p>
        <button
          className="btn-primary mt-4 px-4 py-2"
          disabled={busy || okDocs < 1}
          onClick={onExtract}
        >
          {busy ? '提取中…' : '提取 Style DNA'}
        </button>
      </div>
    )
  }
  return <div className="rounded-2xl border border-[#2a241e] bg-[#161310] p-5">{children}</div>
}
