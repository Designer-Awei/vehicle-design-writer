import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

/**
 * 不占版面的短暂提示，贴在顶栏操作旁，像 hover 气泡，数秒后消失。
 */
export function HoverToast({
  message,
  onHide,
  durationMs = 3200
}: {
  message: string
  onHide: () => void
  durationMs?: number
}): React.JSX.Element | null {
  const onHideRef = useRef(onHide)
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 })

  useEffect(() => {
    onHideRef.current = onHide
  }, [onHide])

  useLayoutEffect(() => {
    const slot = document.getElementById('workspace-actions')
    const rect = slot?.getBoundingClientRect()
    if (rect && rect.width > 8) {
      setStyle({
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right)
      })
      return
    }
    setStyle({ top: 72, right: 24 })
  }, [message])

  useEffect(() => {
    const timer = window.setTimeout(() => onHideRef.current(), durationMs)
    return () => window.clearTimeout(timer)
  }, [message, durationMs])

  return createPortal(
    <div className="hover-toast" role="status" style={style}>
      {message}
    </div>,
    document.body
  )
}
