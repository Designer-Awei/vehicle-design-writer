import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FieldInline } from '@renderer/components/FieldInline'
import { STYLE_STAGES } from '@renderer/navigation'
import { useWorkspaceBar } from '@renderer/workspace/WorkspaceContext'
import type { ScanFileResult } from '@shared/ipc'
import { PLATFORMS } from '@shared/constants'

/**
 * 新增写作风格：创建博主 → 导入文件夹 → 提取 DNA。
 */
export function StyleNewPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('B站')
  const [category, setCategory] = useState('汽车设计评论')
  const [notes, setNotes] = useState('')
  const [styleId, setStyleId] = useState<string | null>(null)
  const [files, setFiles] = useState<ScanFileResult[]>([])
  const [progress, setProgress] = useState('')
  const [busy, setBusy] = useState(false)

  useWorkspaceBar({
    title: '风格库',
    stages: [...STYLE_STAGES]
  })

  useEffect(() => {
    return window.api.onProgress((item) => setProgress(`${item.message} ${item.percent}%`))
  }, [])

  /**
   * 创建博主档案。
   */
  async function create(): Promise<void> {
    const created = await window.api.styles.create({ name, platform, category, notes })
    setStyleId(created.id)
  }

  /**
   * 导入文案文件夹。
   */
  async function importFolder(): Promise<void> {
    if (!styleId) return
    const scanned = await window.api.styles.importFolder(styleId)
    setFiles(scanned)
  }

  /**
   * 提取 Style DNA 后进入详情。
   */
  async function extract(): Promise<void> {
    if (!styleId) return
    setBusy(true)
    try {
      await window.api.styles.extract(styleId)
      navigate(`/styles/${styleId}`, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  const okCount = files.filter((item) => item.parseStatus === 'ok').length
  const failCount = files.filter((item) => item.parseStatus === 'failed').length

  return (
    <div className="page-fill">
      <div className="grid grid-cols-3 gap-4">
        <section className="rounded-2xl border border-[#2a241e] bg-[#161310] p-5">
          <h2 className="mb-3 text-[#c4a574]">1. 创建博主</h2>
          <div className="space-y-3">
            <FieldInline label="博主名称" htmlFor="styleName">
              <input
                id="styleName"
                className="rounded bg-[#0c0b0a] px-3 py-2 text-[#f3ece1]"
                placeholder="请输入博主名称"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FieldInline>
            <FieldInline label="发布平台" htmlFor="stylePlatform">
              <select
                id="stylePlatform"
                className="rounded bg-[#0c0b0a] px-3 py-2 text-[#f3ece1]"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                {PLATFORMS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </FieldInline>
            <FieldInline label="类别" htmlFor="styleCategory">
              <input
                id="styleCategory"
                className="rounded bg-[#0c0b0a] px-3 py-2 text-[#f3ece1]"
                placeholder="如汽车设计评论"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </FieldInline>
            <FieldInline label="备注" htmlFor="styleNotes">
              <input
                id="styleNotes"
                className="rounded bg-[#0c0b0a] px-3 py-2 text-[#f3ece1]"
                placeholder="选填"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </FieldInline>
          </div>
          <button className="mt-4 btn-primary px-4 py-2" onClick={() => void create()}>
            保存档案
          </button>
          {styleId ? <div className="mt-2 text-xs text-emerald-400">已创建 {styleId}</div> : null}
        </section>
        <section className="rounded-2xl border border-[#2a241e] bg-[#161310] p-5">
          <h2 className="mb-3 text-[#c4a574]">2. 导入文案</h2>
          <p className="mb-3 text-sm text-[#9a8f82]">支持 txt / md / rtf，推荐 3~20 篇。</p>
          <button className="btn-ghost px-4 py-2" onClick={() => void importFolder()} disabled={!styleId}>
            选择文件夹
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
        <section className="rounded-2xl border border-[#2a241e] bg-[#161310] p-5">
          <h2 className="mb-3 text-[#c4a574]">3. 提取 Style DNA</h2>
          <p className="mb-3 text-sm text-[#9a8f82]">
            将依次完成：清洗、单篇分析、聚合、结构模板、few-shot、质量检查。
          </p>
          <button
            className="btn-primary px-4 py-2"
            disabled={!styleId || okCount < 1 || busy}
            onClick={() => void extract()}
          >
            {busy ? '提取中…' : '开始提取'}
          </button>
          {progress ? <div className="mt-3 text-sm text-[#c4a574]">{progress}</div> : null}
        </section>
      </div>
    </div>
  )
}
