import { useEffect, useRef, useState } from 'react'
import type { ReferenceImageRecord } from '@shared/ipc'

/**
 * 单侧对比预览：右上角切换素材，滚轮缩放，左键拖移。
 */
export function ImageCompareViewer({
  images,
  selectedId,
  onSelect,
  label
}: {
  images: ReferenceImageRecord[]
  selectedId: string
  onSelect: (id: string) => void
  label: string
}): React.JSX.Element {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const current = images.find((item) => item.id === selectedId) ?? images[0]

  useEffect(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [selectedId])

  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    /**
     * 滚轮缩放，阻止页面跟着滚。
     */
    function onWheel(event: WheelEvent): void {
      event.preventDefault()
      setScale((current) => {
        const next = event.deltaY < 0 ? current * 1.12 : current / 1.12
        return Math.min(6, Math.max(0.4, next))
      })
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [])

  if (!current) {
    return (
      <div className="image-zoom-card">
        <header>
          <span>{label}</span>
        </header>
        <div className="image-zoom-empty">还没有视觉素材</div>
      </div>
    )
  }

  return (
    <div className="image-zoom-card">
      <header>
        <span>{label}</span>
        <select value={current.id} onChange={(event) => onSelect(event.target.value)}>
          {images.map((item) => (
            <option key={item.id} value={item.id}>
              {item.vehicleLabel || item.filename}
              {item.role === 'primary' ? ' · 主分析' : ' · 其他'}
            </option>
          ))}
        </select>
      </header>
      <div
        ref={stageRef}
        className="image-zoom-stage"
        onPointerDown={(event) => {
          if (event.button !== 0) return
          drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!drag.current) return
          setOffset({
            x: drag.current.ox + event.clientX - drag.current.x,
            y: drag.current.oy + event.clientY - drag.current.y
          })
        }}
        onPointerUp={() => {
          drag.current = null
        }}
        onPointerCancel={() => {
          drag.current = null
        }}
      >
        <img
          src={current.dataUrl}
          alt={current.filename}
          draggable={false}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        />
      </div>
    </div>
  )
}
