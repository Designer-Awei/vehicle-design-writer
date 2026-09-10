import { parseJsonObject } from '@schemas/common'
import type { z } from 'zod'
import { logError } from '@infrastructure/logging/logger'
import type { LLMProvider } from '@infrastructure/llm/types'

/**
 * 解析模型 JSON，失败时走一次 repair pass，再用 Zod 校验。
 */
export async function parseModelJson<T>(
  raw: string,
  schema: z.ZodType<T>,
  provider?: LLMProvider,
  model?: string,
  repairInstruction?: string
): Promise<T> {
  let parsed: unknown
  try {
    parsed = parseJsonObject(raw)
    return schema.parse(parsed)
  } catch (firstError) {
    const hint = firstError instanceof Error ? firstError.message : String(firstError)
    logError('json.parse', firstError)
    if (!provider || !model) throw firstError
    const repaired = await provider.chat(
      {
        task: 'json_repair',
        capability: 'json',
        json: true,
        maxTokens: 4096,
        messages: [
          {
            role: 'system',
            content: `你只输出修复后的 JSON 对象，不要解释。${repairInstruction ?? '保持原字段；缺失字段使用语义安全的空值补齐。'}校验失败原因：${hint}`
          },
          {
            role: 'user',
            content: (parsed === undefined ? raw : JSON.stringify(parsed)).slice(0, 12000)
          }
        ]
      },
      model
    )
    try {
      return schema.parse(parseJsonObject(repaired.text))
    } catch (secondError) {
      logError('json.repair', secondError)
      throw new Error('模型返回的结构化数据不完整，自动修复后仍无法解析。请重试或更换模型。')
    }
  }
}
