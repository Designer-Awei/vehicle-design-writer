import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ImagePlus, Pencil, Play, Trash2 } from 'lucide-react'
import { AnnotationEditor } from '@renderer/components/AnnotationEditor'
import { useWorkspaceBar, WorkspaceActions } from '@renderer/workspace/WorkspaceContext'
import { ipcErrorMessage } from '@renderer/lib/utils'
import { CONTENT_TYPES, PLATFORMS, type ContentType } from '@shared/constants'
import type { ProjectDetail, StyleRecord, WorkflowProgress } from '@shared/ipc'
import type { ImageRole, PFDBIAnalysis } from '@schemas/index'

type WorkbenchStage = 'images' | 'vision' | 'pfdbi' | 'brief' | 'script'

const rewriteActions = [
  { label: '更口语', instruction: '更口语' },
  { label: '更专业', instruction: '更专业' },
  { label: '增加冲突', instruction: '增加冲突' },
  { label: '压缩', instruction: '压缩' },
  { label: '扩写', instruction: '扩写' },
  { label: '重写 Hook', instruction: '重新写 Hook' },
  { label: '重写结尾', instruction: '重新写结尾' }
]

const roleLabels: Record<ImageRole, string> = {
  primary: '主分析车型',
  other: '其他车型'
}

/**
 * 串行文案工作台：参考图与标注 → 视觉观察 → PFDBI → 成稿设置 → 文案编辑。
 */
