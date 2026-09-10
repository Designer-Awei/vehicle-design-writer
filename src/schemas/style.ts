import { z } from 'zod'
import { ScoreSchema, StringArraySchema } from './common'

const MissingText = '样本中未体现'

/**
 * 模型有时把结果包在同名键里，这里拆到内层对象。
 */
function unwrapNamedObject(value: unknown, keys: string[]): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const record = value as Record<string, unknown>
  for (const key of keys) {
    const inner = record[key]
    if (inner && typeof inner === 'object') return inner
  }
  return value
}

const CreatorSchema = z
  .object({
    name: z.string().catch('未命名创作者'),
    platform: z.string().catch('未知平台'),
    description: z.string().catch(MissingText)
  })
  .catch({
    name: '未命名创作者',
    platform: '未知平台',
    description: MissingText
  })

const ToneSchema = z
  .object({
    professionalism: ScoreSchema,
    emotion: ScoreSchema,
    humor: ScoreSchema,
    sarcasm: ScoreSchema,
    warmth: ScoreSchema,
    aggressiveness: ScoreSchema
  })
  .catch({
    professionalism: 0.5,
    emotion: 0.5,
    humor: 0.5,
    sarcasm: 0.5,
    warmth: 0.5,
    aggressiveness: 0.5
  })

const LanguageSchema = z
  .object({
    sentenceLength: z.string().catch(MissingText),
    rhythm: z.string().catch(MissingText),
    vocabularyDensity: z.string().catch(MissingText),
    technicalTermDensity: z.string().catch(MissingText),
    metaphorFrequency: z.string().catch(MissingText),
    colloquialism: z.string().catch(MissingText),
    firstPersonUsage: z.string().catch(MissingText),
    secondPersonUsage: z.string().catch(MissingText)
  })
  .catch({
    sentenceLength: MissingText,
    rhythm: MissingText,
    vocabularyDensity: MissingText,
    technicalTermDensity: MissingText,
    metaphorFrequency: MissingText,
    colloquialism: MissingText,
    firstPersonUsage: MissingText,
    secondPersonUsage: MissingText
  })

const ArgumentationSchema = z
  .object({
    opinionVsFact: z.string().catch(MissingText),
    opinionPosition: z.string().catch(MissingText),
    evidenceUsage: z.string().catch(MissingText),
    comparisonFrequency: z.string().catch(MissingText),
    counterArgumentUsage: z.string().catch(MissingText),
    reversalFrequency: z.string().catch(MissingText)
  })
  .catch({
    opinionVsFact: MissingText,
    opinionPosition: MissingText,
    evidenceUsage: MissingText,
    comparisonFrequency: MissingText,
    counterArgumentUsage: MissingText,
    reversalFrequency: MissingText
  })

const RhetoricSchema = z
  .object({
    hookPatterns: StringArraySchema,
    transitionPatterns: StringArraySchema,
    reversalPatterns: StringArraySchema,
    analogyPatterns: StringArraySchema,
    endingPatterns: StringArraySchema,
    ctaPatterns: StringArraySchema
  })
  .catch({
    hookPatterns: [],
    transitionPatterns: [],
    reversalPatterns: [],
    analogyPatterns: [],
    endingPatterns: [],
    ctaPatterns: []
  })

const AutomotiveDesignSchema = z
  .object({
    proportionAnalysis: z.string().catch(MissingText),
    formAnalysis: z.string().catch(MissingText),
    detailAnalysis: z.string().catch(MissingText),
    brandAnalysis: z.string().catch(MissingText),
    innovationAnalysis: z.string().catch(MissingText)
  })
  .catch({
    proportionAnalysis: MissingText,
    formAnalysis: MissingText,
    detailAnalysis: MissingText,
    brandAnalysis: MissingText,
    innovationAnalysis: MissingText
  })

const CommercialSchema = z
  .object({
    sponsoredStyle: z.string().catch(MissingText),
    integrationPatterns: StringArraySchema,
    brandMentionTiming: z.string().catch(MissingText),
    ctaStyle: z.string().catch(MissingText)
  })
  .catch({
    sponsoredStyle: MissingText,
    integrationPatterns: [],
    brandMentionTiming: MissingText,
    ctaStyle: MissingText
  })

