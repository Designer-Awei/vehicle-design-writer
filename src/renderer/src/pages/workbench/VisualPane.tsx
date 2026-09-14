import { useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import type { ProjectDetail } from '@shared/ipc'
import type { ImageRole } from '@schemas/index'

const roleLabels: Record<ImageRole, string> = {
  primary: '主分析车型',
  other: '其他车型'
}

/**
 * 当期文案的视觉素材库：上传、角色、车型标签、比较说明。
 */
export function VisualPane({
  detail,
  onAdd,
  onChange
}: {
  detail: ProjectDetail
  onAdd: () => Promise<void>
  onChange: () => Promise<unknown>
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
      <section className="workbench-section">
        <header>
          <h2>视觉素材</h2>
          <p>这里是当期文案的图库。有车图再上传，没有也可以先去做设计分析和写稿。</p>
        </header>
        <div className="empty-state">
          <ImagePlus size={28} className="mx-auto text-[#c4a574]" />
          <h3>还没有参考图</h3>
          <button className="btn-primary mt-4 px-4 py-2" onClick={() => void onAdd()}>
            上传视觉素材
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="workbench-section">
      <header>
        <h2>视觉素材</h2>
        <p>角色只分主分析车型和其他车型；其他车型请写清与主分析车型的关系。</p>
      </header>
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
                  <option value="primary">主分析车型</option>
                  <option value="other">其他车型</option>
                </select>
              </label>
              <label>
                车型标签
                <input
                  defaultValue={image.vehicleLabel}
                  placeholder="例：宝马 3 系 G20 LCI"
                  onBlur={(event) => {
                    const next = event.target.value.trim()
                    if (next !== image.vehicleLabel) void updateImage(image.id, { vehicleLabel: next })
                  }}
                />
              </label>
              <label>
                比较说明
                <input
                  defaultValue={image.comparisonNote}
                  placeholder="选填，例：正面主视角"
                  onBlur={(event) => {
                    const next = event.target.value.trim()
                    if (next !== image.comparisonNote) {
                      void updateImage(image.id, { comparisonNote: next })
                    }
                  }}
                />
              </label>
              <button
                type="button"
                className="style-delete-button"
                title={`删除${image.filename}`}
                onClick={() => setPendingDelete({ id: image.id, filename: image.filename })}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {pendingDelete ? (
        <div className="confirm-overlay" role="presentation" onMouseDown={() => setPendingDelete(null)}>
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h3>删除这张图？</h3>
            <p>“{pendingDelete.filename}”会从本期素材库里移除。</p>
            <div className="confirm-actions">
              <button type="button" className="btn-secondary px-4 py-2" onClick={() => setPendingDelete(null)}>
                取消
              </button>
              <button
                type="button"
                className="danger-button px-4 py-2"
                disabled={deleting}
                onClick={() => void removeImage()}
              >
                {deleting ? '正在删除…' : '确认删除'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
