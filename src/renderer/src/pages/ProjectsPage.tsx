import { useEffect, useState } from 'react'
import { FolderInput, FolderOutput, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { WORKBENCH_MENU } from '@renderer/navigation'
import { useWorkspaceBar } from '@renderer/workspace/WorkspaceContext'
import { ipcErrorMessage } from '@renderer/lib/utils'
import { SAVE_STATUS_LABEL, normalizeSaveStatus } from '@renderer/lib/save-status'
import { HoverToast } from '@renderer/components/HoverToast'
import type { ProjectRecord } from '@shared/ipc'

/**
 * 文案工作台项目列表，集中负责进入、导入、导出和删除项目。
 */
export function ProjectsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [pendingDelete, setPendingDelete] = useState<ProjectRecord | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useWorkspaceBar({
    title: '文案工作台',
    stages: [...WORKBENCH_MENU]
  })

  useEffect(() => {
    void window.api.projects.list().then(setProjects)
  }, [])

  /**
   * 选择 zip 安装包或旧版项目文件夹，复制进当前项目库。
   */
  async function importProject(): Promise<void> {
    if (typeof window.api.projects.importBundle !== 'function') {
      setError('导入接口还没加载。请关掉当前 npm run dev 后重新启动。')
      return
    }
    setError('')
    setImporting(true)
    try {
      const detail = await window.api.projects.importBundle()
      if (!detail) return
      navigate(`/workbench/${detail.id}`)
    } catch (item) {
      setError(ipcErrorMessage(item))
    } finally {
      setImporting(false)
    }
  }

  /**
   * 把当前项目文件夹打成 zip 安装包，并让用户选择保存地址。
   */
  async function exportProject(project: ProjectRecord): Promise<void> {
    if (typeof window.api.projects.exportBundle !== 'function') {
      setError('导出接口还没加载。请关掉当前 npm run dev 后重新启动。')
      return
    }
    setError('')
    setExportingId(project.id)
    try {
      const zipPath = await window.api.projects.exportBundle(project.id)
      if (!zipPath) return
      setProjects((current) =>
        current.map((item) =>
          item.id === project.id ? { ...item, saveStatus: 'saved' } : item
        )
      )
      setNotice(`已导出安装包到 ${zipPath}`)
    } catch (item) {
      setError(ipcErrorMessage(item))
    } finally {
      setExportingId(null)
    }
  }

  /**
   * 永久删除已在确认弹层中选中的项目及其关联数据。
   */
  async function removeProject(): Promise<void> {
    if (!pendingDelete) return
    const project = pendingDelete
    setDeletingId(project.id)
    try {
      await window.api.projects.remove(project.id)
      setProjects((current) => current.filter((item) => item.id !== project.id))
      setPendingDelete(null)
    } finally {
      setDeletingId(null)
    }
  }

  const busy = importing || exportingId !== null || deletingId !== null

  return (
    <div className="page-fill">
      <div className="page-heading-row">
        <div>
          <h2 className="text-xl font-semibold">已有项目</h2>
          <p className="mt-1 text-sm text-[#9a8f82]">继续写选题、补视觉素材、做设计分析或改初稿。保存后才会写入项目库。</p>
        </div>
        <button
          type="button"
          className="btn-secondary px-3 py-1.5 text-sm"
          disabled={busy}
          onClick={() => void importProject()}
        >
          <FolderInput size={15} />
            {importing ? '正在导入…' : '导入安装包'}
        </button>
      </div>
      {error ? <div className="workflow-error">{error}</div> : null}
      {projects.map((project) => (
        <article key={project.id} className="project-list-item">
          <Link to={`/workbench/${project.id}`} className="project-list-link">
            <div className="flex items-center gap-2">
              <span
                className={`project-status project-status--${normalizeSaveStatus(project.saveStatus)}`}
                title={SAVE_STATUS_LABEL[normalizeSaveStatus(project.saveStatus)]}
              >
                <span className="project-status-dot" aria-hidden />
                {SAVE_STATUS_LABEL[normalizeSaveStatus(project.saveStatus)]}
              </span>
              <span>{project.title}</span>
            </div>
            <div className="mt-1 text-xs text-[#9a8f82]">
              {project.platform} · {project.contentType}
            </div>
          </Link>
          <div className="project-list-actions">
            <button
              type="button"
              className="project-action-icon"
              disabled={busy}
              title={`导出${project.title}安装包`}
              aria-label={`导出项目 ${project.title} 安装包`}
              onClick={() => void exportProject(project)}
            >
              <FolderOutput size={15} />
            </button>
            <button
              type="button"
              className="project-delete-button project-delete-icon"
              disabled={busy}
              title={`删除${project.title}`}
              aria-label={`删除项目 ${project.title}`}
              onClick={() => setPendingDelete(project)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </article>
      ))}
      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="text-lg">还没有项目</div>
          <p className="mt-1 text-sm text-[#9a8f82]">从“新建文案”开始，或导入 zip 安装包 / 已有项目文件夹。</p>
          <div className="empty-state-actions">
            <Link to="/workbench/new" className="btn-primary px-4 py-2 text-sm">
              新建文案
            </Link>
            <button
              type="button"
              className="btn-secondary px-4 py-2 text-sm"
              disabled={busy}
              onClick={() => void importProject()}
            >
              导入安装包
            </button>
          </div>
        </div>
      ) : null}
      {pendingDelete ? (
        <div className="confirm-overlay" role="presentation" onMouseDown={() => setPendingDelete(null)}>
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h3 id="delete-project-title">删除这个项目？</h3>
            <p>
              “{pendingDelete.title}”在项目库里的文件夹也会一起删除（未保存的只丢掉内存稿），此操作无法撤销。
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
                onClick={() => void removeProject()}
              >
                {deletingId ? '正在删除…' : '确认删除'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {notice ? <HoverToast message={notice} onHide={() => setNotice('')} /> : null}
    </div>
  )
}