const EvidenceReferencesSchema = z
  .array(
    z.object({
      feature: z.string().catch('未命名特征'),
      evidenceReferences: StringArraySchema
    })
  )
  .catch([])

export const StyleProfileSchema = z.preprocess(
  (value) => unwrapNamedObject(value, ['StyleProfile', 'profile', 'styleProfile']),
  z.object({
    creator: CreatorSchema,
    tone: ToneSchema,
    language: LanguageSchema,
    argumentation: ArgumentationSchema,
    rhetoric: RhetoricSchema,
    automotiveDesign: AutomotiveDesignSchema,
    commercial: CommercialSchema,
    signaturePatterns: StringArraySchema,
    avoidPatterns: StringArraySchema,
    evidenceReferences: EvidenceReferencesSchema
  })
)

/** 人设与语气切片，供并行提取。 */
export const StyleCreatorToneSliceSchema = z.object({
  creator: CreatorSchema,
  tone: ToneSchema
})

/** 语言特征切片。 */
export const StyleLanguageSliceSchema = z.object({
  language: LanguageSchema
})

/** 论证方式切片。 */
export const StyleArgumentationSliceSchema = z.object({
  argumentation: ArgumentationSchema
})

/** 修辞套路切片。 */
export const StyleRhetoricSliceSchema = z.object({
  rhetoric: RhetoricSchema
})

/** 汽车设计表达切片。 */
export const StyleAutomotiveSliceSchema = z.object({
  automotiveDesign: AutomotiveDesignSchema
})

/** 商业表达与签名特征切片。 */
export const StyleCommercialSliceSchema = z.object({
  commercial: CommercialSchema,
  signaturePatterns: StringArraySchema,
  avoidPatterns: StringArraySchema,
  evidenceReferences: EvidenceReferencesSchema
})

const UnitIntervalSchema = ScoreSchema

const TEMPLATE_NAME_KEYS = [
  'templateName',
  'name',
  'title',
  'label',
  '模板名',
  '模板名称',
  '名称',
  '标题'
]
const TEMPLATE_SCENARIO_KEYS = ['scenario', 'useCase', 'description', 'summary', '场景', '适用场景', '用途']
const TEMPLATE_DURATION_KEYS = ['durationRange', 'duration', 'length', '时长', '时长范围']
const TEMPLATE_TOPIC_KEYS = ['applicableTopics', 'topics', 'contentTypes', '适用类型', '适用主题']
const TEMPLATE_SECTION_KEYS = ['sections', 'paragraphs', '段落']
const SECTION_NAME_KEYS = ['name', 'title', 'heading', 'sectionName', '段落名', '段落名称', '名称', '标题', '环节']
const SECTION_PURPOSE_KEYS = ['purpose', 'goal', 'role', '目的', '作用', '功能', '意图']
const SECTION_INSTRUCTION_KEYS = [
  'instruction',
  'how',
  'prompt',
  'guidance',
  '写法',
  '要求',
  '指导',
  '写法说明',
  '说明'
]
const SECTION_TIME_KEYS = [
  'timePercent',
  'percent',
  'share',
  'weight',
  'duration',
  'time',
  '时长',
  '占比',
  '比例',
  '时间占比'
]
const EXAMPLE_ID_KEYS = ['sourceDocumentId', 'documentId', 'docId', 'source', '文档id', '文档ID']
const EXAMPLE_SCENARIO_KEYS = ['scenario', 'contentType', 'topic', '场景', '类型']
const EXAMPLE_STRUCTURE_KEYS = ['structure', 'pattern', 'outline', '结构', '结构模式']
const EXAMPLE_EXCERPT_KEYS = ['excerpt', 'text', 'quote', 'content', '片段', '原文', '摘录', '引用']
const EXAMPLE_WHY_KEYS = ['whyRepresentative', 'why', 'reason', 'note', '原因', '代表性', '说明']

/**
 * 把对象当成字典读取；数组和空值返回 null。
 */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * 按候选键取出第一段非空字符串。
 */
function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

/**
 * 按候选键取出第一个非空值。
 */
function pickUnknown(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] != null) return record[key]
  }
  return undefined
}

/**
 * 数组直接返回；对象则把键当成 name 收成列表。
 */
function asNamedList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const record = asRecord(value)
  if (!record) return []
  return Object.entries(record).map(([key, item]) => {
    const inner = asRecord(item)
    if (!inner) return item
    return pickString(inner, SECTION_NAME_KEYS) ? inner : { ...inner, name: key }
  })
}

