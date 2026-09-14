import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { WORKBENCH_MENU } from '@renderer/navigation'
import { useWorkspaceBar } from '@renderer/workspace/WorkspaceContext'
import type { ProjectRecord } from '@shared/ipc'

/**
 * 文案工作台项目列表，集中负责进入、创建和删除项目。
 */
export function ProjectsPage(): React.JSX.Element {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [pendingDelete, setPendingDelete] = useState<ProjectRecord | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  useWorkspaceBar({
    title: '文案工作台',
    stages: [...WORKBENCH_MENU]
  })

  useEffect(() => {
    void window.api.projects.list().then(setProjects)
  }, [])

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

  return (
    <div className="page-fill">
      <div>
        <h2 className="text-xl font-semibold">已有项目</h2>
        <p className="mt-1 text-sm text-[#9a8f82]">继续写选题、补视觉素材、做设计分析或改初稿。</p>
      </div>
      {projects.map((project) => (
        <article key={project.id} className="project-list-item">
          <Link to={`/workbench/${project.id}`} className="project-list-link">
            <div>{project.title}</div>
            <div className="mt-1 text-xs text-[#9a8f82]">
              {project.platform} · {project.contentType} · {project.status}
            </div>
          </Link>
          <div className="project-list-actions">
            <button
              type="button"
              className="project-delete-button project-delete-icon"
              disabled={deletingId === project.id}
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
          <p className="mt-1 text-sm text-[#9a8f82]">从“新建文案”开始第一条设计内容。</p>
          <Link to="/workbench/new" className="btn-primary mt-4 px-4 py-2 text-sm">
            新建文案
          </Link>
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
              “{pendingDelete.title}”的参考图、分析结果和文案版本也会一起删除，此操作无法撤销。
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
    </div>
  )
}
