import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StyleMetaEditor } from '@renderer/components/StyleMetaEditor'
import { STYLE_STAGES } from '@renderer/navigation'
import { useWorkspaceBar } from '@renderer/workspace/WorkspaceContext'
import type { StyleRecord } from '@shared/ipc'

/**
 * 风格库列表。
 */
export function StylesPage(): React.JSX.Element {
  const [styles, setStyles] = useState<StyleRecord[]>([])
  const [pendingDelete, setPendingDelete] = useState<StyleRecord | null>(null)
  const [editing, setEditing] = useState<StyleRecord | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  useWorkspaceBar({
    title: '风格库',
    stages: [...STYLE_STAGES]
  })

  useEffect(() => {
    void window.api.styles.list().then(setStyles)
  }, [])

  /**
   * 删除风格以及它的样本文档和 Style DNA，已有项目会自动解除该风格引用。
   */
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
    <div className="page-fill">
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
              <p className="mt-3 text-sm text-[#cfc3b5]">{style.notes || '暂无备注'}</p>
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
      {styles.length === 0 ? <div className="text-sm text-[#9a8f82]">还没有风格档案。</div> : null}
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
              <button
                type="button"
                className="btn-secondary px-4 py-2"
                onClick={() => setEditing(null)}
              >
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
