import { useEffect, useMemo, useState } from 'react'
import { FieldInline } from '@renderer/components/FieldInline'
import { ipcErrorMessage } from '@renderer/lib/utils'
import { PLATFORMS, STYLE_CATEGORIES, STYLE_NOTES_LIMIT } from '@shared/constants'
import type { StyleMetadataPatch, StyleRecord } from '@shared/ipc'

/**
 * 已创建风格的档案信息编辑：名称、平台、内容类型、风格简介，变更后立即保存。
 */
export function StyleMetaEditor({
  style,
  onSaved
}: {
  style: StyleRecord
  onSaved?: (next: StyleRecord) => void
}): React.JSX.Element {
  const [name, setName] = useState(style.name)
  const [platform, setPlatform] = useState(style.platform)
  const [category, setCategory] = useState(style.category)
  const [notes, setNotes] = useState(style.notes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setName(style.name)
    setPlatform(style.platform)
    setCategory(style.category)
    setNotes(style.notes)
    setError('')
  }, [style.id, style.updatedAt, style.name, style.platform, style.category, style.notes])

  const platformOptions = useMemo(() => withCurrentOption(PLATFORMS, platform), [platform])
  const categoryOptions = useMemo(() => withCurrentOption(STYLE_CATEGORIES, category), [category])

  /**
   * 把档案字段写入数据库，并回传最新记录。
   */
  async function persist(patch: StyleMetadataPatch): Promise<void> {
    setSaving(true)
    setError('')
    try {
      const next = await window.api.styles.update(style.id, patch)
      onSaved?.(next)
    } catch (item) {
      setError(ipcErrorMessage(item))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="style-meta-editor">
      <FieldInline label="博主名称" htmlFor="styleEditName">
        <input
          id="styleEditName"
          className="rounded bg-[#0c0b0a] px-3 py-2 text-[#f3ece1]"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            const next = name.trim()
            if (!next) {
              setName(style.name)
              setError('请填写风格名称')
              return
            }
            if (next !== style.name) void persist({ name: next })
          }}
        />
      </FieldInline>
      <FieldInline label="发布平台" htmlFor="styleEditPlatform">
        <select
          id="styleEditPlatform"
          className="rounded bg-[#0c0b0a] px-3 py-2 text-[#f3ece1]"
          value={platform}
          onChange={(event) => {
            const next = event.target.value
            setPlatform(next)
            if (next !== style.platform) void persist({ platform: next })
          }}
        >
          {platformOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </FieldInline>
      <FieldInline label="内容类型" htmlFor="styleEditCategory">
        <select
          id="styleEditCategory"
          className="rounded bg-[#0c0b0a] px-3 py-2 text-[#f3ece1]"
          value={category}
          onChange={(event) => {
            const next = event.target.value
            setCategory(next)
            if (next !== style.category) void persist({ category: next })
          }}
        >
          {categoryOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </FieldInline>
      <FieldInline label="风格简介" htmlFor="styleEditNotes">
        <input
          id="styleEditNotes"
          className="rounded bg-[#0c0b0a] px-3 py-2 text-[#f3ece1]"
          maxLength={STYLE_NOTES_LIMIT}
          placeholder="提取时自动生成，20字以内"
          value={notes}
          onChange={(event) => setNotes(event.target.value.slice(0, STYLE_NOTES_LIMIT))}
          onBlur={() => {
            const next = notes.trim().slice(0, STYLE_NOTES_LIMIT)
            setNotes(next)
            if (next !== style.notes) void persist({ notes: next })
          }}
        />
      </FieldInline>
      <p className="style-meta-status">
        {error ? error : saving ? '正在保存…' : '修改后自动保存，不影响已提取的 Style DNA。'}
      </p>
    </div>
  )
}

/**
 * 下拉选项保留当前值，避免旧数据无法显示。
 */
function withCurrentOption(options: readonly string[], current: string): string[] {
  if (!current || options.includes(current)) return [...options]
  return [current, ...options]
}
