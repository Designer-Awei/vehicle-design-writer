import { CONTENT_TYPES, STYLE_NOTES_LIMIT, type ContentType } from '@shared/constants'
import type { ExampleCase, StyleProfile, StructureTemplate } from '@schemas/index'
import type { StylePreviewCard } from '@shared/ipc'

const PLACEHOLDER_AUTHOR = new Set(['未命名创作者', '未命名', ''])
const PLACEHOLDER_PLATFORM = new Set(['未知平台', '未指定', ''])
const PLACEHOLDER_NOTES = new Set(['样本中未体现', '未命名创作者', '未命名', ''])

/**
 * 把提取结果收成预览风格卡：标题优先「作者 + 内容类型」，作者未知时用文件名。
 */
export function buildStylePreview(
  artifacts: {
    profile: StyleProfile
    templates: StructureTemplate[]
    examples: ExampleCase[]
    category?: ContentType
  },
  source: { filename: string; wordCount: number }
): StylePreviewCard {
  const stem = source.filename.replace(/\.[^.]+$/u, '') || source.filename
  const rawAuthor = artifacts.profile.creator.name.trim()
  const author = PLACEHOLDER_AUTHOR.has(rawAuthor) ? stem : rawAuthor
  const rawPlatform = artifacts.profile.creator.platform.trim()
  const platform = PLACEHOLDER_PLATFORM.has(rawPlatform) ? '' : rawPlatform
  const category = artifacts.category ?? pickCategory(artifacts.templates)
  const notes = deriveStyleNotes(artifacts.profile)
  const profile = {
    ...artifacts.profile,
    creator: { ...artifacts.profile.creator, notes }
  }
  const summary =
    notes ||
    profile.creator.description.trim() ||
    profile.language.rhythm.trim() ||
    '已从样本文案提取语言习惯与结构模板。'
  return {
    author,
    platform,
    category,
    summary,
    notes,
    sourceFilename: source.filename,
    wordCount: source.wordCount,
    profile,
    templates: artifacts.templates,
    examples: artifacts.examples
  }
}

/**
 * 从 Style DNA 抽出不超过 20 字的风格简介，供卡片展示和创作选卡。
 */
export function deriveStyleNotes(profile: StyleProfile): string {
  const candidates = [
    profile.creator.notes,
    firstClause(profile.creator.description),
    firstClause(profile.language.colloquialism),
    firstClause(profile.language.rhythm)
  ]
  for (const item of candidates) {
    const clipped = clipStyleNotes(item)
    if (clipped) return clipped
  }
  return '口语设计口播'
}

/**
 * 去掉空白后截到 20 字；优先取逗号或句号前的第一句。
 */
export function clipStyleNotes(text: string | undefined): string {
  const cleaned = (text ?? '').replace(/\s+/gu, '').trim()
  if (!cleaned || PLACEHOLDER_NOTES.has(cleaned)) return ''
  const clause = cleaned.split(/[，。；、！？]/u).find((item) => item.length > 0) ?? cleaned
  if (clause.length <= STYLE_NOTES_LIMIT) return clause
  return clause.slice(0, STYLE_NOTES_LIMIT)
}

/**
 * 内容类型只做预览卡标签：优先用单篇分析给出的分类。
 */
export function pickContentType(
  analyses: Array<{ contentType?: string; topic?: string }>
): ContentType {
  for (const item of analyses) {
    const direct = CONTENT_TYPES.find((type) => type === item.contentType)
    if (direct) return direct
    const fromTopic = CONTENT_TYPES.find((type) => (item.topic ?? '').includes(type))
    if (fromTopic) return fromTopic
  }
  return '设计观点'
}

/**
 * 旧卡没有单篇分类时，再从模板名称里兜底。
 */
function pickCategory(templates: StructureTemplate[]): ContentType {
  for (const type of CONTENT_TYPES) {
    if (
      templates.some(
        (item) => item.templateName.includes(type) || item.applicableTopics.includes(type)
      )
    ) {
      return type
    }
  }
  return '设计观点'
}

function firstClause(text: string): string {
  const cleaned = text.trim()
  if (!cleaned) return ''
  return cleaned.split(/[。！？]/u)[0] ?? cleaned
}
