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
  mockStyleSelect,
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
  if (task === 'pfdbi') {
    const result = mockPfdbi()
    if (prompt.includes('没有参考图')) {
      result.coreConclusion = '当前没有参考图，型面与灯组证据不足，不能把想象中的外观写成看见的事实。'
      result.P.applicable = false
      result.F.applicable = false
      result.D.applicable = false
      result.P.judgement = '暂无足够证据'
      result.F.judgement = '暂无足够证据'
      result.D.judgement = '暂无足够证据'
      result.facts = ['没有参考图，未观察到型面']
      result.inferences = ['后续补图后再评价外观']
    }
    if (prompt.includes('"role":"other"')) {
      result.peerComparisons = [
        {
          subjects: ['主分析车型', '其他车型'],
          relation: '用户填写的比较说明',
          observations: ['其他车型的肩线更厚，灯组图形更收敛'],
          differences: ['主分析车型更依赖细长灯语，其他车型更依赖体量'],
          evidence: ['主分析图与其他车型参考图的比例、灯组观察']
        }
      ]
    }
    return result
  }
  if (task === 'base_draft') return mockBaseDraft()
  if (task === 'document_analysis') {
    const documentId = prompt.match(/documentId=([^\s]+)/)?.[1] ?? 'doc_demo'
    return mockDocumentAnalysis(documentId)
  }
  if (task === 'style_aggregation') return mockStyleProfile()
  if (task === 'template_generation') {
    const base = mockTemplates()[0]
    return {
      ...base,
      templateName: '现象开场后拆证据',
      applicableTopics: []
    }
  }
  if (task === 'fewshot_generation') return { examples: mockExamples() }
  if (task === 'style_quality') return mockStyleQuality()
  if (task === 'style_adapter' || task === 'commercial_adapter') return mockFinalScript()
  if (task === 'script_quality') return mockQuality()
  if (task === 'template_match') return mockTemplateMatch()
  if (task === 'style_select') return mockStyleSelect(prompt)
  if (task === 'rewrite' || task === 'json_repair') {
    return { text: prompt.slice(-400) }
  }
  return { ok: true }
}
