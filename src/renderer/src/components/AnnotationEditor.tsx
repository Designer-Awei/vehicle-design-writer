import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import type { ImageAnnotation } from '@schemas/index'
import type { ReferenceImageRecord } from '@shared/ipc'

interface AnnotationEditorProps {
  image: ReferenceImageRecord
  onClose: () => void
  onChange: () => Promise<void>
}

interface Point {
  x: number
  y: number
}

/**
 * 在实际图片显示区域上绘制归一化矩形，并管理该图片的已有标注。
 */
export function AnnotationEditor({
  image,
  onClose,
  onChange
}: AnnotationEditorProps): React.JSX.Element {
  const [start, setStart] = useState<Point | null>(null)
  const [draft, setDraft] = useState<Omit<ImageAnnotation, 'imageId'> | null>(null)
  const [note, setNote] = useState('重点分析这个区域')
  const [saving, setSaving] = useState(false)

  /**
   * 把指针位置转换为图片区域内的 0–1 坐标。
   */
  function pointOf(event: React.PointerEvent<HTMLDivElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    }
  }

  function begin(event: React.PointerEvent<HTMLDivElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointOf(event)
    setStart(point)
    setDraft({ x: point.x, y: point.y, width: 0, height: 0, note })
  }

  function move(event: React.PointerEvent<HTMLDivElement>): void {
    if (!start) return
    const point = pointOf(event)
    setDraft({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
      note
    })
  }

  function end(event: React.PointerEvent<HTMLDivElement>): void {
    if (!start) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    setStart(null)
    setDraft((current) =>
      current && current.width >= 0.02 && current.height >= 0.02 ? current : null
    )
  }

  /**
   * 保存当前框选区域；过小的误触矩形不会进入该状态。
   */
  async function save(): Promise<void> {
    if (!draft || !note.trim()) return
    setSaving(true)
    try {
      await window.api.projects.saveAnnotation({
        imageId: image.id,
        x: draft.x,
        y: draft.y,
        width: draft.width,
        height: draft.height,
        note: note.trim()
      })
      setDraft(null)
      setNote('')
      await onChange()
    } finally {
      setSaving(false)
    }
  }

  /**
   * 删除已有标注并刷新工作台门禁。
   */
  async function remove(annotationId: string): Promise<void> {
    await window.api.projects.removeAnnotation(annotationId)
    await onChange()
  }

  return (
    <div className="annotation-overlay" role="dialog" aria-modal="true" aria-label="图片矩形标注">
      <header className="annotation-header">
        <div>
          <h3>{image.vehicleLabel || image.filename}</h3>
          <p>在图片上按住并拖动框选；坐标会按原图比例保存。</p>
        </div>
        <button className="annotation-close" type="button" onClick={onClose} aria-label="关闭标注">
          <X size={20} />
        </button>
      </header>
      <div className="annotation-body">
        <div className="annotation-image-wrap">
          <img src={image.dataUrl} alt={image.filename} draggable={false} />
          <div
            className="annotation-draw-layer"
            onPointerDown={begin}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={() => {
              setStart(null)
              setDraft(null)
            }}
          >
            {image.annotations.map((item, index) => (
              <div
                key={item.id}
                className="annotation-rect annotation-rect-saved"
                style={{
                  left: `${item.x * 100}%`,
                  top: `${item.y * 100}%`,
                  width: `${item.width * 100}%`,
                  height: `${item.height * 100}%`
                }}
              >
                <span>{index + 1}</span>
              </div>
            ))}
            {draft ? (
              <div
                className="annotation-rect annotation-rect-draft"
                style={{
                  left: `${draft.x * 100}%`,
                  top: `${draft.y * 100}%`,
                  width: `${draft.width * 100}%`,
                  height: `${draft.height * 100}%`
                }}
              />
            ) : null}
          </div>
        </div>
        <aside className="annotation-sidebar">
          <div>
            <label htmlFor="annotation-note">本次标注意图</label>
            <textarea
              id="annotation-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="例如：对比前灯与进气口的图形关系"
            />
            <button
              className="btn-primary w-full px-4 py-2"
              type="button"
              disabled={!draft || !note.trim() || saving}
              onClick={() => void save()}
            >
              {saving ? '正在保存…' : draft ? '保存这个矩形' : '先在图片上拖出矩形'}
            </button>
          </div>
          <div className="annotation-list">
            <div className="annotation-list-title">已有标注（{image.annotations.length}）</div>
            {image.annotations.map((item, index) => (
              <div key={item.id} className="annotation-list-item">
                <span>{index + 1}</span>
                <p>{item.note}</p>
                <button
                  type="button"
                  aria-label={`删除标注 ${index + 1}`}
                  onClick={() => item.id && void remove(item.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {image.annotations.length === 0 ? (
              <p className="annotation-empty">尚无标注。没有标注也可以分析整张图片。</p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}
