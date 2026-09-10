import { CONTENT_TYPES } from '@shared/constants'
import type { ExampleCase, StructureSection, StructureTemplate } from '@schemas/style'

const MISSING_TEXT = '样本中未体现'
const PLACEHOLDER_TEMPLATE = new Set(['未命名模板', '未命名', '未指定', ''])
const PLACEHOLDER_SECTION = new Set(['未命名段落', '未命名', ''])

/**
 * 清洗结构模板：补名称、去掉完全重复的条目，避免宽松解析留下一堆「未命名模板」。
 */
export function normalizeTemplates(templates: StructureTemplate[]): StructureTemplate[] {
  const unique: StructureTemplate[] = []
  const seenExact = new Set<string>()
  for (const template of templates) {
    const sections = hydrateSections(dedupeSections(template.sections))
    const named: StructureTemplate = {
      ...template,
      templateName: deriveTemplateName({ ...template, sections }),
      sections
    }
    const fingerprint = [
      named.templateName,
      named.scenario,
      sectionSignature(named.sections)
    ].join('::')
    if (seenExact.has(fingerprint)) continue
    seenExact.add(fingerprint)
    unique.push(named)
  }

  const kept: StructureTemplate[] = []
  const unnamedSectionSeen = new Set<string>()
  for (const template of unique) {
    const placeholder = PLACEHOLDER_TEMPLATE.has(template.templateName)
    if (placeholder) {
      const signature = sectionSignature(template.sections)
      if (unnamedSectionSeen.has(signature)) continue
      unnamedSectionSeen.add(signature)
    }
    if (!isUsefulTemplate(template)) continue
    kept.push(template)
  }
  return kept.slice(0, 8)
}

/**
 * 清洗 few-shot：丢掉空摘录和重复片段，并尽量对齐到真实文档 id。
 */
export function normalizeExamples(
  examples: ExampleCase[],
  documentIds: string[]
): ExampleCase[] {
  const knownIds = new Set(documentIds)
  const seen = new Set<string>()
  const result: ExampleCase[] = []
  for (const example of examples) {
    const excerpt = example.excerpt.trim()
    if (!excerpt || excerpt === MISSING_TEXT) continue
    const key = excerpt.slice(0, 120)
    if (seen.has(key)) continue
    seen.add(key)
    let sourceDocumentId = example.sourceDocumentId.trim()
    if (sourceDocumentId && !knownIds.has(sourceDocumentId)) {
      sourceDocumentId = documentIds.length === 1 ? documentIds[0] : ''
    }
    result.push({
      ...example,
      excerpt,
      sourceDocumentId,
      scenario: example.scenario.trim() || MISSING_TEXT,
      structure: example.structure.trim() || MISSING_TEXT,
      whyRepresentative: example.whyRepresentative.trim() || MISSING_TEXT
    })
  }
  return result.slice(0, 8)
}

/**
 * 用适用类型或场景给还没名字的模板补一个能看懂的标题。
 */
function deriveTemplateName(template: StructureTemplate): string {
  const current = template.templateName.trim()
  if (!PLACEHOLDER_TEMPLATE.has(current)) return current
  const topic = template.applicableTopics.find((item) => item.trim())
  if (topic) return `${topic.trim()}结构`
  const hit = CONTENT_TYPES.find((type) => template.scenario.includes(type))
  if (hit) return `${hit}结构`
  const scenario = template.scenario.trim()
  if (scenario && scenario !== MISSING_TEXT) {
    return scenario.length > 18 ? `${scenario.slice(0, 18)}…` : scenario
  }
  return current || '未命名模板'
}

/**
 * 段落名仍是占位时，退回用目的、写法或序号。
 */
function hydrateSections(sections: StructureSection[]): StructureSection[] {
  return sections.map((section, index) => {
    const name = section.name.trim() || '未命名段落'
    if (!PLACEHOLDER_SECTION.has(name)) return { ...section, name }
    if (section.purpose && section.purpose !== MISSING_TEXT) {
      return { ...section, name: clipLabel(section.purpose) }
    }
    if (section.instruction && section.instruction !== MISSING_TEXT) {
      return { ...section, name: clipLabel(section.instruction) }
    }
    return { ...section, name: `段落 ${index + 1}` }
  })
}

/**
 * 去掉名称、目的、写法完全相同的连续段落。
 */
function dedupeSections(sections: StructureSection[]): StructureSection[] {
  const seen = new Set<string>()
  const result: StructureSection[] = []
  for (const section of sections) {
    const key = `${section.name}|${section.purpose}|${section.instruction}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(section)
  }
  return result
}

function sectionSignature(sections: StructureSection[]): string {
  return sections
    .map((section) => `${section.name}|${section.purpose}|${Math.round(section.timePercent * 100)}`)
    .join('||')
}

function isUsefulTemplate(template: StructureTemplate): boolean {
  if (!PLACEHOLDER_TEMPLATE.has(template.templateName)) return true
  if (template.scenario && template.scenario !== MISSING_TEXT) return true
  return template.sections.some(
    (section) =>
      !PLACEHOLDER_SECTION.has(section.name) ||
      (section.purpose && section.purpose !== MISSING_TEXT) ||
      (section.instruction && section.instruction !== MISSING_TEXT)
  )
}

function clipLabel(text: string): string {
  const trimmed = text.trim()
  return trimmed.length > 12 ? `${trimmed.slice(0, 12)}…` : trimmed
}
