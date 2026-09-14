import { DEFAULT_BASE_URL } from '@shared/constants'
import { logError, logInfo } from '../logging/logger'
import { assertCapability, inferCapability, toUsage } from './capability'
import type { ChatMessage, ChatRequest, ChatResponse, LLMProvider } from './types'

interface SiliconFlowOptions {
  apiKey: string
  baseUrl: string
}

interface SiliconFlowChoice {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>
    reasoning_content?: string
    reasoning?: string
  }
  finish_reason?: string
}

interface SiliconFlowPayload {
  choices?: SiliconFlowChoice[]
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  model?: string
}

/**
 * SiliconFlow OpenAI-compatible Provider。文档：https://api-docs.siliconflow.cn/docs
 */
export class SiliconFlowProvider implements LLMProvider {
  readonly name = 'siliconflow'

  constructor(private readonly options: SiliconFlowOptions) {}

  async listModels(): Promise<string[]> {
    const baseUrl = this.options.baseUrl || DEFAULT_BASE_URL
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
      headers: { Authorization: `Bearer ${this.options.apiKey}` }
    })
    if (!response.ok) {
      throw new Error(`获取模型列表失败：${response.status}`)
    }
    const payload = (await response.json()) as { data?: Array<{ id: string }> }
    return (payload.data ?? []).map((item) => item.id)
  }

  async chat(request: ChatRequest, model: string): Promise<ChatResponse> {
    const capability = inferCapability(model)
    assertCapability(request, capability)
    const started = Date.now()
    const body: Record<string, unknown> = {
      model,
      messages: request.messages.map(toApiMessage),
      temperature: 0.4
    }
    if (request.json) {
      body.response_format = { type: 'json_object' }
      body.max_tokens = request.maxTokens ?? 8192
    } else if (request.maxTokens) {
      body.max_tokens = request.maxTokens
    }

    let payload: SiliconFlowPayload
    try {
      payload = await this.request(body)
    } catch (error) {
      if (isTimeoutError(error)) {
        throw wrapLlmError(error)
      }
      if (request.json && error instanceof Error && /response_format|json/i.test(error.message)) {
        logInfo('llm.json_fallback', { model, task: request.task })
        delete body.response_format
        try {
          payload = await this.request(body)
        } catch (fallbackError) {
          throw wrapLlmError(fallbackError)
        }
      } else {
        throw wrapLlmError(error)
      }
    }

    const text = extractText(payload)
    const promptText = flattenMessages(request.messages)
    logInfo('llm.chat', {
      provider: this.name,
      model,
      task: request.task,
      durationMs: Date.now() - started
    })
    return {
      text,
      model: payload.model ?? model,
      usage: toUsage(promptText, text, payload.usage),
      durationMs: Date.now() - started
    }
  }

  private async request(body: Record<string, unknown>): Promise<SiliconFlowPayload> {
    const baseUrl = this.options.baseUrl || DEFAULT_BASE_URL
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000)
    })
    if (!response.ok) {
      const detail = await response.text()
      logError('llm.http', new Error(`status=${response.status}`))
      throw new Error(describeSiliconFlowHttpError(response.status, detail))
    }
    return (await response.json()) as SiliconFlowPayload
  }
}

/**
 * 把 SiliconFlow HTTP 错误收成可直接展示的中文，避免任务列表只看到“超时”。
 */
export function describeSiliconFlowHttpError(status: number, body: string): string {
  const parsed = parseJsonObject(body)
  const raw =
    (typeof parsed?.message === 'string' && parsed.message) ||
    (typeof parsed?.error === 'string' && parsed.error) ||
    body
  const code = parsed?.code
  const haystack = `${status} ${code ?? ''} ${raw}`.toLowerCase()
  if (status === 402 || code === 30001 || /insufficient|balance|余额不足/u.test(haystack)) {
    return 'SiliconFlow 账户余额不足，请充值后再试。也可到设置页清空 API Key，改用演示模式提取。'
  }
  if (status === 401 || /unauthorized|invalid api key|incorrect api key/u.test(haystack)) {
    return 'SiliconFlow API Key 无效或已过期，请到设置页检查。'
  }
  if (status === 429 || /rate limit|too many requests|频繁/u.test(haystack)) {
    return 'SiliconFlow 请求过于频繁，请稍后再试。'
  }
  const snippet = raw.replace(/\s+/gu, ' ').trim().slice(0, 180)
  return snippet ? `SiliconFlow 请求失败（${status}）：${snippet}` : `SiliconFlow 请求失败（${status}）`
}

/**
 * 余额不足或 Key 无效时，继续排队只会重复失败。
 */
export function isUnrecoverableProviderError(message: string): boolean {
  return /账户余额不足|API Key 无效|已过期/u.test(message)
}

/**
 * 尝试从 SiliconFlow 错误正文里取出 JSON 字段。
 */
function parseJsonObject(text: string): { message?: unknown; error?: unknown; code?: unknown } | null {
  try {
    const value = JSON.parse(text) as unknown
    return value && typeof value === 'object' ? (value as { message?: unknown; error?: unknown; code?: unknown }) : null
  } catch {
    return null
  }
}

/**
 * SiliconFlow / undici 超时会抛 TimeoutError，这里收成可直接展示的中文。
 */
function wrapLlmError(error: unknown): Error {
  if (isTimeoutError(error)) {
    logError('llm.timeout', error)
    return new Error('模型响应超时。已改为分片并行提取，请再试一次；若连续失败可更换更快的文本模型。')
  }
  if (error instanceof Error) return error
  return new Error(String(error))
}

/**
 * 判断是否为 AbortSignal.timeout 触发的超时。
 */
function isTimeoutError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'TimeoutError') ||
    (typeof error === 'object' &&
      error != null &&
      'name' in error &&
      (error as { name: string }).name === 'TimeoutError') ||
    (error instanceof Error && /aborted due to timeout/i.test(error.message))
  )
}

function toApiMessage(message: ChatMessage): { role: string; content: unknown } {
  return { role: message.role, content: message.content }
}

function extractText(payload: SiliconFlowPayload): string {
  const message = payload.choices?.[0]?.message
  const content = stringifyContent(message?.content)
  const reasoning =
    (typeof message?.reasoning_content === 'string' ? message.reasoning_content : '') ||
    (typeof message?.reasoning === 'string' ? message.reasoning : '')
  if (content.includes('{') || content.includes('[')) return content
  if (reasoning.includes('{') || reasoning.includes('[')) return reasoning
  return content || reasoning
}

/**
 * 把 SiliconFlow 可能返回的字符串或分段 content 拼成纯文本。
 */
function stringifyContent(
  content: string | Array<{ type?: string; text?: string }> | undefined
): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((part) => part.text ?? '').join('\n')
  }
  return ''
}

function flattenMessages(messages: ChatMessage[]): string {
  return messages
    .map((message) => {
      if (typeof message.content === 'string') return message.content
      return message.content
        .map((part) => (part.type === 'text' ? part.text : '[image]'))
        .join('\n')
    })
    .join('\n')
}
