import type { ReactNode } from 'react'

interface FieldInlineProps {
  label: string
  htmlFor: string
  children: ReactNode
}

/**
 * 标签在控件前方的表单行，用于铺满横向的参数区。
 */
export function FieldInline({ label, htmlFor, children }: FieldInlineProps): React.JSX.Element {
  return (
    <label className="field-inline" htmlFor={htmlFor}>
      <span className="field-inline-label">{label}</span>
      <span className="field-inline-control">{children}</span>
    </label>
  )
}
