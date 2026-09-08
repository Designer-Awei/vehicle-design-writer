import { z } from 'zod'

export const NonEmptyStringSchema = z.string().min(1)
export const ScoreSchema = z.number().min(0).max(1)
export const StringArraySchema = z.array(z.string())

/**
 * 将未知模型输出解析为 JSON 对象，失败时抛出可读错误。
 */
export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1].trim() : trimmed
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('模型输出中未找到 JSON 对象')
  }
  const slice = raw.slice(start, end + 1)
  try {
    return JSON.parse(slice)
  } catch {
    return JSON.parse(repairJson(slice))
  }
}

/**
 * 修复常见 JSON 瑕疵：尾逗号。不改写字符串内的中文引号。
 */
export function repairJson(input: string): string {
  return input.replace(/,\s*([}\]])/g, '$1')
}
