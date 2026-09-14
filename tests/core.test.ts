import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  countWords,
  decodeBuffer,
  stripRtf
} from '../src/infrastructure/filesystem/document-parser'
import { parseJsonObject, repairJson as repair } from '../src/schemas/common'
import { describeSiliconFlowHttpError, isUnrecoverableProviderError } from '../src/infrastructure/llm/SiliconFlowProvider'
import { DEFAULT_DURATION, estimateDuration } from '../src/application/duration'
import {
  coerceImageRole,
  ImageRoleSchema,
  VisionObservationSchema,
  PFDBIAnalysisSchema,
  StyleProfileSchema,
  StructureTemplateSchema,
  DocumentAnalysisSchema,
  TemplateBundleSchema,
  ExampleBundleSchema,
  SingleTemplateSchema,
  StyleCreatorToneSliceSchema,
  StyleLanguageSliceSchema,
  StyleSelectSchema,
  TemplateMatchSchema
} from '../src/schemas/index'
import { ScoreSchema } from '../src/schemas/common'
import {
  mockPfdbi,
  mockStyleProfile,
  mockTemplates,
  mockExamples,
  mockVision
} from '../src/infrastructure/llm/mock-payloads'
import { ModelRouter } from '../src/application/model-router'
import { normalizeExamples, normalizeTemplates } from '../src/application/style-extract-normalize'
import { mapPool } from '../src/application/async-pool'
import { inferCapability } from '../src/infrastructure/llm/capability'
import { MockLLMProvider } from '../src/infrastructure/llm/MockLLMProvider'
import { parseModelJson } from '../src/application/json-parse'
import { baseDraftPrompt } from '../src/prompts/index'
import { AppDatabase } from '../src/infrastructure/db/database'
import { Repositories } from '../src/infrastructure/db/repositories'
import { runDraftGeneration, runPfdbiAnalysis, runVisionAnalysis } from '../src/application/workflows/DraftGenerationWorkflow'
import { buildStylePreview, clipStyleNotes, deriveStyleNotes, pickContentType } from '../src/application/style-preview'
import { STYLE_NOTES_LIMIT, WORDS_PER_MINUTE } from '../src/shared/constants'
import { countCopyWords } from '../src/renderer/src/lib/text'
import { notesFromPfdbi, pfdbiFromNotes } from '../src/renderer/src/lib/pfdbi-notes'

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

  it('extracts json after think blocks', () => {
    const value = parseJsonObject(
      '<think>先看这段文案 { "noise": true }</think>\n{"documentId":"doc_1","topic":"MINI"}'
    ) as { documentId: string; topic: string }
    expect(value.documentId).toBe('doc_1')
    expect(value.topic).toBe('MINI')
  })
})

