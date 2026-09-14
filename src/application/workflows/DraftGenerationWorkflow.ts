import { DEFAULT_DURATION, estimateDuration } from '@application/duration'
import { parseModelJson } from '@application/json-parse'
import { ModelRouter } from '@application/model-router'
import type { Repositories } from '@infrastructure/db/repositories'
import { hashText } from '@infrastructure/filesystem/document-parser'
import { toDataUrl } from '@infrastructure/filesystem/image-store'
import type { LLMProvider } from '@infrastructure/llm/types'
import {
  PFDBIAnalysisSchema,
  QualityReportSchema,
  RewriteSchema,
  ScriptSchema,
  TemplateMatchSchema,
  StyleSelectSchema,
  VisionObservationSchema,
  type CommercialBrief,
  type DurationProfile,
  type ImageAnnotation,
  type PlatformProfile,
  type QualityReport,
  type ScriptDraft,
  type TemplateMatch,
  type PFDBIAnalysis
} from '@schemas/index'
import { FACTS_PROMPT_LIMIT, PROMPT_VERSION } from '@shared/constants'
import type { ProjectRecord, WorkflowProgress } from '@shared/ipc'
import {
  baseDraftPrompt,
  pfdbiAnalysisPrompt,
  scriptQualityPrompt,
  styleAdapterPrompt,
  styleSelectPrompt,
  templateMatchPrompt,
  visionObservationRepairInstruction,
  visionObservationPrompt,
  rewritePrompt
} from '@prompts/index'

export interface DraftContext {
  repos: Repositories
  provider: LLMProvider
  router: ModelRouter
  onProgress?: (progress: WorkflowProgress) => void
}

/**
 * 对当前项目的全部参考图执行视觉观察。
 */
export async function runVisionAnalysis(projectId: string, ctx: DraftContext): Promise<void> {
  const project = ctx.repos.getProject(projectId)
  if (!project) throw new Error('项目不存在')
  const images = ctx.repos.listImages(projectId)
  if (images.length === 0) {
    throw new Error('请先上传至少一张参考图')
  }
  const report = (stage: string, message: string, percent: number): void => {
    ctx.onProgress?.({ projectId, stage, message, percent })
  }
  const visionModel = ctx.router.select('vision')
  const textModel = ctx.router.select('json')
  for (const [index, image] of images.entries()) {
    report(
      'vision',
      `视觉观察 ${index + 1}/${Math.max(images.length, 1)}`,
      5 + Math.round((index / Math.max(images.length, 1)) * 90)
    )
    const annotations = ctx.repos.listAnnotations(image.id)
    const metadata = {
      role: image.role,
      vehicleLabel: image.vehicleLabel,
      comparisonNote: image.comparisonNote
    }
    const cacheKey = `${image.id}:${image.hash}:${visionModel}:${PROMPT_VERSION}:${hashText(
      JSON.stringify({ annotations, metadata })
    )}`
    const cached = ctx.repos.getVisionByCache(cacheKey)
    if (cached) continue
    const prompt = visionObservationPrompt({
      imageId: image.id,
      annotations: formatAnnotations(annotations),
      role: image.role,
      vehicleLabel: image.vehicleLabel,
      comparisonNote: image.comparisonNote
    })
    const dataUrl = toDataUrl(image.path)
    const response = await ctx.provider.chat(
      {
        task: 'vision',
        capability: 'vision',
        json: true,
        messages: [
          { role: 'system', content: prompt.system },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt.user },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ]
      },
      visionModel
    )
    ctx.repos.addUsage({ projectId, task: 'vision', model: response.model, ...usageOf(response) })
    const observation = await parseModelJson(
      response.text,
      VisionObservationSchema,
      ctx.provider,
      textModel,
      visionObservationRepairInstruction(image.id)
    )
    observation.imageId = image.id
    ctx.repos.saveVision(projectId, image.id, observation, cacheKey)
  }
  ctx.repos.clearFromPfdbi(projectId)
  report('vision', '全部参考图视觉观察完成', 100)
}

