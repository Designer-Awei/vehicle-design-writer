import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FieldInline } from '@renderer/components/FieldInline'
import { WORKBENCH_MENU } from '@renderer/navigation'
import { useWorkspaceBar } from '@renderer/workspace/WorkspaceContext'
import { CONTENT_TYPES, PLATFORMS, type ContentType } from '@shared/constants'
import type { StyleRecord } from '@shared/ipc'

/**
 * 新建文案：选题 / 参考图路径 / 风格 / 时长。
 */
export function ProjectNewPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('为什么现在很多新能源汽车前脸越来越像？')
  const [draft, setDraft] = useState('')
  const [platform, setPlatform] = useState('B站')
  const [minutes, setMinutes] = useState(5)
  const [contentType, setContentType] = useState<ContentType>(CONTENT_TYPES[0])
  const [styleId, setStyleId] = useState<string>('')
  const [styles, setStyles] = useState<StyleRecord[]>([])
  const [imagePaths, setImagePaths] = useState<string[]>([])
  const [commercial, setCommercial] = useState(false)
  const [brand, setBrand] = useState('')
  const [busy, setBusy] = useState(false)

  useWorkspaceBar({
    title: '文案工作台',
    stages: [...WORKBENCH_MENU]
  })

  useEffect(() => {
    void window.api.styles.list().then((items) => {
      setStyles(items)
      if (items[0]) setStyleId(items[0].id)
    })
  }, [])

  /**
   * 选择本地车型参考图。
   */
  async function pickImages(): Promise<void> {
    const picked = await window.api.dialog.pickImages()
    setImagePaths(picked)
  }

  /**
   * 创建项目并进入工作台。
   */
  async function create(): Promise<void> {
    setBusy(true)
    try {
      const project = await window.api.projects.create({
        topic,
        draft,
        platform,
        durationSeconds: minutes * 60,
        contentType,
        styleId: styleId || null,
        imagePaths,
        commercial: {
          enabled: commercial,
          brand,
          model: '',
          goal: '',
          sellingPoints: [],
          mustInclude: [],
          mustAvoid: [],
          placement: 'narrative',
          cta: ''
        }
      })
      navigate(`/workbench/${project.id}`, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-fill">
      <label className="block text-sm text-[#9a8f82]" htmlFor="topic">
        选题
      </label>
      <textarea
        id="topic"
        className="h-24 w-full rounded-xl bg-[#161310] p-3"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
      />
      <label className="block text-sm text-[#9a8f82]" htmlFor="draft">
        初步草稿
      </label>
      <textarea
        id="draft"
        className="h-28 w-full rounded-xl bg-[#161310] p-3"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-4">
        <FieldInline label="发布平台" htmlFor="platform">
          <select
            id="platform"
            className="rounded-xl bg-[#161310] p-3 text-[#f3ece1]"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            {PLATFORMS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </FieldInline>
        <FieldInline label="文案类型" htmlFor="contentType">
          <select
            id="contentType"
            className="rounded-xl bg-[#161310] p-3 text-[#f3ece1]"
            value={contentType}
            onChange={(e) => setContentType(e.target.value as ContentType)}
          >
            {CONTENT_TYPES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </FieldInline>
        <FieldInline label="预期时长" htmlFor="minutes">
          <span className="relative block">
            <input
              id="minutes"
              className="w-full rounded-xl bg-[#161310] p-3 pr-12 text-[#f3ece1]"
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#9a8f82]">
              分钟
            </span>
          </span>
        </FieldInline>
        <FieldInline label="风格模板" htmlFor="styleId">
          <select
            id="styleId"
            className="rounded-xl bg-[#161310] p-3 text-[#f3ece1]"
            value={styleId}
            onChange={(e) => setStyleId(e.target.value)}
          >
            <option value="">请选择风格模板</option>
            {styles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </FieldInline>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-ghost px-4 py-2" onClick={() => void pickImages()}>
          选择车型参考图
        </button>
        <span className="text-sm text-[#9a8f82]">{imagePaths.length} 张</span>
        <label className="ml-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={commercial} onChange={(e) => setCommercial(e.target.checked)} />
          商业合作模式
        </label>
      </div>
      {commercial ? (
        <input
          className="w-full rounded-xl bg-[#161310] p-3"
          placeholder="合作品牌"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
      ) : null}
      <div>
        <button className="btn-primary rounded-xl px-5 py-3" disabled={busy} onClick={() => void create()}>
          进入工作台
        </button>
      </div>
    </div>
  )
}