describe('siliconflow errors', () => {
  it('explains insufficient account balance instead of a generic timeout', () => {
    const message = describeSiliconFlowHttpError(
      402,
      '{"code":30001,"message":"Sorry, your account balance is insufficient","data":null}'
    )
    expect(message).toContain('账户余额不足')
    expect(isUnrecoverableProviderError(message)).toBe(true)
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

describe('base draft facts', () => {
  it('puts fact notes into the base draft prompt without mixing them into the opinion draft', () => {
    const prompt = baseDraftPrompt({
      topic: '前脸为什么越来越像',
      draft: '想吐槽同质化',
      facts: '轴距 3000mm',
      durationSeconds: 300,
      platform: 'B站',
      pfdbi: '{}',
      wordsPerMinute: 180
    })
    expect(prompt.user).toContain('轴距 3000mm')
    expect(prompt.user).toContain('想吐槽同质化')
    expect(prompt.system).toContain('事实补充')
  })
})

describe('schemas', () => {
  it('accepts vision / pfdbi / style / template mocks', () => {
    expect(VisionObservationSchema.parse(mockVision('img_1')).imageId).toBe('img_1')
    expect(PFDBIAnalysisSchema.parse(mockPfdbi()).coreConclusion.length).toBeGreaterThan(0)
    expect(StyleProfileSchema.parse(mockStyleProfile()).creator.name).toContain('DEMO DATA')
    expect(StructureTemplateSchema.parse(mockTemplates()[0]).sections.length).toBeGreaterThan(0)
  })

  it('defaults comparison arrays for old PFDBI records', () => {
    const legacy = { ...mockPfdbi() } as Record<string, unknown>
    delete legacy.peerComparisons
    delete legacy.verticalComparisons
    delete legacy.horizontalComparisons
    const parsed = PFDBIAnalysisSchema.parse(legacy)
    expect(parsed.peerComparisons).toEqual([])
    expect(parsed.verticalComparisons).toEqual([])
    expect(parsed.horizontalComparisons).toEqual([])
  })

  it('normalizes legacy image roles into primary or other', () => {
    expect(ImageRoleSchema.parse('vertical')).toBe('other')
    expect(ImageRoleSchema.parse('horizontal')).toBe('other')
    expect(coerceImageRole('vertical')).toBe('other')
    expect(coerceImageRole('primary')).toBe('primary')
  })

  it('normalizes incomplete document analysis instead of rejecting the whole result', () => {
    const parsed = DocumentAnalysisSchema.parse({
      topic: 'MINI 为什么不做台大车',
      structure: '现象开场；拆观察；给判断',
      languageTraits: '口播短句'
    })
    expect(parsed.topic).toContain('MINI')
    expect(parsed.structure).toEqual(['现象开场', '拆观察', '给判断'])
    expect(parsed.languageTraits).toEqual(['口播短句'])
    expect(parsed.signatureLines).toEqual([])
    expect(parsed.designKnowledgeVsStyle.length).toBeGreaterThan(0)
  })

  it('accepts template arrays and percent-style time values', () => {
    const parsed = TemplateBundleSchema.parse([
      {
        templateName: '车型解读',
        timePercent: 8,
        sections: [{ name: 'Hook', timePercent: 10 }]
      }
    ])
    expect(parsed.templates[0]?.templateName).toBe('车型解读')
    expect(parsed.templates[0]?.sections[0]?.timePercent).toBe(0.1)
  })

  it('maps template and example field aliases instead of falling back to placeholders', () => {
    const templates = TemplateBundleSchema.parse({
      模板: [
        {
          名称: '车型解读口播',
          场景: '拆一辆车的比例',
          适用类型: ['车型解读'],
          段落: [{ 段落名: 'Hook', 占比: '10%', 目的: '抛现象', 写法: '一句话开场' }]
        }
      ]
    })
    expect(templates.templates[0]?.templateName).toBe('车型解读口播')
    expect(templates.templates[0]?.scenario).toBe('拆一辆车的比例')
    expect(templates.templates[0]?.sections[0]?.name).toBe('Hook')
    expect(templates.templates[0]?.sections[0]?.timePercent).toBe(0.1)
    expect(templates.templates[0]?.sections[0]?.purpose).toBe('抛现象')
    expect(templates.templates[0]?.sections[0]?.instruction).toBe('一句话开场')

    const named = TemplateBundleSchema.parse({
      templates: [
        {
          name: '设计观点',
          scenario: '短评一个现象',
          sections: [{ title: '开场', percent: 15, goal: '抓现象' }]
        }
      ]
    })
    expect(named.templates[0]?.templateName).toBe('设计观点')
    expect(named.templates[0]?.sections[0]?.name).toBe('开场')
    expect(named.templates[0]?.sections[0]?.timePercent).toBe(0.15)

    const mapped = TemplateBundleSchema.parse({
      车型解读: {
        scenario: '解读一辆车',
        sections: [{ name: 'Hook', timePercent: 0.1, purpose: '开场' }]
      },
      设计观点: {
        scenario: '给判断',
        sections: [{ name: 'Hook', timePercent: 0.2, purpose: '抓现象' }]
      }
    })
    expect(mapped.templates.map((item) => item.templateName).sort()).toEqual([
      '设计观点',
      '车型解读'
    ])

    const examples = ExampleBundleSchema.parse({
      例子: [
        {
          documentId: 'doc_1',
          场景: '设计观点',
          结构: '现象-证据-反转',
          摘录: '很多车远看都像一家人。',
          原因: '短句开场'
        }
      ]
    })
    expect(examples.examples[0]?.sourceDocumentId).toBe('doc_1')
    expect(examples.examples[0]?.excerpt).toBe('很多车远看都像一家人。')
    expect(examples.examples[0]?.whyRepresentative).toBe('短句开场')
  })

  it('dedupes placeholder templates and empty few-shot excerpts', () => {
    const placeholderSection = {
      name: '未命名段落',
      timePercent: 0.1,
      purpose: '样本中未体现',
      instruction: '样本中未体现'
    }
    const clone = {
      templateName: '未命名模板',
      scenario: '解读某一款车型的设计特点，结合个人体验与理性分析',
      applicableTopics: [] as string[],
      durationRange: '未指定',
      sections: [placeholderSection, { ...placeholderSection, timePercent: 0.2 }]
    }
    const templates = normalizeTemplates([clone, { ...clone }, { ...clone, scenario: clone.scenario }])
    expect(templates).toHaveLength(1)
    expect(templates[0]?.templateName).not.toBe('未命名模板')

    const examples = normalizeExamples(
      [
        {
          sourceDocumentId: 'doc_1',
          scenario: '设计观点',
          structure: '现象-证据',
          excerpt: '先看前轮位置。',
          whyRepresentative: '把术语翻成画面'
        },
        {
          sourceDocumentId: 'doc_1',
          scenario: '设计观点',
          structure: '现象-证据',
          excerpt: '先看前轮位置。',
          whyRepresentative: '重复'
        },
        {
          sourceDocumentId: '',
          scenario: '样本中未体现',
          structure: '样本中未体现',
          excerpt: '',
          whyRepresentative: '样本中未体现'
        }
      ],
      ['doc_1']
    )
    expect(examples).toHaveLength(1)
    expect(examples[0]?.excerpt).toBe('先看前轮位置。')
  })

  it('normalizes 0-100 style scores into 0-1', () => {
    expect(ScoreSchema.parse(78)).toBe(0.78)
    expect(ScoreSchema.parse('0.4')).toBe(0.4)
    expect(ScoreSchema.parse('10%')).toBe(0.1)
  })

  it('parses a single template even when wrapped in a templates array', () => {
    const parsed = SingleTemplateSchema.parse({ templates: [mockTemplates()[0]] })
    expect(parsed.templateName).toBe('车型解读')
    expect(parsed.sections.length).toBeGreaterThan(0)
  })

  it('fills missing style DNA slice fields and merges them', () => {
    const tone = StyleCreatorToneSliceSchema.parse({})
    const language = StyleLanguageSliceSchema.parse({})
    const merged = StyleProfileSchema.parse({ ...tone, ...language })
    expect(tone.creator.name.length).toBeGreaterThan(0)
    expect(merged.language.sentenceLength.length).toBeGreaterThan(0)
    expect(merged.rhetoric.hookPatterns).toEqual([])
  })

  it('keeps mapPool results in input order', async () => {
    const result = await mapPool([1, 2, 3, 4], 2, async (value) => {
      await new Promise((resolve) => setTimeout(resolve, (5 - value) * 8))
      return value * 10
    })
    expect(result).toEqual([10, 20, 30, 40])
  })

  it('normalizes incomplete vision model output instead of rejecting the whole observation', () => {
    const parsed = VisionObservationSchema.parse({
      imageId: 'img_partial',
      viewType: '侧面',
      vehicleIdentification: {
        brand: '蔚来',
        model: 'ET5T'
      },
      overall: {},
      proportion: {
        wheelSize: '轮径视觉占比较大'
      },
      form: {},
      detail: {},
      cmf: {},
      visualHierarchy: {},
      observations: ['车顶线向尾部延伸']
    })

    expect(parsed.vehicleIdentification.confidence).toBe(0)
    expect(parsed.proportion.wheelPlacement).toBe('暂无足够证据')
    expect(parsed.form.majorVolumes).toEqual([])
    expect(parsed.uncertainties).toEqual([])
  })
})

describe('model router', () => {
  it('selects configured models', () => {
    const router = new ModelRouter({
      textModel: 'Qwen/Qwen3.5-27B',
      visionModel: 'Qwen/Qwen3-VL-32B-Instruct'
    })
    expect(router.select('text')).toContain('Qwen3.5-27B')
    expect(router.select('vision')).toContain('VL')
    expect(inferCapability('Qwen/Qwen3-VL-32B-Instruct').supportsVision).toBe(true)
    expect(inferCapability('Qwen/Qwen3.5-27B').supportsVision).toBe(false)
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

describe('project evidence lifecycle', () => {
  it('reads old pfdbi rows that omit comparison arrays', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vdw-pfdbi-legacy-'))
    const db = new AppDatabase(join(dir, 'test.db'))
    const repos = new Repositories(db)
    try {
      const now = new Date().toISOString()
      repos.upsertProject({
        id: 'proj_legacy',
        title: 'legacy',
        topic: 'legacy',
        draft: '',
        facts: '',
        platform: 'B站',
        durationSeconds: 180,
        contentType: '设计观点',
        styleId: null,
        commercial: {
          enabled: false,
          brand: '',
          model: '',
          goal: '',
          sellingPoints: [],
          mustInclude: [],
          mustAvoid: [],
          placement: 'narrative',
          cta: ''
        },
        status: 'draft',
        createdAt: now,
        updatedAt: now
      })
      const legacy = { ...mockPfdbi() } as Record<string, unknown>
      delete legacy.peerComparisons
      db.run(
        'INSERT INTO pfdbi_analyses(id, project_id, json, cache_key, created_at) VALUES(?,?,?,?,?)',
        ['pfdbi_legacy', 'proj_legacy', JSON.stringify(legacy), '', now]
      )
      expect(repos.getPfdbi('proj_legacy')?.peerComparisons).toEqual([])
    } finally {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })
  it('invalidates vision and downstream artifacts when annotations change', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vdw-test-'))
    const db = new AppDatabase(join(dir, 'test.db'))
    const repos = new Repositories(db)
    try {
      const now = new Date().toISOString()
      repos.upsertProject({
        id: 'proj_1',
        title: 'test',
        topic: 'test',
        draft: '',
        facts: '',
        platform: 'B站',
        durationSeconds: 300,
        contentType: '车型解读',
        styleId: null,
        commercial: {
          enabled: false,
          brand: '',
          model: '',
          goal: '',
          sellingPoints: [],
          mustInclude: [],
          mustAvoid: [],
          placement: 'narrative',
          cta: ''
        },
        status: 'draft',
        createdAt: now,
        updatedAt: now
      })
      repos.insertImage({
        id: 'img_1',
        projectId: 'proj_1',
        path: join(dir, 'image.png'),
        filename: 'image.png',
        hash: 'hash',
        sortOrder: 0,
        role: 'primary'
      })
      repos.saveVision('proj_1', 'img_1', mockVision('img_1'), 'cache')
      repos.savePfdbi('proj_1', mockPfdbi(), 'pfdbi-cache')
      repos.saveScript('proj_1', 'base', { script: 'draft' })

      repos.saveAnnotation({
        imageId: 'img_1',
        x: 0.1,
        y: 0.1,
        width: 0.3,
        height: 0.3,
        note: '重点分析'
      })

      expect(repos.listVision('proj_1')).toEqual([])
      expect(repos.getPfdbi('proj_1')).toBeNull()
      expect(repos.getScript('proj_1', 'base')).toBeNull()
    } finally {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects vision analysis without images', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vdw-test-'))
    const db = new AppDatabase(join(dir, 'test.db'))
    const repos = new Repositories(db)
    try {
      const now = new Date().toISOString()
      repos.upsertProject({
        id: 'proj_2',
        title: 'test',
        topic: 'test',
        draft: '',
        facts: '',
        platform: 'B站',
        durationSeconds: 300,
        contentType: '新车热点',
        styleId: null,
        commercial: {
          enabled: false,
          brand: '',
          model: '',
          goal: '',
          sellingPoints: [],
          mustInclude: [],
          mustAvoid: [],
          placement: 'narrative',
          cta: ''
        },
        status: 'draft',
        createdAt: now,
        updatedAt: now
      })
      const provider = new MockLLMProvider()
      const router = new ModelRouter({ textModel: 'mock-text', visionModel: 'mock-vision' })
      await expect(runVisionAnalysis('proj_2', { repos, provider, router })).rejects.toThrow(
        '请先上传至少一张参考图'
      )
    } finally {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('persists facts independently from the opinion draft', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vdw-facts-'))
    const db = new AppDatabase(join(dir, 'test.db'))
    const repos = new Repositories(db)
    try {
      const now = new Date().toISOString()
      repos.upsertProject({
        id: 'proj_facts',
        title: 'test',
        topic: 'test',
        draft: '想吐槽同质化',
        facts: '轴距 3000mm；发布会称这是家族最新灯语。',
        platform: 'B站',
        durationSeconds: 300,
        contentType: '新车热点',
        styleId: null,
        commercial: {
          enabled: false,
          brand: '',
          model: '',
          goal: '',
          sellingPoints: [],
          mustInclude: [],
          mustAvoid: [],
          placement: 'narrative',
          cta: ''
        },
        status: 'draft',
        createdAt: now,
        updatedAt: now
      })
      const stored = repos.getProject('proj_facts')
      expect(stored?.draft).toBe('想吐槽同质化')
      expect(stored?.facts).toContain('轴距 3000mm')
    } finally {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('style metadata', () => {
  it('updates category and name on an existing style', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vdw-style-'))
    const db = new AppDatabase(join(dir, 'test.db'))
    const repos = new Repositories(db)
    try {
      const created = repos.upsertStyle({
        id: 'style_1',
        name: '旧名称',
        platform: 'B站',
        category: '设计观点',
        notes: '',
        isDemo: false
      })
      const updated = repos.upsertStyle({
        ...created,
        name: '新名称',
        category: '车型解读',
        notes: '改过内容类型'
      })
      expect(updated.name).toBe('新名称')
      expect(updated.category).toBe('车型解读')
      expect(updated.notes).toBe('改过内容类型')
      expect(updated.createdAt).toBe(created.createdAt)
    } finally {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('replaces documents and clears extracted style dna', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vdw-style-docs-'))
    const db = new AppDatabase(join(dir, 'test.db'))
    const repos = new Repositories(db)
    try {
      repos.upsertStyle({
        id: 'style_2',
        name: '样本风格',
        platform: 'B站',
        category: '设计观点',
        notes: '',
        isDemo: false
      })
      repos.insertDocument({
        styleId: 'style_2',
        filename: 'old.txt',
        content: '旧样本',
        wordCount: 3,
        parseStatus: 'ok',
        parseError: null
      })
      repos.saveStyleProfile('style_2', mockStyleProfile())
      repos.deleteDocuments('style_2')
      repos.clearStyleExtracted('style_2')
      expect(repos.listDocuments('style_2')).toEqual([])
      expect(repos.getStyleProfile('style_2')).toBeNull()
    } finally {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('style ingest preview', () => {
  it('uses filename as author when the model left a placeholder name', () => {
    const profile = mockStyleProfile()
    profile.creator.name = '未命名创作者'
    const preview = buildStylePreview(
      { profile, templates: mockTemplates(), examples: mockExamples() },
      { filename: '博主口播.txt', wordCount: 1200 }
    )
    expect(preview.author).toBe('博主口播')
    expect(preview.sourceFilename).toBe('博主口播.txt')
    expect(preview.category).toBe('车型解读')
    expect(preview.notes.length).toBeLessThanOrEqual(STYLE_NOTES_LIMIT)
    expect(preview.notes).toBe('口语拆前脸配方')
  })

  it('uses the card content-type tag instead of template names', () => {
    const preview = buildStylePreview(
      {
        profile: mockStyleProfile(),
        templates: mockTemplates(),
        examples: mockExamples(),
        category: '设计知识'
      },
      { filename: '圆方形.txt', wordCount: 800 }
    )
    expect(preview.category).toBe('设计知识')
    expect(pickContentType([{ contentType: '车型解读', topic: '圆方三角' }])).toBe('车型解读')
  })

  it('keeps preview jobs out of the creation catalog until they become a style with DNA', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vdw-ingest-'))
    const db = new AppDatabase(join(dir, 'test.db'))
    const repos = new Repositories(db)
    try {
      const job = repos.insertIngestJob({
        filename: 'sample.txt',
        content: '这篇口播在讲灯组图形。',
        wordCount: 12,
        parseStatus: 'ok',
        parseError: null,
        status: 'queued'
      })
      expect(job.status).toBe('queued')
      expect(repos.listCatalogStyles()).toEqual([])
      const preview = buildStylePreview(
        { profile: mockStyleProfile(), templates: mockTemplates(), examples: mockExamples() },
        { filename: job.filename, wordCount: job.wordCount }
      )
      repos.updateIngestJobStatus(job.id, 'completed', {
        preview,
        progressPercent: 100,
        progressMessage: '预览卡已完成，等待确认入库'
      })
      expect(repos.getIngestJob(job.id)?.preview?.author).toContain('演示创作者')
      expect(repos.listCatalogStyles()).toEqual([])

      repos.upsertStyle({
        id: 'style_ingested',
        name: `${preview.author} · ${preview.category}`,
        platform: preview.platform || 'B站',
        category: preview.category,
        notes: '',
        isDemo: false
      })
      repos.saveStyleProfile('style_ingested', preview.profile)
      repos.replaceTemplates('style_ingested', preview.templates)
      repos.updateIngestJobStatus(job.id, 'ingested', { styleId: 'style_ingested' })
      expect(repos.listCatalogStyles().some((item) => item.id === 'style_ingested')).toBe(true)
      expect(repos.listCatalogStyles()[0]?.notes).toBe('口语拆前脸配方')
      expect(repos.getIngestJobContent(job.id)).toContain('灯组图形')
    } finally {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('style notes', () => {
  it('clips extracted notes to 20 characters and prefers a clause break', () => {
    expect(clipStyleNotes('口语拆前脸配方')).toBe('口语拆前脸配方')
    expect(clipStyleNotes('口语讲灯组细节，再落到肩线记忆点上')).toBe('口语讲灯组细节')
    expect(clipStyleNotes('口'.repeat(25))).toBe('口'.repeat(STYLE_NOTES_LIMIT))
  })

  it('derives a short blurb from Style DNA when the model omitted notes', () => {
    const profile = mockStyleProfile()
    profile.creator.notes = ''
    profile.creator.description = '口语讲灯组细节，再用肩线收判断。'
    expect(deriveStyleNotes(profile)).toBe('口语讲灯组细节')
  })
})

describe('agent style select', () => {
  it('treats empty styleId as a neutral fallback', () => {
    expect(StyleSelectSchema.parse({ styleId: 'none', reason: '不合适' }).styleId).toBe('')
    expect(TemplateMatchSchema.parse({ templateName: '车型解读', reason: '匹配', styleId: null, styleName: '中性结构' }).styleName).toBe(
      '中性结构'
    )
  })

  it('allows PFDBI without reference images', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vdw-pfdbi-empty-'))
    const db = new AppDatabase(join(dir, 'test.db'))
    const repos = new Repositories(db)
    try {
      const now = new Date().toISOString()
      repos.upsertProject({
        id: 'proj_noimg',
        title: '无图项目',
        topic: '只谈设计史',
        draft: '',
        facts: '',
        platform: 'B站',
        durationSeconds: 180,
        contentType: '设计知识',
        styleId: null,
        commercial: {
          enabled: false,
          brand: '',
          model: '',
          goal: '',
          sellingPoints: [],
          mustInclude: [],
          mustAvoid: [],
          placement: 'narrative',
          cta: ''
        },
        status: 'draft',
        createdAt: now,
        updatedAt: now
      })
      const provider = new MockLLMProvider()
      const router = new ModelRouter({ textModel: 'mock-text', visionModel: 'mock-vision' })
      await runPfdbiAnalysis('proj_noimg', { repos, provider, router })
      expect(repos.getPfdbi('proj_noimg')?.coreConclusion).toContain('没有参考图')
    } finally {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('picks an ingested style card when the author did not override', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vdw-style-select-'))
    const db = new AppDatabase(join(dir, 'test.db'))
    const repos = new Repositories(db)
    try {
      const now = new Date().toISOString()
      repos.upsertStyle({
        id: 'style_pick',
        name: '入库卡 · 车型解读',
        platform: 'B站',
        category: '车型解读',
        notes: '',
        isDemo: false
      })
      repos.saveStyleProfile('style_pick', mockStyleProfile())
      repos.replaceTemplates('style_pick', mockTemplates())
      repos.replaceExamples('style_pick', mockExamples())
      repos.upsertProject({
        id: 'proj_pick',
        title: '选卡',
        topic: '前脸为什么越来越像',
        draft: '',
        facts: '轴距 3000mm',
        platform: 'B站',
        durationSeconds: 180,
        contentType: '车型解读',
        styleId: null,
        commercial: {
          enabled: false,
          brand: '',
          model: '',
          goal: '',
          sellingPoints: [],
          mustInclude: [],
          mustAvoid: [],
          placement: 'narrative',
          cta: ''
        },
        status: 'draft',
        createdAt: now,
        updatedAt: now
      })
      repos.savePfdbi('proj_pick', mockPfdbi(), 'cache_pick')
      const provider = new MockLLMProvider()
      const router = new ModelRouter({ textModel: 'mock-text', visionModel: 'mock-vision' })
      await runDraftGeneration('proj_pick', { repos, provider, router })
      const match = repos.getScript<{ styleId?: string | null; styleName?: string }>('proj_pick', 'match')
      expect(match?.styleId).toBe('style_pick')
      expect(match?.styleName).toContain('入库卡')
    } finally {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('copy word count', () => {
  it('counts chinese characters and latin words', () => {
    expect(countCopyWords('姿态很好 design language')).toBe(6)
    expect(countCopyWords('')).toBe(0)
  })

  it('uses 250 words per minute for duration targets', () => {
    expect(WORDS_PER_MINUTE).toBe(250)
    expect(DEFAULT_DURATION.wordsPerMinute).toBe(250)
  })
})

describe('human pfdbi notes', () => {
  it('writes judgements back into each PFDBI dimension', () => {
    const analysis = pfdbiFromNotes(
      '前脸为什么越来越像',
      {
        P: '姿态更低、更宽',
        F: '',
        D: '灯组收得更紧',
        B: '',
        I: ''
      },
      null
    )
    expect(analysis.P.judgement).toBe('姿态更低、更宽')
    expect(analysis.P.applicable).toBe(true)
    expect(analysis.F.applicable).toBe(false)
    expect(analysis.D.observations).toEqual(['灯组收得更紧'])
    expect(notesFromPfdbi(analysis).P).toBe('姿态更低、更宽')
    expect(notesFromPfdbi(analysis).D).toBe('灯组收得更紧')
  })
})