/**
 * 无参考图时仍可生成 PFDBI，但必须声明证据不足，不得编造看见的型面。
 */
export async function runPfdbiAnalysis(projectId: string, ctx: DraftContext): Promise<void> {
  const project = ctx.repos.getProject(projectId)
  if (!project) throw new Error('项目不存在')
  const images = ctx.repos.listImages(projectId)
  const observations = ctx.repos.listVision(projectId)
  const observedIds = new Set(observations.map((item) => item.imageId))
  if (images.length > 0 && images.some((image) => !observedIds.has(image.id))) {
    throw new Error('请先完成全部参考图的视觉观察')
  }
  const textModel = ctx.router.select('json')
  const evidence =
    images.length === 0
      ? []
      : images.map((image) => ({
          imageId: image.id,
          role: image.role,
          vehicleLabel: image.vehicleLabel || '未填写车型标签',
          comparisonNote: image.comparisonNote,
          observation: observations.find((item) => item.imageId === image.id)
        }))
  ctx.onProgress?.({ projectId, stage: 'pfdbi', message: 'PFDBI 设计评价分析', percent: 20 })
  const pfdbiKey = hashText(
    `${project.topic}|${JSON.stringify(evidence)}|${textModel}|${PROMPT_VERSION}`
  )
  let pfdbi = ctx.repos.getPfdbiByCache(pfdbiKey)
  if (!pfdbi) {
    const prompt = pfdbiAnalysisPrompt({
      topic: project.topic,
      draft: '',
      vision:
        images.length === 0
          ? '没有参考图和视觉观察。不得编造看见的型面、灯组、比例。必须声明证据不足。'
          : JSON.stringify(evidence),
      extras: JSON.stringify({
        commercial: project.commercial,
        facts: project.facts
      })
    })
    const response = await ctx.provider.chat(
      {
        task: 'pfdbi',
        capability: 'json',
        json: true,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ]
      },
      textModel
    )
    ctx.repos.addUsage({ projectId, task: 'pfdbi', model: response.model, ...usageOf(response) })
    pfdbi = await parseModelJson(response.text, PFDBIAnalysisSchema, ctx.provider, textModel)
    ctx.repos.savePfdbi(projectId, pfdbi, pfdbiKey)
  }
  ctx.repos.clearDrafts(projectId)
  ctx.onProgress?.({ projectId, stage: 'pfdbi', message: 'PFDBI 评价完成', percent: 100 })
}

/**
 * PFDBI → Base Draft → 模板匹配 → Style Adapter → 质检。禁止一步生成终稿。
 */