/**
 * 把模型常用的段落别名字段收成 schema 字段。
 */
function coerceSection(value: unknown): unknown {
  const record = asRecord(value)
  if (!record) return value
  const timePercent = pickUnknown(record, SECTION_TIME_KEYS)
  return {
    ...record,
    name: pickString(record, SECTION_NAME_KEYS) ?? record.name,
    purpose: pickString(record, SECTION_PURPOSE_KEYS) ?? record.purpose,
    instruction: pickString(record, SECTION_INSTRUCTION_KEYS) ?? record.instruction,
    timePercent: timePercent ?? record.timePercent
  }
}

/**
 * 把模型常用的模板别名字段收成 schema 字段。
 */
function coerceTemplate(value: unknown, fallbackName?: string): unknown {
  const record = asRecord(value)
  if (!record) return value
  const sectionsRaw = pickUnknown(record, TEMPLATE_SECTION_KEYS)
  const structure = record.structure
  const sections =
    sectionsRaw != null
      ? asNamedList(sectionsRaw)
      : Array.isArray(structure) || asRecord(structure)
        ? asNamedList(structure)
        : record.sections
  return {
    ...record,
    templateName: pickString(record, TEMPLATE_NAME_KEYS) ?? fallbackName ?? record.templateName,
    scenario: pickString(record, TEMPLATE_SCENARIO_KEYS) ?? record.scenario,
    durationRange: pickString(record, TEMPLATE_DURATION_KEYS) ?? record.durationRange,
    applicableTopics: pickUnknown(record, TEMPLATE_TOPIC_KEYS) ?? record.applicableTopics,
    sections
  }
}

/**
 * 把模板包收成 `{ templates: unknown[] }`，兼容数组、中文键和按名称分列的对象。
 */
function coerceTemplateBundle(value: unknown): unknown {
  if (Array.isArray(value)) return { templates: value }
  const unwrapped = unwrapNamedObject(value, ['TemplateBundle', 'templateBundle', 'result'])
  const record = asRecord(unwrapped)
  if (!record) return value
  const nested = pickUnknown(record, ['templates', 'structureTemplates', 'items', '模板', '结构模板'])
  if (Array.isArray(nested)) return { templates: nested }
  if (asRecord(nested)) {
    return { templates: objectMapToTemplates(nested as Record<string, unknown>) }
  }
  const mapped = objectMapToTemplates(record)
  if (mapped.length > 0) return { templates: mapped }
  if (looksLikeTemplate(record)) return { templates: [record] }
  return record
}

/**
 * 判断对象是不是单份结构模板，而不是模板列表。
 */
function looksLikeTemplate(record: Record<string, unknown>): boolean {
  return (
    record.sections != null ||
    record.paragraphs != null ||
    record.段落 != null ||
    record.templateName != null ||
    record.模板名称 != null
  )
}

/**
 * 把 `{ 车型解读: { sections: ... } }` 这种按名称分列的对象收成模板列表。
 */
function objectMapToTemplates(record: Record<string, unknown>): unknown[] {
  const skip = new Set([
    'templates',
    'structureTemplates',
    'items',
    'creator',
    'tone',
    'language',
    'TemplateBundle'
  ])
  return Object.entries(record)
    .filter(([key, item]) => {
      if (skip.has(key)) return false
      const inner = asRecord(item)
      return Boolean(
        inner &&
          (inner.sections != null ||
            inner.paragraphs != null ||
            inner.段落 != null ||
            inner.scenario != null ||
            inner.场景 != null)
      )
    })
    .map(([name, item]) => coerceTemplate(item, name))
}

/**
 * 把 few-shot 条目的别名字段收成 schema 字段。
 */
function coerceExample(value: unknown): unknown {
  const record = asRecord(value)
  if (!record) return value
  return {
    ...record,
    sourceDocumentId: pickString(record, EXAMPLE_ID_KEYS) ?? record.sourceDocumentId,
    scenario: pickString(record, EXAMPLE_SCENARIO_KEYS) ?? record.scenario,
    structure: pickString(record, EXAMPLE_STRUCTURE_KEYS) ?? record.structure,
    excerpt: pickString(record, EXAMPLE_EXCERPT_KEYS) ?? record.excerpt,
    whyRepresentative: pickString(record, EXAMPLE_WHY_KEYS) ?? record.whyRepresentative
  }
}

