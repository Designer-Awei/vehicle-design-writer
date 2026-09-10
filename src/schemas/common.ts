import { z } from 'zod'

export const NonEmptyStringSchema = z.string().min(1)

/**
 * 把模型常见的 0–100 分值、百分比字符串和小数收成 0–1。
 */
export const ScoreSchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const hasPercent = trimmed.includes('%')
    const n = Number(trimmed.replace(/%/g, ''))
    if (!Number.isFinite(n)) return 0
    if (hasPercent || (n > 1 && n <= 100)) return clampUnit(n / 100)
    return clampUnit(n)
  }
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  if (n > 1 && n <= 100) return n / 100
  return clampUnit(n)
}, z.number().min(0).max(1))

/**
 * 把数值限制在 0–1。
 */
function clampUnit(n: number): number {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

/**
 * 模型常把列表写成一句中文，这里收成字符串数组。
 */
export const StringArraySchema = z.preprocess((value) => {
  if (value == null || value === '') return []
  if (Array.isArray(value)) {
    return value
      .filter((item) => item != null && `${item}`.trim() !== '')
      .map((item) => (typeof item === 'string' ? item : String(item)))
  }
  if (typeof value === 'string') {
    const parts = value
      .split(/[；;|\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
    return parts.length > 0 ? parts : [value.trim()]
  }
  return []
}, z.array(z.string()))

/**
 * 将未知模型输出解析为 JSON 对象，失败时抛出可读错误。
 */
export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const sources = [trimmed]
  const withoutThink = stripThinkBlocks(trimmed)
  if (withoutThink !== trimmed) sources.push(withoutThink)

  for (const source of sources) {
    const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)
    const raw = fenced ? fenced[1].trim() : source
    const candidates = extractJsonValues(raw)
    const start = raw.search(/[{[]/)
    const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'))
    if (start >= 0 && end > start) {
      candidates.push(raw.slice(start, end + 1))
    }
    for (const candidate of uniqueReversed(candidates)) {
      try {
        return JSON.parse(candidate)
      } catch {
        try {
          return JSON.parse(repairJson(candidate))
        } catch {
          continue
        }
      }
    }
  }
  throw new Error('模型输出中未找到 JSON 对象')
}

/**
 * 修复常见 JSON 瑕疵：尾逗号。不改写字符串内的中文引号。
 */
export function repairJson(input: string): string {
  return input.replace(/,\s*([}\]])/g, '$1')
}

/**
 * 去掉思考模型包在 think 标签里的推理过程。
 */
function stripThinkBlocks(text: string): string {
  return text.replace(/<think\b[^>]*>[\s\S]*?(<\/think>|$)/gi, '').trim()
}

/**
 * 按括号配对抽出顶层 JSON 对象或数组。
 */
function extractJsonValues(text: string): string[] {
  const values: string[] = []
  let depth = 0
  let start = -1
  let opening = ''
  let inString = false
  let escape = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if ((ch === '{' || ch === '[') && depth === 0) {
      start = i
      opening = ch
      depth = 1
      continue
    }
    if (ch === '{' || ch === '[') {
      depth += 1
      continue
    }
    if (ch === '}' || ch === ']') {
      if (depth === 0) continue
      depth -= 1
      if (depth === 0 && start >= 0) {
        const expected = opening === '{' ? '}' : ']'
        if (ch === expected) values.push(text.slice(start, i + 1))
        start = -1
        opening = ''
      }
    }
  }
  return values
}

/**
 * 后出现的完整 JSON 更可能是最终答案。
 */
function uniqueReversed(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const value = values[i]
    if (seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}
