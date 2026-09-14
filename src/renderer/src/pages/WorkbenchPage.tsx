import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FolderOutput, ImagePlus, Save } from 'lucide-react'
import { AnalysisPane } from '@renderer/pages/workbench/AnalysisPane'
import { DraftPane } from '@renderer/pages/workbench/DraftPane'
import { TopicPane } from '@renderer/pages/workbench/TopicPane'
import { VisualPane } from '@renderer/pages/workbench/VisualPane'
import { useWorkspaceBar, WorkspaceActions } from '@renderer/workspace/WorkspaceContext'
import { PROJECT_TABS, type ProjectTabId } from '@renderer/navigation'
import { ipcErrorMessage } from '@renderer/lib/utils'
import { HoverToast } from '@renderer/components/HoverToast'
import type { PFDBIAnalysis } from '@schemas/index'
import type { ProjectDetail, ProjectRecord } from '@shared/ipc'

/**
 * 打开项目后：顶栏切项目，左侧四个二级标签写稿。
 */
export function WorkbenchPage(): React.JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [tab, setTab] = useState<ProjectTabId>('topic')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [exporting, setExporting] = useState(false)

  useWorkspaceBar({
    title: detail?.title || detail?.topic || '文案工作台',
    titleOptions: projects.map((item) => ({ id: item.id, label: item.title || item.topic })),
    selectedTitleId: id,
    onTitleSelect: (projectId) => navigate(`/workbench/${projectId}`),
    saveStatus: detail?.saveStatus ?? null
  })

  /**
   * 刷新当前项目。
   */
  async function refresh(): Promise<ProjectDetail | null> {
    if (!id) return null
    const next = await window.api.projects.get(id)
    setDetail(next)
    return next
  }

  useEffect(() => {
    void window.api.projects.list().then(setProjects)
  }, [id])

  useEffect(() => {
    let active = true
    if (!id) return
    void window.api.projects.get(id).then((next) => {
      if (!active) return
      setDetail(next)
      setTab('topic')
    })
    return () => {
      active = false
    }
  }, [id])

  /**
   * 保存选题或成稿字段。
   */
  async function saveProject(
    patch: Parameters<typeof window.api.projects.update>[1]
  ): Promise<void> {
    if (!id) return
    setError('')
    try {
      const next = await window.api.projects.update(id, patch)
      setDetail(next)
      setProjects((current) =>
        current.map((item) =>
          item.id === next.id
            ? { ...item, title: next.title, topic: next.topic, saveStatus: next.saveStatus }
            : item
        )
      )
    } catch (item) {
      setError(ipcErrorMessage(item))
    }
  }

  /**
   * 把当前文案写入项目库 data/projects。
   */
  async function persistProject(): Promise<void> {
    if (!id) return
    if (typeof window.api.projects.save !== 'function') {
      setError('保存接口还没加载。请关掉当前 npm run dev 后重新启动。')
      return
    }
    setError('')
    try {
      const next = await window.api.projects.save(id)
      setDetail(next)
      setProjects((current) =>
        current.map((item) =>
          item.id === next.id
            ? { ...item, title: next.title, topic: next.topic, saveStatus: next.saveStatus }
            : item
        )
      )
      setNotice('项目已保存')
    } catch (item) {
      setError(ipcErrorMessage(item))
    }
  }

  /**
   * 先保存到项目库，再把当前项目文件夹打成 zip 安装包。
   */
  async function exportProject(): Promise<void> {
    if (!id) return
    if (typeof window.api.projects.exportBundle !== 'function') {
      setError('导出接口还没加载。请关掉当前 npm run dev 后重新启动。')
      return
    }
    setError('')
    setExporting(true)
    try {
      const zipPath = await window.api.projects.exportBundle(id)
      if (!zipPath) return
      const next = await window.api.projects.get(id)
      if (next) {
        setDetail(next)
        setProjects((current) =>
          current.map((item) =>
            item.id === next.id
              ? { ...item, title: next.title, topic: next.topic, saveStatus: next.saveStatus }
              : item
          )
        )
      }
      setNotice(`已导出安装包到 ${zipPath}`)
    } catch (item) {
      setError(ipcErrorMessage(item))
    } finally {
      setExporting(false)
    }
  }

  /**
   * 打开系统选图，加入当期视觉素材库。
   */
  async function addImages(): Promise<void> {
    if (!id) return
    await window.api.projects.addImages(id)
    await refresh()
  }

  /**
   * 把人写的 PFDBI 五维观察存回当前项目。
   */
  async function savePfdbi(analysis: PFDBIAnalysis): Promise<void> {
    if (!id) return
    setError('')
    if (typeof window.api.projects.savePfdbi !== 'function') {
      setError('保存接口还没加载。请关掉当前 npm run dev 后重新启动。')
      return
    }
    try {
      const next = await window.api.projects.savePfdbi(id, analysis)
      setDetail(next)
    } catch (item) {
      setError(ipcErrorMessage(item))
    }
  }

  if (!id) {
    return (
      <div className="page-fill text-sm">
        请从 <Link to="/workbench">项目列表</Link> 选择项目。
      </div>
    )
  }
  if (!detail) return <div className="page-fill text-sm text-[#9a8f82]">加载中…</div>

  return (
    <div className="workbench-shell">
      <WorkspaceActions>
        <button
          type="button"
          className="btn-primary px-3 py-1.5 text-sm"
          disabled={detail.saveStatus === 'saved'}
          onClick={() => void persistProject()}
        >
          <Save size={15} />
          保存
        </button>
        <button
          type="button"
          className="btn-secondary px-3 py-1.5 text-sm"
          disabled={exporting}
          onClick={() => void exportProject()}
        >
          <FolderOutput size={15} />
          {exporting ? '正在导出…' : '导出安装包'}
        </button>
        {tab === 'visuals' ? (
          <button className="btn-secondary px-3 py-1.5 text-sm" onClick={() => void addImages()}>
            <ImagePlus size={15} />
            上传视觉素材
          </button>
        ) : null}
      </WorkspaceActions>
      <nav className="workbench-rail" aria-label="项目步骤">
        {PROJECT_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'is-active' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="workbench-pane">
        {error ? <div className="workflow-error">{error}</div> : null}
        {tab === 'topic' ? <TopicPane detail={detail} onSave={saveProject} /> : null}
        {tab === 'visuals' ? (
          <VisualPane detail={detail} onAdd={addImages} onChange={refresh} />
        ) : null}
        {tab === 'analysis' ? <AnalysisPane detail={detail} onSavePfdbi={savePfdbi} /> : null}
        {tab === 'draft' ? <DraftPane detail={detail} onSave={saveProject} /> : null}
      </div>
      {notice ? <HoverToast message={notice} onHide={() => setNotice('')} /> : null}
    </div>
  )
}