/**
 * 把例子包收成 `{ examples: unknown[] }`。
 */
function coerceExampleBundle(value: unknown): unknown {
  if (Array.isArray(value)) return { examples: value }
  const unwrapped = unwrapNamedObject(value, ['ExampleBundle', 'exampleBundle', 'result'])
  const record = asRecord(unwrapped)
  if (!record) return value
  const nested = pickUnknown(record, ['examples', 'fewshot', 'fewShots', 'cases', '例子', '片段'])
  if (Array.isArray(nested)) return { examples: nested }
  if (looksLikeExample(record)) return { examples: [record] }
  return record
}

/**
 * 判断对象是不是单条 few-shot，而不是例子列表。
 */
function looksLikeExample(record: Record<string, unknown>): boolean {
  return (
    record.excerpt != null ||
    record.原文 != null ||
    record.摘录 != null ||
    record.quote != null ||
    typeof record.片段 === 'string'
  )
}

export const StructureSectionSchema = z.preprocess(
  coerceSection,
  z.object({
    name: z.string().catch('未命名段落'),
    timePercent: UnitIntervalSchema,
    purpose: z.string().catch(MissingText),
    instruction: z.string().catch(MissingText)
  })
)

export const StructureTemplateSchema = z.preprocess(
  (value) => coerceTemplate(value),
  z.object({
    templateName: z.string().catch('未命名模板'),
    scenario: z.string().catch(MissingText),
    applicableTopics: StringArraySchema,
    durationRange: z.string().catch('未指定'),
    sections: z.array(StructureSectionSchema).catch([])
  })
)

export const ExampleCaseSchema = z.preprocess(
  coerceExample,
  z.object({
    sourceDocumentId: z.string().catch(''),
    scenario: z.string().catch(MissingText),
    structure: z.string().catch(MissingText),
    excerpt: z.string().catch(''),
    whyRepresentative: z.string().catch(MissingText)
  })
)

export const TemplateBundleSchema = z.preprocess(
  coerceTemplateBundle,
  z.object({ templates: z.array(StructureTemplateSchema).catch([]) })
)

export const ExampleBundleSchema = z.preprocess(
  coerceExampleBundle,
  z.object({ examples: z.array(ExampleCaseSchema).catch([]) })
)

export const DocumentAnalysisSchema = z.preprocess(
  (value) => unwrapNamedObject(value, ['DocumentAnalysis', 'analysis']),
  z.object({
    documentId: z.string().catch(''),
    topic: z.string().catch('主题待归纳'),
    structure: StringArraySchema,
    languageTraits: StringArraySchema,
    argumentationTraits: StringArraySchema,
    signatureLines: StringArraySchema,
    designKnowledgeVsStyle: z.string().catch('样本中未明确区分设计知识与个人风格。')
  })
)

/**
 * 单份结构模板；模型有时仍包在 templates 数组里。
 */
export const SingleTemplateSchema = z.preprocess((value) => {
  if (Array.isArray(value)) return value[0]
  const record = asRecord(value)
  if (!record) return value
  if (Array.isArray(record.templates)) return record.templates[0]
  if (record.template && typeof record.template === 'object') return record.template
  return value
}, StructureTemplateSchema)

export type StyleProfile = z.infer<typeof StyleProfileSchema>
export type StyleCreatorToneSlice = z.infer<typeof StyleCreatorToneSliceSchema>
export type StyleLanguageSlice = z.infer<typeof StyleLanguageSliceSchema>
export type StyleArgumentationSlice = z.infer<typeof StyleArgumentationSliceSchema>
export type StyleRhetoricSlice = z.infer<typeof StyleRhetoricSliceSchema>
export type StyleAutomotiveSlice = z.infer<typeof StyleAutomotiveSliceSchema>
export type StyleCommercialSlice = z.infer<typeof StyleCommercialSliceSchema>
export type StructureSection = z.infer<typeof StructureSectionSchema>
export type StructureTemplate = z.infer<typeof StructureTemplateSchema>
export type ExampleCase = z.infer<typeof ExampleCaseSchema>
export type DocumentAnalysis = z.infer<typeof DocumentAnalysisSchema>
