import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WORKBENCH_MENU } from '@renderer/navigation'
import { useWorkspaceBar } from '@renderer/workspace/WorkspaceContext'
import { CONTENT_TYPES } from '@shared/constants'

/**
 * 新建选题骨架；图片、PFDBI 和成稿参数在工作台内按顺序完成。
 */
export function ProjectNewPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('为什么现在很多新能源汽车前脸越来越像？')
  const [busy, setBusy] = useState(false)

  useWorkspaceBar({
    title: '文案工作台',
    stages: [...WORKBENCH_MENU]
  })

  /**
   * 创建项目骨架并从“参考图与标注”开始。
   */
  async function create(): Promise<void> {
    if (!topic.trim()) return
    setBusy(true)
    try {
      const project = await window.api.projects.create({
        topic: topic.trim(),
        draft: '',
        platform: 'B站',
        durationSeconds: 300,
        contentType: CONTENT_TYPES[0],
        styleId: null,
        imagePaths: []
      })
      navigate(`/workbench/${project.id}`, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-fill items-center pt-12">
      <section className="w-full max-w-3xl rounded-2xl border border-[#2a241e] bg-[#161310] p-7">
        <div className="text-xs tracking-[0.18em] text-[#c4a574]">STEP 0 · 创建选题</div>
        <h2 className="mt-2 text-2xl font-semibold">先定义要回答的问题</h2>
        <p className="mt-2 text-sm leading-6 text-[#9a8f82]">
          创建后先上传并标注参考图。平台、时长、风格和初步草稿将在 PFDBI
          评价完成后配置，避免表达参数干扰视觉判断。
        </p>
        <label className="mt-6 block text-sm text-[#cfc3b5]" htmlFor="topic">
          选题 / 核心问题
        </label>
        <textarea
          id="topic"
          className="mt-2 h-32 w-full rounded-xl bg-[#0c0b0a] p-4"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <button
          className="btn-primary mt-5 px-5 py-3"
          disabled={busy || !topic.trim()}
          onClick={() => void create()}
        >
          {busy ? '正在创建…' : '创建并上传参考图'}
        </button>
      </section>
    </div>
  )
}