export async function runDraftGeneration(projectId: string, ctx: DraftContext): Promise<void> {
  const project = ctx.repos.getProject(projectId)
  if (!project) throw new Error('项目不存在')
  const pfdbi = ctx.repos.getPfdbi(projectId)
  if (!pfdbi) throw new Error('请先完成 PFDBI 评价')
  const textModel = ctx.router.select('json')
  const report = (stage: string, message: string, percent: number): void => {
    ctx.onProgress?.({ projectId, stage, message, percent })
  }
  const duration = ctx.repos.listDurations()[0] ?? DEFAULT_DURATION
  report('base_draft', '生成 Base Draft（不模仿博主）', 12)
  const basePrompt = baseDraftPrompt({
    topic: project.topic,
    draft: project.draft,
    facts: project.facts.slice(0, FACTS_PROMPT_LIMIT),
    durationSeconds: project.durationSeconds,
    platform: project.platform,
    pfdbi: JSON.stringify(pfdbi),
    wordsPerMinute: duration.wordsPerMinute
  })
  const baseRes = await ctx.provider.chat(
    {
      task: 'base_draft',
      capability: 'json',
      json: true,
      messages: [
        { role: 'system', content: basePrompt.system },
        { role: 'user', content: basePrompt.user }
      ]
    },
    textModel
  )
  ctx.repos.addUsage({ projectId, task: 'base_draft', model: baseRes.model, ...usageOf(baseRes) })
  const baseDraft = await parseModelJson(baseRes.text, ScriptSchema, ctx.provider, textModel)
  ctx.repos.saveScript(projectId, 'base', baseDraft)
  ctx.repos.addVersion(projectId, 'V Base Draft', baseDraft.script)

  report('style_select', '选择风格卡', 32)
  const selected = await selectStyleCard(project, pfdbi, ctx, textModel)
  const templates = selected.styleId ? ctx.repos.listTemplates(selected.styleId) : []
  const profile = selected.styleId ? ctx.repos.getStyleProfile(selected.styleId) : null
  const examples = selected.styleId ? ctx.repos.listExamples(selected.styleId) : []
  const platforms = ctx.repos.listPlatforms()
  const platform = platforms.find((item) => item.platform === project.platform)

  report('template', '读取结构模板', 42)
  let match: TemplateMatch = {
    templateName: templates[0]?.templateName ?? '默认线性结构',
    reason: selected.reason,
    styleId: selected.styleId,
    styleName: selected.styleName
  }
  if (templates.length > 1) {
    const prompt = templateMatchPrompt({
      topic: project.topic,
      contentType: project.contentType,
      templates: JSON.stringify(
        templates.map((item) => ({
          name: item.templateName,
          scenario: item.scenario,
          topics: item.applicableTopics
        }))
      )
    })
    const matchRes = await ctx.provider.chat(
      {
        task: 'template_match',
        capability: 'json',
        json: true,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ]
      },
      textModel
    )
    ctx.repos.addUsage({
      projectId,
      task: 'template_match',
      model: matchRes.model,
      ...usageOf(matchRes)
    })
    const templateMatch = await parseModelJson(
      matchRes.text,
      TemplateMatchSchema,
      ctx.provider,
      textModel
    )
    match = {
      templateName: templateMatch.templateName,
      reason: `${selected.reason} ${templateMatch.reason}`.trim(),
      styleId: selected.styleId,
      styleName: selected.styleName
    }
  }
  ctx.repos.saveScript(projectId, 'match', match)
  const selectedTemplate =
    templates.find((item) => item.templateName === match.templateName) ?? templates[0]

  report('adapter', 'Style Adapter 风格适配', 65)
  const adapterPrompt = styleAdapterPrompt({
    base: JSON.stringify(baseDraft),
    profile: JSON.stringify(profile ?? { note: '未选择 Style DNA，保持 Base Draft 逻辑。' }),
    template: JSON.stringify(selectedTemplate ?? { sections: [] }),
    examples: JSON.stringify(examples),
    platform: JSON.stringify(platform),
    commercial: JSON.stringify(project.commercial)
  })
  const adapterRes = await ctx.provider.chat(
    {
      task: project.commercial.enabled ? 'commercial_adapter' : 'style_adapter',
      capability: 'json',
      json: true,
      messages: [
        { role: 'system', content: adapterPrompt.system },
        { role: 'user', content: adapterPrompt.user }
      ]
    },
    textModel
  )
  ctx.repos.addUsage({
    projectId,
    task: 'style_adapter',
    model: adapterRes.model,
    ...usageOf(adapterRes)
  })
  const finalDraft = await parseModelJson(adapterRes.text, ScriptSchema, ctx.provider, textModel)
  ctx.repos.saveScript(projectId, 'final', finalDraft)
  ctx.repos.addVersion(projectId, 'V Style Adapted', finalDraft.script)

  report('quality', '质量检查', 88)
  const estimate = estimateDuration(finalDraft.script, project.durationSeconds, duration)
  const qualityPrompt = scriptQualityPrompt({
    script: finalDraft.script,
    pfdbi: JSON.stringify(pfdbi),
    duration: JSON.stringify(estimate)
  })
  const qualityRes = await ctx.provider.chat(
    {
      task: 'script_quality',
      capability: 'json',
      json: true,
      messages: [
        { role: 'system', content: qualityPrompt.system },
        { role: 'user', content: qualityPrompt.user }
      ]
    },
    textModel
  )
  ctx.repos.addUsage({
    projectId,
    task: 'script_quality',
    model: qualityRes.model,
    ...usageOf(qualityRes)
  })
  const quality = await parseModelJson(
    qualityRes.text,
    QualityReportSchema,
    ctx.provider,
    textModel
  )
  if (estimate.warning) quality.durationWarning = estimate.warning
  quality.durationScore = Math.max(0, 1 - Math.abs(estimate.errorPercent) / 100)
  ctx.repos.saveScript(projectId, 'quality', quality)
  ctx.repos.upsertProject({ ...project, status: 'ready', updatedAt: new Date().toISOString() })
  report('done', '成稿已生成', 100)
}

