import { parseJsonObject } from '@schemas/common'
import type { z } from 'zod'
import type { LLMProvider } from '@infrastructure/llm/types'

/**
 * 解析模型 JSON，失败时走一次 repair pass，再用 Zod 校验。
 */
export async function parseModelJson<T>(
  raw: string,
  schema: z.ZodType<T>,
  provider?: LLMProvider,
  model?: string
): Promise<T> {
  try {
    return schema.parse(parseJsonObject(raw))
  } catch (firstError) {
    if (!provider || !model) throw firstError
    const repaired = await provider.chat(
      {
        task: 'json_repair',
        capability: 'json',
        json: true,
        messages: [
          {
            role: 'system',
            content: '你只输出修复后的 JSON 对象，不要解释。保持原字段。'
          },
          { role: 'user', content: raw.slice(0, 12000) }
        ]
      },
      model
    )
    return schema.parse(parseJsonObject(repaired.text))
  }
}
