import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExtractionWaitOverlay } from '@renderer/components/ExtractionWaitOverlay'
import { FieldInline } from '@renderer/components/FieldInline'
import { STYLE_STAGES } from '@renderer/navigation'
import { useWorkspaceBar } from '@renderer/workspace/WorkspaceContext'
import type { ScanFileResult, WorkflowProgress } from '@shared/ipc'
import { PLATFORMS, STYLE_CATEGORIES } from '@shared/constants'
import { ipcErrorMessage } from '@renderer/lib/utils'

/**
 * 新增写作风格：一次选择完成档案创建与样本导入，再提取 DNA。
 */
export function StyleNewPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('B站')
  const [category, setCategory] = useState<(typeof STYLE_CATEGORIES)[number]>('设计观点')
  const [notes, setNotes] = useState('')
  const [styleId, setStyleId] = useState<string | null>(null)
  const [files, setFiles] = useState<ScanFileResult[]>([])
  const [progress, setProgress] = useState<WorkflowProgress | null>(null)
  const [busy, setBusy] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState('')

  useWorkspaceBar({
    title: '风格库',
    stages: [...STYLE_STAGES]
  })

  useEffect(() => {
    return window.api.onProgress((item) => {
      if (!item.styleId) return
      if (styleId && item.styleId !== styleId) return
      setProgress(item)
    })
  }, [styleId])

  /**
   * 选择文件夹成功后创建风格并导入文案，取消选择不会留下空档案。
   */
  async function createAndImport(): Promise<void> {
    if (!name.trim()) {
      setError('请先填写风格名称')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await window.api.styles.createFromFolder({
        name: name.trim(),
        platform,
        category: category.trim(),
        notes: notes.trim()
      })
      if (!result) return
      setStyleId(result.style.id)
      setFiles(result.files)
    } catch (item) {
      setError(ipcErrorMessage(item))
    } finally {
      setBusy(false)
    }
  }

  /**
   * 为已创建档案补充导入更多文案。
   */
  async function importMore(): Promise<void> {
    if (!styleId) return
    const scanned = await window.api.styles.importFolder(styleId)
    setFiles((current) => [...current, ...scanned])
  }

  /**
   * 档案创建后把后续修改写回，避免只能删了重建。
   */
  async function persistMeta(patch: {
    name?: string
    platform?: string
    category?: string
    notes?: string
  }): Promise<void> {
    if (!styleId) return
    try {
      await window.api.styles.update(styleId, patch)
    } catch (item) {
      setError(ipcErrorMessage(item))
    }
  }

  /**
   * 用新文件夹替换样本；取消选择不会清空已有文案。
   */
  async function replaceFolder(): Promise<void> {
    if (!styleId) return
    setBusy(true)
    setError('')
    try {
      const scanned = await window.api.styles.replaceFolder(styleId)
      if (!scanned) return
      setFiles(scanned)
      setProgress(null)
    } catch (item) {
      setError(ipcErrorMessage(item))
    } finally {
      setBusy(false)
    }
  }

  /**
   * 提取 Style DNA 后进入详情；失败时留在本页，可重试或重选文件夹。
   */
  async function extract(): Promise<void> {
    if (!styleId) return
    setExtracting(true)
    setError('')
    setProgress({
      styleId,
      stage: 'document_analysis',
      message: '正在准备分析样本…',
      percent: 4
    })
    try {
      await window.api.styles.extract(styleId)
      navigate(`/styles/${styleId}`, { replace: true })
    } catch (item) {
      setError(ipcErrorMessage(item))
      setProgress(null)
    } finally {
      setExtracting(false)
    }
  }

  const okCount = files.filter((item) => item.parseStatus === 'ok').length
  const failCount = files.filter((item) => item.parseStatus === 'failed').length
  const locked = busy || extracting

  return (
    <div className="page-fill">
      <div>
        <h2 className="text-xl font-semibold">用历史文案创建 Style DNA</h2>
        <p className="mt-1 text-sm text-[#9a8f82]">
          填写基本信息后直接选择文案文件夹，无需先保存空档案。
        </p>
      </div>
      {error ? (
        <div className="workflow-error">
          <p>{error}</p>
          {styleId ? (
            <div className="style-recovery-actions">
              <button
                className="btn-primary px-3 py-1.5 text-sm"
                disabled={locked || okCount < 1}
                onClick={() => void extract()}
              >
                {extracting ? '提取中…' : '重新提取'}
              </button>
              <button
                className="btn-ghost px-3 py-1.5 text-sm"
                disabled={locked}
                onClick={() => void importMore()}
              >
                补充文案
              </button>
              <button
                className="btn-ghost px-3 py-1.5 text-sm"
                disabled={locked}
                onClick={() => void replaceFolder()}
              >
                重新选择文件夹
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-4">
        <section
          className={`workflow-card${styleId ? ' workflow-card-complete' : ' workflow-card-active'}`}
        >
          <div className="workflow-card-heading">
            <span className="workflow-step-index">01</span>
            <h3>风格信息</h3>
            <span>{styleId ? '已完成' : '当前步骤'}</span>
          </div>
          <div className="space-y-3">
            <FieldInline label="博主名称" htmlFor="styleName">
              <input
                id="styleName"
                className="rounded bg-[#0c0b0a] px-3 py-2 text-[#f3ece1]"
                placeholder="请输入博主名称"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  const next = name.trim()
                  if (!next) {
                    setError('请填写风格名称')
                    return
                  }
                  void persistMeta({ name: next })
                }}
              />
            </FieldInline>
            <FieldInline label="发布平台" htmlFor="stylePlatform">
              <select
                id="stylePlatform"
                className="rounded bg-[#0c0b0a] px-3 py-2 text-[#f3ece1]"
                value={platform}
                onChange={(e) => {
                  setPlatform(e.target.value)
                  void persistMeta({ platform: e.target.value })
                }}
              >
                {PLATFORMS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </FieldInline>
            <FieldInline label="内容类型" htmlFor="styleCategory">
              <select
                id="styleCategory"
                className="rounded bg-[#0c0b0a] px-3 py-2 text-[#f3ece1]"
                value={category}
                onChange={(e) => {
                  const next = e.target.value as (typeof STYLE_CATEGORIES)[number]
                  setCategory(next)
                  void persistMeta({ category: next })
                }}
              >
                {STYLE_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </FieldInline>
            <FieldInline label="备注" htmlFor="styleNotes">
              <input
                id="styleNotes"
                className="rounded bg-[#0c0b0a] px-3 py-2 text-[#f3ece1]"
                placeholder="选填"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => void persistMeta({ notes })}
              />
            </FieldInline>
          </div>
          {styleId ? (
            <div className="mt-4 space-y-2">
              <div className="text-sm text-emerald-400">档案已创建，仍可改信息和样本。</div>
              <button
                className="btn-ghost px-4 py-2"
                disabled={locked}
                onClick={() => void replaceFolder()}
              >
                重新选择文件夹
              </button>
            </div>
          ) : (
            <button
              className="mt-4 btn-primary px-4 py-2"
              disabled={locked || !name.trim()}
              onClick={() => void createAndImport()}
            >
              {busy ? '正在导入…' : '选择文案文件夹并继续'}
            </button>
          )}
        </section>
        <section
          className={`workflow-card${styleId ? ' workflow-card-active' : ' workflow-card-locked'}`}
        >
          <div className="workflow-card-heading">
            <span className="workflow-step-index">02</span>
            <h3>核对样本</h3>
            <span>{styleId ? `${okCount} 篇可用` : '等待上一步'}</span>
          </div>
          <p className="mb-3 text-sm text-[#9a8f82]">支持 txt / md / rtf，推荐 3~20 篇。</p>
          <button
            className="btn-ghost px-4 py-2"
            onClick={() => void importMore()}
            disabled={!styleId || locked}
          >
            补充更多文案
          </button>
          <div className="mt-3 text-sm text-[#9a8f82]">
            成功 {okCount} · 失败 {failCount}
          </div>
          <ul className="mt-2 max-h-56 space-y-1 overflow-auto text-sm">
            {files.map((file) => (
              <li key={file.filename}>
                {file.filename} · {file.wordCount} 字 · {file.parseStatus}
                {file.parseError ? `（${file.parseError}）` : ''}
              </li>
            ))}
          </ul>
        </section>
        <section
          className={`workflow-card${okCount > 0 ? ' workflow-card-active' : ' workflow-card-locked'}`}
        >
          <div className="workflow-card-heading">
            <span className="workflow-step-index">03</span>
            <h3>提取 Style DNA</h3>
            <span>{okCount > 0 ? '可以开始' : '等待有效样本'}</span>
          </div>
          <p className="mb-3 text-sm text-[#9a8f82]">
            将依次完成：清洗、单篇分析、聚合、结构模板、few-shot、质量检查。
          </p>
          <button
            className="btn-primary px-4 py-2"
            disabled={!styleId || okCount < 1 || locked}
            onClick={() => void extract()}
          >
            {extracting ? '提取中…' : error ? '重新提取' : '开始提取'}
          </button>
        </section>
      </div>
      {extracting ? <ExtractionWaitOverlay progress={progress} documentTotal={okCount} /> : null}
    </div>
  )
}
