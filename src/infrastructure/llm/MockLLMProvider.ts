import { toUsage } from './capability'
import {
  mockBaseDraft,
  mockDocumentAnalysis,
  mockExamples,
  mockFinalScript,
  mockPfdbi,
  mockQuality,
  mockStyleProfile,
  mockStyleQuality,
  mockTemplateMatch,
  mockTemplates,
  mockVision
} from './mock-payloads'
import type { ChatRequest, ChatResponse, LLMProvider, LLMTask } from './types'

/**
 * 无 API Key 时的演示 Provider，返回符合 Schema 的结构化结果。
 */
export class MockLLMProvider implements LLMProvider {
  readonly name = 'mock'

  async listModels(): Promise<string[]> {
    return ['mock-text', 'mock-vision']
  }

  async chat(request: ChatRequest, model = 'mock-llm'): Promise<ChatResponse> {
    const started = Date.now()
    const text = JSON.stringify(
      resolvePayload(request.task, request.messages.map(asText).join('\n'))
    )
    return {
      text,
      model,
      usage: toUsage(asText(request.messages[0] ?? { role: 'user', content: '' }), text),
      durationMs: Date.now() - started
    }
  }
}

function asText(message: ChatRequest['messages'][number]): string {
  if (typeof message.content === 'string') return message.content
  return message.content.map((part) => (part.type === 'text' ? part.text : '')).join('\n')
}

function resolvePayload(task: LLMTask, prompt: string): unknown {
  if (task === 'vision') {
    const imageId = prompt.match(/imageId=([^\s]+)/)?.[1] ?? 'img_demo'
    return mockVision(imageId)
  }
  if (task === 'pfdbi') return mockPfdbi()
  if (task === 'base_draft') return mockBaseDraft()
  if (task === 'document_analysis') {
    const documentId = prompt.match(/documentId=([^\s]+)/)?.[1] ?? 'doc_demo'
    return mockDocumentAnalysis(documentId)
  }
  if (task === 'style_aggregation') return mockStyleProfile()
  if (task === 'template_generation') return { templates: mockTemplates() }
  if (task === 'fewshot_generation') return { examples: mockExamples() }
  if (task === 'style_quality') return mockStyleQuality()
  if (task === 'style_adapter' || task === 'commercial_adapter') return mockFinalScript()
  if (task === 'script_quality') return mockQuality()
  if (task === 'template_match') return mockTemplateMatch()
  if (task === 'rewrite' || task === 'json_repair') {
    return { text: prompt.slice(-400) }
  }
  return { ok: true }
}