export async function runRewrite(
  selected: string,
  instruction: string,
  context: string,
  ctx: DraftContext
): Promise<string> {
  const model = ctx.router.select('json')
  const prompt = rewritePrompt({ selected, instruction, context })
  const response = await ctx.provider.chat(
    {
      task: 'rewrite',
      capability: 'json',
      json: true,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ]
    },
    model
  )
  const parsed = await parseModelJson(response.text, RewriteSchema, ctx.provider, model)
  return parsed.text
}

function formatAnnotations(annotations: ImageAnnotation[]): string {
  if (annotations.length === 0) return '无'
  return annotations
    .map(
      (item) => `rect x=${item.x} y=${item.y} w=${item.width} h=${item.height} note=${item.note}`
    )
    .join('\n')
}

/**
 * 人手选风格卡视为覆盖；未指定时由 Agent 从已入库目录挑选，未入库预览卡不会出现。
 */
async function selectStyleCard(
  project: ProjectRecord,
  pfdbi: PFDBIAnalysis,
  ctx: DraftContext,
  textModel: string
): Promise<{ styleId: string | null; styleName: string; reason: string }> {
  const catalog = ctx.repos.listCatalogStyles()
  if (project.styleId) {
    const override = catalog.find((item) => item.id === project.styleId)
    if (override) {
      return {
        styleId: override.id,
        styleName: override.name,
        reason: `作者指定覆盖风格卡「${override.name}」。`
      }
    }
    return {
      styleId: null,
      styleName: '中性结构',
      reason: '作者指定的风格卡尚未入库或没有 Style DNA，改用中性结构。'
    }
  }
  if (catalog.length === 0) {
    return {
      styleId: null,
      styleName: '中性结构',
      reason: '风格库还没有已入库风格卡，使用中性结构。'
    }
  }
  const prompt = styleSelectPrompt({
    topic: project.topic,
    draft: project.draft,
    facts: project.facts.slice(0, FACTS_PROMPT_LIMIT),
    contentType: project.contentType,
    pfdbi: pfdbi.coreConclusion,
    catalog: JSON.stringify(catalog)
  })
  const response = await ctx.provider.chat(
    {
      task: 'style_select',
      capability: 'json',
      json: true,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ]
    },
    textModel
  )
  ctx.repos.addUsage({
    projectId: project.id,
    task: 'style_select',
    model: response.model,
    ...usageOf(response)
  })
  const picked = await parseModelJson(response.text, StyleSelectSchema, ctx.provider, textModel)
  const hit = catalog.find((item) => item.id === picked.styleId)
  if (!hit) {
    return {
      styleId: null,
      styleName: '中性结构',
      reason: picked.reason || '没有合适的已入库风格卡，使用中性结构。'
    }
  }
  return {
    styleId: hit.id,
    styleName: hit.name,
    reason: picked.reason || `选题与「${hit.name}」更接近。`
  }
}

function usageOf(response: {
  usage: { promptTokens: number; completionTokens: number; totalTokens: number; estimated: boolean }
  durationMs: number
}): {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  durationMs: number
  estimated: boolean
} {
  return {
    promptTokens: response.usage.promptTokens,
    completionTokens: response.usage.completionTokens,
    totalTokens: response.usage.totalTokens,
    durationMs: response.durationMs,
    estimated: response.usage.estimated
  }
}

export type { DurationProfile, PlatformProfile, QualityReport, ScriptDraft, CommercialBrief }
