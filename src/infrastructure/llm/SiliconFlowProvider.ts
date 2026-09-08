import { DEFAULT_BASE_URL } from '@shared/constants'
import { logError, logInfo } from '../logging/logger'
import { assertCapability, inferCapability, toUsage } from './capability'
import type { ChatMessage, ChatRequest, ChatResponse, LLMProvider } from './types'

interface SiliconFlowOptions {
  apiKey: string
  baseUrl: string
}

interface SiliconFlowChoice {
  message?: { content?: string | Array<{ type?: string; text?: string }> }
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
    }
    if (request.maxTokens) {
      body.max_tokens = request.maxTokens
    }

    let payload: SiliconFlowPayload
    try {
      payload = await this.request(body)
    } catch (error) {
      if (request.json && error instanceof Error && /response_format|json/i.test(error.message)) {
        logInfo('llm.json_fallback', { model, task: request.task })
        delete body.response_format
        payload = await this.request(body)
      } else {
        throw error
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
      signal: AbortSignal.timeout(120000)
    })
    if (!response.ok) {
      const detail = await response.text()
      logError('llm.http', new Error(`status=${response.status}`))
      throw new Error(`SiliconFlow 请求失败（${response.status}）：${detail.slice(0, 300)}`)
    }
    return (await response.json()) as SiliconFlowPayload
  }
}

function toApiMessage(message: ChatMessage): { role: string; content: unknown } {
  return { role: message.role, content: message.content }
}

function extractText(payload: SiliconFlowPayload): string {
  const content = payload.choices?.[0]?.message?.content
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
