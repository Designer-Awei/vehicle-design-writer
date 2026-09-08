import { describe, expect, it } from 'vitest'
import {
  countWords,
  decodeBuffer,
  stripRtf
} from '../src/infrastructure/filesystem/document-parser'
import { parseJsonObject, repairJson as repair } from '../src/schemas/common'
import { estimateDuration } from '../src/application/duration'
import {
  VisionObservationSchema,
  PFDBIAnalysisSchema,
  StyleProfileSchema,
  StructureTemplateSchema
} from '../src/schemas/index'
import {
  mockPfdbi,
  mockStyleProfile,
  mockTemplates,
  mockVision
} from '../src/infrastructure/llm/mock-payloads'
import { ModelRouter } from '../src/application/model-router'
import { inferCapability } from '../src/infrastructure/llm/capability'
import { MockLLMProvider } from '../src/infrastructure/llm/MockLLMProvider'
import { parseModelJson } from '../src/application/json-parse'

describe('document parser', () => {
  it('counts chinese and latin words', () => {
    expect(countWords('设计 很好 design')).toBe(5)
  })

  it('decodes utf8 buffer', () => {
    expect(decodeBuffer(Buffer.from('姿态', 'utf8'))).toBe('姿态')
  })

  it('strips rtf control words', () => {
    expect(stripRtf('{\\rtf1 前脸}')).toContain('前脸')
  })
})

describe('json repair', () => {
  it('parses fenced json', () => {
    const value = parseJsonObject('```json\n{"a":1,}\n```') as { a: number }
    expect(value.a).toBe(1)
  })

  it('repairs trailing commas', () => {
    expect(repair('{"a":1,}')).toBe('{"a":1}')
  })
})

describe('duration', () => {
  it('estimates words from minutes', () => {
    const result = estimateDuration('测'.repeat(290), 60, {
      id: 't',
      name: 't',
      language: 'zh',
      wordsPerMinute: 290,
      tolerancePercent: 10
    })
    expect(result.targetWords).toBe(290)
    expect(result.actualWords).toBe(290)
    expect(result.warning).toBeNull()
  })
})

describe('schemas', () => {
  it('accepts vision / pfdbi / style / template mocks', () => {
    expect(VisionObservationSchema.parse(mockVision('img_1')).imageId).toBe('img_1')
    expect(PFDBIAnalysisSchema.parse(mockPfdbi()).coreConclusion.length).toBeGreaterThan(0)
    expect(StyleProfileSchema.parse(mockStyleProfile()).creator.name).toContain('DEMO DATA')
    expect(StructureTemplateSchema.parse(mockTemplates()[0]).sections.length).toBeGreaterThan(0)
  })
})

describe('model router', () => {
  it('selects configured models', () => {
    const router = new ModelRouter({
      textModel: 'deepseek-ai/DeepSeek-V4-Flash',
      visionModel: 'Qwen/Qwen3-VL-32B-Instruct'
    })
    expect(router.select('text')).toContain('DeepSeek')
    expect(router.select('vision')).toContain('VL')
    expect(inferCapability('Qwen/Qwen3-VL-32B-Instruct').supportsVision).toBe(true)
    expect(inferCapability('deepseek-ai/DeepSeek-V4-Flash').supportsVision).toBe(false)
  })
})

describe('mock llm', () => {
  it('returns valid pfdbi json', async () => {
    const provider = new MockLLMProvider()
    const response = await provider.chat(
      {
        task: 'pfdbi',
        capability: 'json',
        json: true,
        messages: [{ role: 'user', content: 'test' }]
      },
      'mock'
    )
    const parsed = await parseModelJson(response.text, PFDBIAnalysisSchema, provider, 'mock')
    expect(parsed.P.applicable).toBe(true)
  })
})