export function WorkbenchPage(): React.JSX.Element {
  const { id } = useParams()
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [styles, setStyles] = useState<StyleRecord[]>([])
  const [stage, setStage] = useState<WorkbenchStage>('images')
  const [progress, setProgress] = useState<WorkflowProgress | null>(null)
  const [busy, setBusy] = useState(false)
  const [script, setScript] = useState('')
  const [error, setError] = useState('')
  const [editingImageId, setEditingImageId] = useState<string | null>(null)

  const imageCount = detail?.images.length ?? 0
  const observedIds = useMemo(
    () => new Set(detail?.visionObservations.map((item) => item.imageId) ?? []),
    [detail?.visionObservations]
  )
  const visionReady =
    imageCount > 0 && detail?.images.every((image) => observedIds.has(image.id)) === true
  const pfdbiReady = Boolean(detail?.pfdbi)
  const scriptReady = Boolean(detail?.finalDraft)

  const stages = [
    { id: 'images', label: '1 参考图与标注', disabled: false },
    { id: 'vision', label: '2 视觉观察', disabled: imageCount === 0 },
    { id: 'pfdbi', label: '3 PFDBI 评价', disabled: !visionReady },
    { id: 'brief', label: '4 成稿设置', disabled: !pfdbiReady },
    { id: 'script', label: '5 文案编辑', disabled: !scriptReady }
  ] as const

  useWorkspaceBar({
    title: detail?.title ?? '文案工作台',
    stages: [{ id: 'list', label: '项目列表', to: '/workbench' }, ...stages],
    activeStage: stage,
    onStageSelect: (stageId) => {
      const target = stages.find((item) => item.id === stageId)
      if (target && !target.disabled) setStage(target.id)
    }
  })

  /**
   * 刷新项目及所有中间产物。
   */
  async function refresh(): Promise<ProjectDetail | null> {
    if (!id) return null
    const next = await window.api.projects.get(id)
    setDetail(next)
    setScript(next?.finalDraft?.script ?? next?.baseDraft?.script ?? '')
    return next
  }

  useEffect(() => {
    let active = true
    const stop = window.api.onProgress(setProgress)
    void window.api.styles.list().then((items) => {
      if (active) setStyles(items)
    })
    if (id) {
      void window.api.projects.get(id).then((next) => {
        if (!active) return
        setDetail(next)
        setScript(next?.finalDraft?.script ?? next?.baseDraft?.script ?? '')
        if (next?.finalDraft) setStage('script')
        else if (next?.pfdbi) setStage('brief')
        else if (
          next &&
          next.images.length > 0 &&
          next.images.every((image) =>
            next.visionObservations.some((item) => item.imageId === image.id)
          )
        ) {
          setStage('pfdbi')
        }
      })
    }
    return () => {
      active = false
      stop()
    }
  }, [id])

  /**
   * 统一包装长任务的错误和忙碌状态。
   */
  async function run(task: () => Promise<void>): Promise<void> {
    setBusy(true)
    setError('')
    try {
      await task()
    } catch (item) {
      setError(ipcErrorMessage(item))
    } finally {
      setBusy(false)
    }
  }

  async function addImages(): Promise<void> {
    if (!id) return
    await window.api.projects.addImages(id)
    await refresh()
    setStage('images')
  }

  async function analyzeVision(): Promise<void> {
    if (!id) return
    await run(async () => {
      const next = await window.api.projects.analyzeVision(id)
      setDetail(next)
      setStage('pfdbi')
    })
  }

  async function analyzePfdbi(): Promise<void> {
    if (!id) return
    await run(async () => {
      const next = await window.api.projects.analyzePfdbi(id)
      setDetail(next)
      setStage('brief')
    })
  }

  async function generate(patch: {
    draft: string
    platform: string
    durationSeconds: number
    contentType: string
    styleId: string | null
  }): Promise<void> {
    if (!id) return
    await run(async () => {
      await window.api.projects.update(id, patch)
      const next = await window.api.projects.generate(id)
      setDetail(next)
      setScript(next.finalDraft?.script ?? '')
      setStage('script')
    })
  }

  async function saveScript(): Promise<void> {
    if (!id) return
    const next = await window.api.projects.update(id, { finalScript: script })
    setDetail(next)
  }

  async function rewrite(instruction: string): Promise<void> {
    if (!id) return
    const selected = window.getSelection()?.toString() || script.slice(0, 80)
    const next = await window.api.projects.rewrite(id, selected, instruction)
    setScript((current) => current.replace(selected, next))
  }

  if (!id) {
    return (
      <div className="page-fill text-sm">
        请从 <Link to="/workbench">项目列表</Link> 选择项目。
      </div>
    )
  }
  if (!detail) return <div className="page-fill text-sm text-[#9a8f82]">加载中…</div>

  const editingImage = detail.images.find((image) => image.id === editingImageId) ?? null
  const nextHint =
    imageCount === 0
      ? '先上传至少一张参考图'
      : !visionReady
        ? '核对图片角色和标注，然后运行视觉观察'
        : !pfdbiReady
          ? '视觉观察已齐全，可以运行 PFDBI 评价'
          : !scriptReady
            ? 'PFDBI 已完成，请填写成稿参数'
            : '成稿已生成，可继续编辑、重写或导出'

  return (
    <div className="workbench-flow">
      <WorkspaceActions>
        {stage === 'images' ? (
          <button className="btn-secondary px-3 py-1.5 text-sm" onClick={() => void addImages()}>
            <ImagePlus size={15} />
            添加参考图
          </button>
        ) : null}
        {stage === 'vision' ? (
          <button
            className="btn-primary px-3 py-1.5 text-sm"
            disabled={busy || imageCount === 0}
            onClick={() => void analyzeVision()}
          >
            <Play size={14} />
            {busy ? '观察中…' : '运行视觉观察'}
          </button>
        ) : null}
        {stage === 'pfdbi' ? (
          <button
            className="btn-primary px-3 py-1.5 text-sm"
            disabled={busy || !visionReady}
            onClick={() => void analyzePfdbi()}
          >
            <Play size={14} />
            {busy ? '分析中…' : detail.pfdbi ? '重新运行 PFDBI' : '运行 PFDBI 评价'}
          </button>
        ) : null}
      </WorkspaceActions>

      <section className="workflow-status">
        <div>
          <span>下一步</span>
          <strong>{nextHint}</strong>
        </div>
        <div className="workflow-status-counts">
          图片 {imageCount} · 视觉观察 {observedIds.size}/{imageCount} · PFDBI{' '}
          {pfdbiReady ? '已完成' : '未完成'}
        </div>
      </section>

      {progress && busy ? (
        <div className="workflow-progress">
          <span>{progress.message}</span>
          <div>
            <i style={{ width: `${progress.percent}%` }} />
          </div>
          <b>{progress.percent}%</b>
        </div>
      ) : null}
      {error ? <div className="workflow-error">{error}</div> : null}

      {stage === 'images' ? (
        <ImagesPane
          detail={detail}
          busy={busy}
          onAdd={addImages}
          onEdit={setEditingImageId}
          onChange={refresh}
          onContinue={() => setStage('vision')}
        />
      ) : null}
      {stage === 'vision' ? (
        <VisionPane detail={detail} observedIds={observedIds} onRun={analyzeVision} busy={busy} />
      ) : null}
      {stage === 'pfdbi' ? <PfdbiPane detail={detail} /> : null}
      {stage === 'brief' ? (
        <BriefPane detail={detail} styles={styles} busy={busy} onGenerate={generate} />
      ) : null}
      {stage === 'script' ? (
        <ScriptPane
          detail={detail}
          script={script}
          setScript={setScript}
          onSave={saveScript}
          onRewrite={rewrite}
          onRestore={async (versionId) => {
            const next = await window.api.projects.restoreVersion(versionId)
            setDetail(next)
            setScript(next.finalDraft?.script ?? '')
          }}
          onExport={(format) => window.api.projects.export(id, format)}
        />
      ) : null}

      {editingImage ? (
        <AnnotationEditor
          image={editingImage}
          onClose={() => setEditingImageId(null)}
          onChange={async () => {
            await refresh()
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * 图片分组、车型标签和标注入口。
 */
function ImagesPane({
  detail,
  busy,
  onAdd,
  onEdit,
  onChange,
  onContinue
}: {
  detail: ProjectDetail
  busy: boolean
  onAdd: () => Promise<void>
  onEdit: (id: string) => void
  onChange: () => Promise<ProjectDetail | null>
  onContinue: () => void
}): React.JSX.Element {
  const [pendingDelete, setPendingDelete] = useState<{ id: string; filename: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function updateImage(
    imageId: string,
    patch: { role?: ImageRole; vehicleLabel?: string; comparisonNote?: string }
  ): Promise<void> {
    await window.api.projects.updateImage(imageId, patch)
    await onChange()
  }

  /**
   * 二次确认后删除参考图；该操作会使视觉观察及后续产物失效。
   */
  async function removeImage(): Promise<void> {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await window.api.projects.removeImage(pendingDelete.id)
      setPendingDelete(null)
      await onChange()
    } finally {
      setDeleting(false)
    }
  }

  if (detail.images.length === 0) {
    return (
      <section className="empty-state">
        <ImagePlus size={28} className="mx-auto text-[#c4a574]" />
        <h2 className="mt-3 text-lg">从视觉证据开始</h2>
        <p className="mt-1 text-sm text-[#9a8f82]">
          上传参考图即可。允许没有主分析车型，也允许多张主分析车型；其他车型请在比较说明里写清关系。
        </p>
        <button className="btn-primary mt-4 px-4 py-2" onClick={() => void onAdd()}>
          选择车型参考图
        </button>
      </section>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">参考图与证据标注</h2>
          <p className="text-sm text-[#9a8f82]">
            角色只分主分析车型和其他车型，不做数量限制；其他车型请写清与主分析车型的关系。
          </p>
        </div>
        <button className="btn-primary px-4 py-2" disabled={busy} onClick={onContinue}>
          下一步：视觉观察
        </button>
      </div>
      <div className="image-evidence-grid">
        {detail.images.map((image) => (
          <article key={image.id} className="image-evidence-card">
            <div className="image-preview">
              <img src={image.dataUrl} alt={image.filename} />
              <span>{roleLabels[image.role]}</span>
            </div>
            <div className="image-evidence-fields">
              <label>
                图片角色
                <select
                  value={image.role}
                  onChange={(event) =>
                    void updateImage(image.id, { role: event.target.value as ImageRole })
                  }
                >
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                车型标签
                <input
                  key={`${image.id}-${image.vehicleLabel}`}
                  defaultValue={image.vehicleLabel}
                  placeholder="例：宝马 3 系 G20 LCI"
                  onBlur={(event) =>
                    event.target.value !== image.vehicleLabel &&
                    void updateImage(image.id, { vehicleLabel: event.target.value })
                  }
                />
              </label>
              <label>
                比较说明
                <input
                  key={`${image.id}-${image.comparisonNote}`}
                  defaultValue={image.comparisonNote}
                  placeholder={
                    image.role === 'other' ? '例：上一代同系 / 同级对标' : '选填，例：正面主视角'
                  }
                  onBlur={(event) =>
                    event.target.value !== image.comparisonNote &&
                    void updateImage(image.id, { comparisonNote: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="image-evidence-actions">
              <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => onEdit(image.id)}>
                <Pencil size={13} />
                预览并添加矩形标注（{image.annotations.length}）
              </button>
              <button
                className="icon-danger-button"
                type="button"
                aria-label={`删除图片 ${image.filename}`}
                onClick={() => setPendingDelete({ id: image.id, filename: image.filename })}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {pendingDelete ? (
        <div
          className="confirm-overlay"
          role="presentation"
          onMouseDown={() => !deleting && setPendingDelete(null)}
        >
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-reference-image-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h3 id="delete-reference-image-title">删除这张参考图？</h3>
            <p>
              “{pendingDelete.filename}”及其矩形标注会被永久删除。当前视觉观察、PFDBI
              评价和已生成稿件也会失效，需要重新运行。
            </p>
            <div className="confirm-actions">
              <button
                className="btn-secondary px-4 py-2"
                type="button"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
              >
                取消
              </button>
              <button
                className="danger-button px-4 py-2"
                type="button"
                disabled={deleting}
                onClick={() => void removeImage()}
              >
                {deleting ? '正在删除…' : '确认删除'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

/**
 * 展示每张图片的观察状态和结构化结果。
 */
function VisionPane({
  detail,
  observedIds,
  onRun,
  busy
}: {
  detail: ProjectDetail
  observedIds: Set<string>
  onRun: () => Promise<void>
  busy: boolean
}): React.JSX.Element {
  return (
    <div className="stage-panel">
      <div className="stage-panel-header">
        <div>
          <h2>视觉观察</h2>
          <p>模型只描述看见的事实和不确定性，不在此阶段给审美结论。</p>
        </div>
        <button className="btn-primary px-4 py-2" disabled={busy} onClick={() => void onRun()}>
          {busy ? '观察中…' : observedIds.size > 0 ? '重新运行全部观察' : '运行视觉观察'}
        </button>
      </div>
      <div className="vision-result-grid">
        {detail.images.map((image) => {
          const item = detail.visionObservations.find((entry) => entry.imageId === image.id)
          return (
            <article key={image.id} className="vision-result-card">
              <div className="vision-result-title">
                <span>{roleLabels[image.role]}</span>
                <b>{image.vehicleLabel || image.filename}</b>
                <i>{item ? '观察完成' : '待观察'}</i>
              </div>
              {item ? (
                <>
                  <p>{item.overall.silhouette}</p>
                  <ul>
                    {item.observations.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <small>不确定：{item.uncertainties.join('；') || '无'}</small>
                </>
              ) : (
                <p className="text-[#9a8f82]">运行后显示该图的结构化视觉证据。</p>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 展示 PFDBI 主体结论和纵向、横向比较中间产物。
 */
function PfdbiPane({ detail }: { detail: ProjectDetail }): React.JSX.Element {
  const analysis = detail.pfdbi
  if (!analysis) {
    return (
      <div className="stage-panel">
        <h2>PFDBI 评价尚未运行</h2>
        <p className="mt-2 text-sm text-[#9a8f82]">
          视觉观察已准备好。点击右上角“运行 PFDBI 评价”生成可确认的中间产物。
        </p>
      </div>
    )
  }
  const cards = [
    ['P', '比例与姿态', analysis.P],
    ['F', '形体与型面', analysis.F],
    ['D', '图形与细节', analysis.D],
    ['B', '品牌与任务', analysis.B],
    ['I', '创新与辨识', analysis.I]
  ] as const
  return (
    <div className="space-y-4">
      <section className="pfdbi-conclusion">
        <span>核心结论</span>
        <p>{analysis.coreConclusion}</p>
      </section>
      <div className="pfdbi-grid">
        {cards.map(([key, title, dim]) => (
          <article key={key}>
            <div>
              <b>{key}</b>
              <span>{title}</span>
            </div>
            <small>{dim.applicable ? '证据可支持评价' : '暂无足够证据'}</small>
            <p>{dim.judgement}</p>
            <dl>
              <dt>观察</dt>
              <dd>{dim.observations.join('；')}</dd>
              <dt>证据</dt>
              <dd>{dim.evidence.join('；')}</dd>
            </dl>
          </article>
        ))}
      </div>
      <div className="comparison-grid">
        <ComparisonSection
          title="与主分析车型的比较"
          empty="未提供其他车型参考图，或比较说明不足"
          items={comparisonItems(analysis)}
        />
      </div>
      <div className="fact-layers">
        <div>
          <span>事实</span>
          <p>{analysis.facts.join('；')}</p>
        </div>
        <div>
          <span>推断</span>
          <p>{analysis.inferences.join('；')}</p>
        </div>
        <div>
          <span>偏好</span>
          <p>{analysis.personalPreferences.join('；')}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * 把 PFDBI 比较结果整理成界面条目；旧纵向/横向记录仅作兼容展示。
 */
function comparisonItems(analysis: PFDBIAnalysis): Array<{ heading: string; lines: string[] }> {
  if (analysis.peerComparisons.length > 0) {
    return analysis.peerComparisons.map((item) => ({
      heading: [item.subjects.join(' vs '), item.relation].filter(Boolean).join(' · '),
      lines: [
        `观察：${item.observations.join('；')}`,
        `差异：${item.differences.join('；')}`,
        `证据：${item.evidence.join('；')}`
      ]
    }))
  }
  return [
    ...analysis.verticalComparisons.map((item) => ({
      heading: item.subjects.join(' vs '),
      lines: [
        `延续：${item.continuity.join('；')}`,
        `演进：${item.evolution.join('；')}`,
        `获得：${item.gains.join('；')}`,
        `代价：${item.tradeoffs.join('；')}`
      ]
    })),
    ...analysis.horizontalComparisons.map((item) => ({
      heading: item.subjects.join(' vs '),
      lines: [
        `共同任务：${item.commonBrief.join('；')}`,
        `差异：${item.differentiators.join('；')}`,
        `相对特征：${item.relativeStrengths.join('；')}`,
        `代价：${item.tradeoffs.join('；')}`
      ]
    }))
  ]
}

function ComparisonSection({
  title,
  empty,
  items
}: {
  title: string
  empty: string
  items: Array<{ heading: string; lines: string[] }>
}): React.JSX.Element {
  return (
    <section className="comparison-section">
      <h3>{title}</h3>
      {items.length === 0 ? <p className="comparison-empty">{empty}</p> : null}
      {items.map((item) => (
        <article key={`${item.heading}-${item.lines.join('')}`}>
          <b>{item.heading}</b>
          {item.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </article>
      ))}
    </section>
  )
}

/**
 * PFDBI 完成后才开放的平台、时长、风格和初稿配置。
 */
function BriefPane({
  detail,
  styles,
  busy,
  onGenerate
}: {
  detail: ProjectDetail
  styles: StyleRecord[]
  busy: boolean
  onGenerate: (patch: {
    draft: string
    platform: string
    durationSeconds: number
    contentType: string
    styleId: string | null
  }) => Promise<void>
}): React.JSX.Element {
  const [draft, setDraft] = useState(detail.draft)
  const [platform, setPlatform] = useState(detail.platform)
  const [contentType, setContentType] = useState<ContentType>(
    (CONTENT_TYPES as readonly string[]).includes(detail.contentType)
      ? (detail.contentType as ContentType)
      : CONTENT_TYPES[0]
  )
  const [minutes, setMinutes] = useState(Math.max(1, detail.durationSeconds / 60))
  const [styleId, setStyleId] = useState(detail.styleId ?? '')

  return (
    <div className="brief-layout">
      <section className="brief-form">
        <div className="stage-panel-header">
          <div>
            <h2>成稿设置</h2>
            <p>PFDBI 已锁定为内容中间产物，现在决定怎么说、在哪说、说多长。</p>
          </div>
        </div>
        <label>
          选题
          <input value={detail.topic} readOnly />
        </label>
        <label>
          初步草稿（可选）
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="可粘贴已有观点或口播草稿；系统会保留其有效内容，但以 PFDBI 证据为准。"
          />
        </label>
        <div className="brief-grid">
          <label>
            发布平台
            <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
              {PLATFORMS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            文案类型
            <select
              value={contentType}
              onChange={(event) => setContentType(event.target.value as ContentType)}
            >
              {CONTENT_TYPES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            目标时长（分钟）
            <input
              type="number"
              min={1}
              value={minutes}
              onChange={(event) => setMinutes(Math.max(1, Number(event.target.value)))}
            />
          </label>
          <label>
            Style DNA
            <select value={styleId} onChange={(event) => setStyleId(event.target.value)}>
              <option value="">不使用风格模板</option>
              {styles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="btn-primary mt-5 px-5 py-3"
          disabled={busy}
          onClick={() =>
            void onGenerate({
              draft,
              platform,
              durationSeconds: Math.round(minutes * 60),
              contentType,
              styleId: styleId || null
            })
          }
        >
          {busy ? '正在生成…' : '生成 Base Draft 与最终稿'}
        </button>
      </section>
      <aside className="brief-evidence">
        <span>生成依据</span>
        <h3>PFDBI 中间产物已就绪</h3>
        <p>{detail.pfdbi?.coreConclusion}</p>
        <dl>
          <dt>视觉观察</dt>
          <dd>{detail.visionObservations.length} 份</dd>
          <dt>主分析车型</dt>
          <dd>{detail.images.filter((item) => item.role === 'primary').length} 张</dd>
          <dt>其他车型</dt>
          <dd>{detail.images.filter((item) => item.role === 'other').length} 张</dd>
        </dl>
      </aside>
    </div>
  )
}

/**
 * 最终稿编辑、版本、重写、质检和导出。
 */
function ScriptPane({
  detail,
  script,
  setScript,
  onSave,
  onRewrite,
  onRestore,
  onExport
}: {
  detail: ProjectDetail
  script: string
  setScript: (value: string) => void
  onSave: () => Promise<void>
  onRewrite: (instruction: string) => Promise<void>
  onRestore: (versionId: string) => Promise<void>
  onExport: (format: 'txt' | 'md') => Promise<string | null>
}): React.JSX.Element {
  const wordCount = script.replace(/\s/g, '').length
  const usageTotal = detail.usage.reduce((sum, item) => sum + item.totalTokens, 0)
  return (
    <div className="script-layout">
      <aside>
        <h3>版本</h3>
        {detail.versions.map((version) => (
          <button key={version.id} onClick={() => void onRestore(version.id)}>
            V{version.version} · {version.label}
          </button>
        ))}
      </aside>
      <section>
        <textarea value={script} onChange={(event) => setScript(event.target.value)} />
        <div className="script-actions">
          {rewriteActions.map((item) => (
            <button
              key={item.label}
              className="btn-chip px-2 py-1 text-xs"
              onClick={() => void onRewrite(item.instruction)}
            >
              {item.label}
            </button>
          ))}
          <button className="btn-primary px-3 py-1 text-xs" onClick={() => void onSave()}>
            保存版本
          </button>
          <button className="btn-secondary px-3 py-1 text-xs" onClick={() => void onExport('txt')}>
            导出 TXT
          </button>
          <button className="btn-secondary px-3 py-1 text-xs" onClick={() => void onExport('md')}>
            导出 MD
          </button>
        </div>
      </section>
      <aside>
        <h3>质量 / 时长</h3>
        <p>字数 {wordCount}</p>
        <p>Token {usageTotal}</p>
        {detail.quality ? (
          <>
            <p>风格一致性 {Math.round(detail.quality.styleConsistency * 100)}</p>
            <p>时长分 {Math.round(detail.quality.durationScore * 100)}</p>
            {detail.quality.durationWarning ? (
              <small>{detail.quality.durationWarning}</small>
            ) : null}
            <small>{detail.quality.suggestions.join('；')}</small>
          </>
        ) : null}
      </aside>
    </div>
  )
}
