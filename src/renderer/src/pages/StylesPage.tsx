import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileUp, Pencil, Trash2 } from 'lucide-react'
import { StyleMetaEditor } from '@renderer/components/StyleMetaEditor'
import { STYLE_STAGES } from '@renderer/navigation'
import { useWorkspaceBar } from '@renderer/workspace/WorkspaceContext'
import { ipcErrorMessage } from '@renderer/lib/utils'
import { PLATFORMS, STYLE_CATEGORIES } from '@shared/constants'
import type { StyleIngestJob, StylePreviewCard, StyleRecord } from '@shared/ipc'

const JOB_STATUS_LABEL: Record<StyleIngestJob['status'], string> = {
  queued: '排队中',
  extracting: '提取中',
  completed: '已完成',
  failed: '失败',
  ingested: '已入库'
}

/**
 * 风格库默认入口：上传文稿、按篇排队提取、确认预览卡后入库。
 */
export function StylesPage(): React.JSX.Element {
  const [styles, setStyles] = useState<StyleRecord[]>([])
  const [jobs, setJobs] = useState<StyleIngestJob[]>([])
  const [pendingDelete, setPendingDelete] = useState<StyleRecord | null>(null)
  const [editing, setEditing] = useState<StyleRecord | null>(null)
  const [previewJob, setPreviewJob] = useState<StyleIngestJob | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useWorkspaceBar({
    title: '风格库',
    stages: [...STYLE_STAGES]
  })

  /**
   * 刷新已入库风格与提取任务。
   */
  async function refresh(): Promise<void> {
    const [nextStyles, nextJobs] = await Promise.all([
      window.api.styles.list(),
      window.api.styles.listJobs()
    ])
    setStyles(nextStyles)
    setJobs(nextJobs)
    setPreviewJob((current) => {
      if (!current) return null
      return nextJobs.find((item) => item.id === current.id) ?? current
    })
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    const stop = window.api.onProgress((progress) => {
      if (!progress.jobId) return
      void refresh()
    })
    return stop
  }, [])

  const queueJobs = useMemo(
    () => jobs.filter((item) => item.status !== 'ingested'),
    [jobs]
  )
  const activeQueue = useMemo(
    () => queueJobs.some((item) => item.status === 'queued' || item.status === 'extracting'),
    [queueJobs]
  )

  useEffect(() => {
    if (!activeQueue) return
    const timer = window.setInterval(() => {
      void refresh()
    }, 2500)
    return () => window.clearInterval(timer)
  }, [activeQueue])

  /**
   * 选择任意数量 txt/md/rtf，一篇文档一个提取任务。
   */
  async function uploadDocuments(): Promise<void> {
    setBusy(true)
    setError('')
    try {
      await window.api.styles.ingestPick()
      await refresh()
    } catch (item) {
      setError(ipcErrorMessage(item))
    } finally {
      setBusy(false)
    }
  }

  async function removeStyle(): Promise<void> {
    if (!pendingDelete) return
    const style = pendingDelete
    setDeletingId(style.id)
    try {
      await window.api.styles.remove(style.id)
      setStyles((current) => current.filter((item) => item.id !== style.id))
      setPendingDelete(null)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="page-fill style-library">
      <section className="style-ingest-hero">
        <div>
          <h2>上传文稿，按篇生成预览风格卡</h2>
          <p>
            不必先填博主档案。每篇 txt / md / rtf 进入后台队列，提取完成后打开预览卡，确认才入库。
          </p>
        </div>
        <div className="style-ingest-hero-actions">
          <button className="btn-primary px-4 py-2" disabled={busy} onClick={() => void uploadDocuments()}>
            <FileUp size={15} />
            {busy ? '正在加入队列…' : '上传文稿'}
          </button>
        </div>
      </section>
      {error ? <div className="workflow-error">{error}</div> : null}

      <section className="style-job-panel">
        <div className="stage-panel-header">
          <div>
            <h3>提取任务</h3>
            <p>可离开本页去工作台，回来后状态仍在。不弹提取等待窗。</p>
          </div>
          <span className="text-xs text-[#9a8f82]">{queueJobs.length} 条</span>
        </div>
        {queueJobs.length === 0 ? (
          <p className="text-sm text-[#9a8f82]">还没有提取任务。</p>
        ) : (
          <ul className="style-job-list">
            {queueJobs.map((job) => (
              <li key={job.id} className={`style-job-row status-${job.status}`}>
                <div>
                  <b>{job.filename}</b>
                  <span>
                    {JOB_STATUS_LABEL[job.status]}
                    {job.wordCount ? ` · ${job.wordCount} 字` : ''}
                  </span>
                  <p>{job.progressMessage || job.error || '—'}</p>
                  {job.status === 'extracting' || job.status === 'queued' ? (
                    <div className="style-job-bar">
                      <i style={{ width: `${Math.max(job.progressPercent, job.status === 'queued' ? 4 : 8)}%` }} />
                    </div>
                  ) : null}
                </div>
                <div className="style-job-actions">
                  {job.status === 'completed' ? (
                    <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => setPreviewJob(job)}>
                      打开预览卡
                    </button>
                  ) : null}
                  {job.status === 'failed' ? (
                    <button
                      className="btn-secondary px-3 py-1.5 text-xs"
                      onClick={() => void window.api.styles.retryJob(job.id).then(() => refresh())}
                    >
                      重试
                    </button>
                  ) : null}
                  {job.status !== 'extracting' ? (
                    <button
                      className="btn-ghost px-3 py-1.5 text-xs"
                      onClick={() =>
                        void window.api.styles.discardJob(job.id).then(() => {
                          if (previewJob?.id === job.id) setPreviewJob(null)
                          return refresh()
                        })
                      }
                    >
                      丢弃
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="stage-panel-header">
          <div>
            <h3>已入库风格卡</h3>
            <p>只有确认入库的卡才会出现在文案生成的候选里。卡片简介来自提取，工作台按它匹配风格。</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {styles.map((style) => (
            <article key={style.id} className="style-list-card">
              <Link to={`/styles/${style.id}`} className="style-list-link">
                <div className="flex items-center justify-between">
                  <div className="text-lg">{style.name}</div>
                  {style.isDemo ? <span className="text-xs text-[#c4a574]">DEMO DATA</span> : null}
                </div>
                <div className="mt-2 text-sm text-[#9a8f82]">
                  {style.platform} · {style.category}
                </div>
                <p className="mt-3 text-sm text-[#cfc3b5]">{style.notes || '暂无简介'}</p>
                <div className="mt-4 text-xs text-[#9a8f82]">进入查看 Style DNA 与结构模板</div>
              </Link>
              <div className="style-card-actions">
                <button
                  type="button"
                  className="style-edit-button"
                  title={`编辑${style.name}`}
                  aria-label={`编辑风格 ${style.name}`}
                  onClick={() => setEditing(style)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  className="style-delete-button"
                  disabled={deletingId === style.id}
                  title={`删除${style.name}`}
                  aria-label={`删除风格 ${style.name}`}
                  onClick={() => setPendingDelete(style)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
        {styles.length === 0 ? <div className="text-sm text-[#9a8f82]">还没有已入库风格卡。</div> : null}
      </section>

      {previewJob?.preview ? (
        <StylePreviewDialog
          job={previewJob}
          preview={previewJob.preview}
          onClose={() => setPreviewJob(null)}
          onChanged={refresh}
        />
      ) : null}

      {editing ? (
        <div className="confirm-overlay" role="presentation" onMouseDown={() => setEditing(null)}>
          <section
            className="confirm-dialog style-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-style-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h3 id="edit-style-title">编辑“{editing.name}”</h3>
            <StyleMetaEditor
              style={editing}
              onSaved={(next) => {
                setStyles((current) => current.map((item) => (item.id === next.id ? next : item)))
                setEditing(next)
              }}
            />
            <div className="confirm-actions">
              <button type="button" className="btn-secondary px-4 py-2" onClick={() => setEditing(null)}>
                完成
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {pendingDelete ? (
        <div
          className="confirm-overlay"
          role="presentation"
          onMouseDown={() => setPendingDelete(null)}
        >
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-style-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h3 id="delete-style-title">删除这个风格？</h3>
            <p>
              “{pendingDelete.name}”的样本文档、Style DNA、结构模板和 Few-shot
              会一起删除。已有项目不会删除，但会解除该风格引用。此操作无法撤销。
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="btn-secondary px-4 py-2"
                disabled={deletingId !== null}
                onClick={() => setPendingDelete(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="danger-button px-4 py-2"
                disabled={deletingId !== null}
                onClick={() => void removeStyle()}
              >
                {deletingId ? '正在删除…' : '确认删除'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

/**
 * 预览风格卡：人可改作者、内容类型和平台，确认后带上提取出的风格简介入库。
 */
function StylePreviewDialog({
  job,
  preview,
  onClose,
  onChanged
}: {
  job: StyleIngestJob
  preview: StylePreviewCard
  onClose: () => void
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const [author, setAuthor] = useState(preview.author)
  const [category, setCategory] = useState(preview.category)
  const [platform, setPlatform] = useState(preview.platform || 'B站')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const exampleLines = preview.examples
    .map((item) => item.excerpt.trim())
    .filter(Boolean)
    .slice(0, 5)

  async function confirm(): Promise<void> {
    setSaving(true)
    setError('')
    try {
      await window.api.styles.confirmJob(job.id, { author, category, platform })
      await onChanged()
      onClose()
    } catch (item) {
      setError(ipcErrorMessage(item))
    } finally {
      setSaving(false)
    }
  }

  async function discard(): Promise<void> {
    setSaving(true)
    setError('')
    try {
      await window.api.styles.discardJob(job.id)
      await onChanged()
      onClose()
    } catch (item) {
      setError(ipcErrorMessage(item))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="confirm-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="confirm-dialog style-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="style-preview-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h3 id="style-preview-title">
          {author} · {category}
        </h3>
        <p className="style-preview-source">
          来源 {preview.sourceFilename} · {preview.wordCount} 字。确认前不会进入创作候选。
        </p>
        {error ? <div className="workflow-error">{error}</div> : null}
        <div className="style-preview-fields">
          <label>
            作者
            <input value={author} onChange={(event) => setAuthor(event.target.value)} />
          </label>
          <label>
            内容类型
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {STYLE_CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            适用平台
            <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
              {PLATFORMS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="style-preview-summary">
          <span className="style-preview-notes-label">风格简介</span>
          {preview.notes || preview.summary}
        </p>
        <div className="style-preview-columns">
          <div>
            <h4>结构模板</h4>
            {preview.templates[0] ? (
              <article>
                <b>{preview.templates[0].templateName}</b>
                <ul>
                  {preview.templates[0].sections.map((section) => (
                    <li key={`${preview.templates[0].templateName}-${section.name}`}>
                      {section.name}
                      {section.purpose ? ` · ${section.purpose}` : ''}
                    </li>
                  ))}
                </ul>
              </article>
            ) : (
              <p>暂无结构模板</p>
            )}
          </div>
          <div>
            <h4>示例句</h4>
            {exampleLines.length === 0 ? <p>暂无示例句</p> : null}
            <ul>
              {exampleLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="confirm-actions">
          <button type="button" className="btn-ghost px-4 py-2" disabled={saving} onClick={onClose}>
            稍后处理
          </button>
          <button type="button" className="btn-secondary px-4 py-2" disabled={saving} onClick={() => void discard()}>
            丢弃
          </button>
          <button type="button" className="btn-primary px-4 py-2" disabled={saving} onClick={() => void confirm()}>
            {saving ? '正在入库…' : '确认入库'}
          </button>
        </div>
      </section>
    </div>
  )
}
