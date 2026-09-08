import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { WORKFLOW_STAGES } from '@renderer/navigation'
import { useWorkspaceBar, WorkspaceActions } from '@renderer/workspace/WorkspaceContext'
import type { ProjectDetail, WorkflowProgress } from '@shared/ipc'

const rewriteActions = [
  { label: '重写这一段', instruction: '重写这一段，保持事实' },
  { label: '更口语', instruction: '更口语' },
  { label: '更专业', instruction: '更专业' },
  { label: '增加冲突', instruction: '增加冲突' },
  { label: '压缩', instruction: '压缩' },
  { label: '扩写', instruction: '扩写' },
  { label: '重写 Hook', instruction: '重新写 Hook' },
  { label: '重写结尾', instruction: '重新写结尾' }
]

/**
 * 文案工作台：看见什么 / 怎么分析 / 怎么组织 / 成稿。
 */
export function WorkbenchPage(): React.JSX.Element {
  const { id } = useParams()
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [tab, setTab] = useState<'vision' | 'pfdbi' | 'script'>('script')
  const [progress, setProgress] = useState<WorkflowProgress | null>(null)
  const [busy, setBusy] = useState(false)
  const [script, setScript] = useState('')
  const [error, setError] = useState('')

  useWorkspaceBar({
    title: detail?.title ?? '文案工作台',
    stages: [
      { id: 'list', label: '项目列表', to: '/workbench' },
      ...WORKFLOW_STAGES
    ],
    activeStage: tab,
    onStageSelect: (stageId) => {
      if (stageId === 'vision' || stageId === 'pfdbi' || stageId === 'script') {
        setTab(stageId)
      }
    }
  })

  async function refresh(): Promise<void> {
    if (!id) return
    const next = await window.api.projects.get(id)
    setDetail(next)
    setScript(next?.finalDraft?.script ?? next?.baseDraft?.script ?? '')
  }

  useEffect(() => {
    let active = true
    const stop = window.api.onProgress(setProgress)
    if (id) {
      void window.api.projects.get(id).then((next) => {
        if (!active) return
        setDetail(next)
        setScript(next?.finalDraft?.script ?? next?.baseDraft?.script ?? '')
      })
    }
    return () => {
      active = false
      stop()
    }
  }, [id])

  const wordCount = script.replace(/\s/g, '').length
  const usageTotal = useMemo(
    () => detail?.usage.reduce((sum, item) => sum + item.totalTokens, 0) ?? 0,
    [detail]
  )

  async function generate(): Promise<void> {
    if (!id) return
    setBusy(true)
    setError('')
    try {
      const next = await window.api.projects.generate(id)
      setDetail(next)
      setScript(next.finalDraft?.script ?? '')
      setTab('script')
    } catch (item) {
      setError(item instanceof Error ? item.message : String(item))
    } finally {
      setBusy(false)
    }
  }

  async function addImages(): Promise<void> {
    if (!id) return
    await window.api.projects.addImages(id)
    await refresh()
    setTab('vision')
  }

  async function saveScript(): Promise<void> {
    if (!id) return
    await window.api.projects.update(id, { finalScript: script })
    await refresh()
  }

  async function rewrite(instruction: string): Promise<void> {
    if (!id) return
    const selected = window.getSelection()?.toString() || script.slice(0, 80)
    const next = await window.api.projects.rewrite(id, selected, instruction)
    setScript(script.replace(selected, next))
  }

  async function exportFile(format: 'txt' | 'md'): Promise<void> {
    if (!id) return
    await window.api.projects.export(id, format)
  }

  if (!id) {
    return (
      <div className="page-fill text-sm">
        请选择项目。可从{' '}
        <Link to="/workbench" className="text-[#c4a574] underline-offset-2 hover:underline">
          项目列表
        </Link>{' '}
        进入。
      </div>
    )
  }

  if (!detail) {
    return <div className="page-fill text-sm text-[#9a8f82]">加载中…</div>
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <WorkspaceActions>
        <button className="btn-secondary px-3 py-1.5 text-sm" onClick={() => void addImages()}>
          添加参考图
        </button>
        <button
          className="btn-primary px-3 py-1.5 text-sm"
          disabled={busy}
          onClick={() => void generate()}
        >
          {busy ? '生成中…' : '按工作流生成'}
        </button>
      </WorkspaceActions>
      <p className="text-sm text-[#9a8f82]">
        {detail.platform} · 目标 {Math.round(detail.durationSeconds / 60)} 分钟 · {detail.contentType}
        {detail.matchedTemplate ? ` · 推荐模板：${detail.matchedTemplate.templateName}` : ''}
      </p>
      {progress && busy ? (
        <div className="rounded-lg border border-[#c4a574]/40 bg-[#161310] px-4 py-2 text-sm text-[#c4a574]">
          {progress.stage} · {progress.message} · {progress.percent}%
        </div>
      ) : null}
      {error ? <div className="text-sm text-red-400">{error}</div> : null}
      {detail.matchedTemplate ? (
        <div className="text-sm text-[#9a8f82]">推荐原因：{detail.matchedTemplate.reason}</div>
      ) : null}
      {tab === 'vision' ? <VisionPane detail={detail} onChange={() => void refresh()} /> : null}
      {tab === 'pfdbi' ? <PfdbiPane detail={detail} /> : null}
      {tab === 'script' ? (
        <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr_280px] gap-4">
          <aside className="space-y-3 overflow-auto rounded-2xl border border-[#2a241e] bg-[#161310] p-4 text-sm">
            <div className="text-[#c4a574]">项目参数</div>
            <div>平台 {detail.platform}</div>
            <div>类型 {detail.contentType}</div>
            <div>风格 {detail.styleId ? '已选择' : '未选择'}</div>
            <div className="text-[#c4a574]">版本</div>
            {detail.versions.map((version) => (
              <button
                key={version.id}
                className="btn-chip block w-full px-2 py-1 text-left text-xs"
                onClick={() => void window.api.projects.restoreVersion(version.id).then(setDetail)}
              >
                V{version.version} {version.label}
              </button>
            ))}
          </aside>
          <section className="flex flex-col rounded-2xl border border-[#2a241e] bg-[#161310] p-4">
            <textarea
              className="min-h-[420px] flex-1 bg-transparent leading-7 outline-none"
              value={script}
              onChange={(e) => setScript(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {rewriteActions.map((item) => (
                <button
                  key={item.label}
                  className="btn-chip px-2 py-1 text-xs"
                  onClick={() => void rewrite(item.instruction)}
                >
                  {item.label}
                </button>
              ))}
              <button className="btn-primary px-3 py-1 text-xs" onClick={() => void saveScript()}>
                保存版本
              </button>
              <button
                className="btn-secondary px-3 py-1 text-xs"
                onClick={() => void exportFile('txt')}
              >
                导出 TXT
              </button>
              <button
                className="btn-secondary px-3 py-1 text-xs"
                onClick={() => void exportFile('md')}
              >
                导出 MD
              </button>
            </div>
          </section>
          <aside className="space-y-3 overflow-auto rounded-2xl border border-[#2a241e] bg-[#161310] p-4 text-sm">
            <div className="text-[#c4a574]">质量 / 时长</div>
            <div>字数 {wordCount}</div>
            <div>
              Token {usageTotal}
              {detail.usage.some((item) => item.estimated) ? '（含估算）' : ''}
            </div>
            {detail.quality ? (
              <>
                <div>风格一致性 {Math.round(detail.quality.styleConsistency * 100)}</div>
                <div>时长分 {Math.round(detail.quality.durationScore * 100)}</div>
                {detail.quality.durationWarning ? (
                  <div className="text-amber-400">{detail.quality.durationWarning}</div>
                ) : null}
                <div className="text-xs text-[#9a8f82]">
                  {detail.quality.suggestions.join('；')}
                </div>
                <div className="text-xs text-amber-200">{detail.quality.factRisk.join('；')}</div>
              </>
            ) : (
              <div className="text-[#9a8f82]">生成后显示质检</div>
            )}
            {detail.usage.map((item) => (
              <div key={`${item.task}-${item.model}`} className="text-xs text-[#9a8f82]">
                {item.task}: {item.totalTokens} tokens
              </div>
            ))}
          </aside>
        </div>
      ) : null}
    </div>
  )
}

function VisionPane({
  detail,
  onChange
}: {
  detail: ProjectDetail
  onChange: () => void
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="grid grid-cols-2 gap-3">
        {detail.images.map((image) => (
          <div key={image.id} className="rounded-xl bg-[#161310] p-2">
            <img
              src={image.dataUrl}
              alt={image.filename}
              className="h-40 w-full rounded object-cover"
            />
            <div className="mt-1 text-xs text-[#9a8f82]">{image.filename}</div>
            <button
              className="btn-ghost mt-1 px-2 py-1 text-xs"
              onClick={() => {
                const note = window.prompt('标注备注（重点分析 / 不要分析）', '这里重点分析') ?? ''
                if (!note) return
                void window.api.projects
                  .saveAnnotation({
                    imageId: image.id,
                    x: 0.1,
                    y: 0.1,
                    width: 0.4,
                    height: 0.3,
                    note
                  })
                  .then(onChange)
              }}
            >
              添加矩形标注
            </button>
          </div>
        ))}
        {detail.images.length === 0 ? (
          <div className="text-sm text-[#9a8f82]">还没有参考图。演示项目可能仅含文本观察。</div>
        ) : null}
      </div>
      <div className="space-y-3 overflow-auto">
        {detail.visionObservations.map((item) => (
          <article
            key={item.imageId}
            className="rounded-xl border border-[#2a241e] bg-[#161310] p-4 text-sm"
          >
            <div className="text-[#c4a574]">
              {item.viewType} · {item.vehicleIdentification.brand}/
              {item.vehicleIdentification.model}
            </div>
            <p className="mt-2">{item.overall.silhouette}</p>
            <ul className="mt-2 list-disc pl-5 text-[#cfc3b5]">
              {item.observations.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="mt-2 text-xs text-amber-200">
              不确定：{item.uncertainties.join('；')}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function PfdbiPane({ detail }: { detail: ProjectDetail }): React.JSX.Element {
  const analysis = detail.pfdbi
  if (!analysis)
    return <div className="text-sm text-[#9a8f82]">尚未生成 PFDBI。点击“按工作流生成”。</div>
  const cards = [
    ['P', 'Proportion', analysis.P],
    ['F', 'Form', analysis.F],
    ['D', 'Detail', analysis.D],
    ['B', 'Brand / Brief', analysis.B],
    ['I', 'Innovation', analysis.I]
  ] as const
  return (
    <div>
      <p className="mb-4 text-sm text-[#cfc3b5]">{analysis.coreConclusion}</p>
      <div className="grid grid-cols-5 gap-3">
        {cards.map(([key, title, dim]) => (
          <article
            key={key}
            className="rounded-xl border border-[#2a241e] bg-[#161310] p-3 text-sm"
          >
            <div className="text-[#c4a574]">
              {key} {title}
            </div>
            <div className="mt-2 text-xs text-[#9a8f82]">
              {dim.applicable ? '可评价' : '暂无足够证据'}
            </div>
            <p className="mt-2">{dim.judgement}</p>
            <div className="mt-2 text-xs">观察：{dim.observations.join('；')}</div>
            <div className="mt-1 text-xs">证据：{dim.evidence.join('；')}</div>
          </article>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg bg-[#161310] p-3">事实：{analysis.facts.join('；')}</div>
        <div className="rounded-lg bg-[#161310] p-3">推断：{analysis.inferences.join('；')}</div>
        <div className="rounded-lg bg-[#161310] p-3">
          偏好：{analysis.personalPreferences.join('；')}
        </div>
      </div>
    </div>
  )
}
