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
  VisionObservationSchema,
  type CommercialBrief,
  type DurationProfile,
  type ImageAnnotation,
  type PlatformProfile,
  type QualityReport,
  type ScriptDraft,
  type TemplateMatch,
  type VisionObservation
} from '@schemas/index'
import { PROMPT_VERSION } from '@shared/constants'
import type { WorkflowProgress } from '@shared/ipc'
import {
  baseDraftPrompt,
  pfdbiAnalysisPrompt,
  scriptQualityPrompt,
  styleAdapterPrompt,
  templateMatchPrompt,
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
 * 视觉观察 → PFDBI → Base Draft → 模板匹配 → Style Adapter → 质检。禁止一步生成终稿。
 */
export async function runDraftGeneration(projectId: string, ctx: DraftContext): Promise<void> {
  const project = ctx.repos.getProject(projectId)
  if (!project) throw new Error('项目不存在')
  const report = (stage: string, message: string, percent: number): void => {
    ctx.onProgress?.({ projectId, stage, message, percent })
  }

  const images = ctx.repos.listImages(projectId)
  const visionModel = ctx.router.select('vision')
  const textModel = ctx.router.select('json')

  const observations: VisionObservation[] = []
  for (const [index, image] of images.entries()) {
    report(
      'vision',
      `视觉观察 ${index + 1}/${Math.max(images.length, 1)}`,
      8 + Math.round((index / Math.max(images.length, 1)) * 22)
    )
    const annotations = ctx.repos.listAnnotations(image.id)
    const cacheKey = `${image.hash}:${visionModel}:${PROMPT_VERSION}:${hashText(JSON.stringify(annotations))}`
    const cached = ctx.repos.getVisionByCache(cacheKey)
    if (cached) {
      observations.push(cached)
      continue
    }
    if (images.length === 0) break
    const prompt = visionObservationPrompt({
      imageId: image.id,
      annotations: formatAnnotations(annotations)
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
      textModel
    )
    observation.imageId = image.id
    ctx.repos.saveVision(projectId, image.id, observation, cacheKey)
    observations.push(observation)
  }

  report('pfdbi', 'PFDBI 设计评价分析', 38)
  const pfdbiKey = hashText(
    `${project.topic}|${project.draft}|${JSON.stringify(observations)}|${textModel}|${PROMPT_VERSION}`
  )
  let pfdbi = ctx.repos.getPfdbiByCache(pfdbiKey)
  if (!pfdbi) {
    const prompt = pfdbiAnalysisPrompt({
      topic: project.topic,
      draft: project.draft,
      vision: JSON.stringify(observations),
      extras: JSON.stringify(project.commercial)
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

  const duration = ctx.repos.listDurations()[0] ?? DEFAULT_DURATION
  report('base_draft', '生成 Base Draft（不模仿博主）', 55)
  const basePrompt = baseDraftPrompt({
    topic: project.topic,
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

  const styleId = project.styleId
  const templates = styleId ? ctx.repos.listTemplates(styleId) : []
  const profile = styleId ? ctx.repos.getStyleProfile(styleId) : null
  const examples = styleId ? ctx.repos.listExamples(styleId) : []
  const platforms = ctx.repos.listPlatforms()
  const platform = platforms.find((item) => item.platform === project.platform)

  report('template', '匹配结构模板', 68)
  let match: TemplateMatch = {
    templateName: templates[0]?.templateName ?? '默认线性结构',
    reason: '未找到风格模板，使用默认顺序。'
  }
  if (templates.length > 0) {
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
    match = await parseModelJson(matchRes.text, TemplateMatchSchema, ctx.provider, textModel)
  }
  ctx.repos.saveScript(projectId, 'match', match)
  const selectedTemplate =
    templates.find((item) => item.templateName === match.templateName) ?? templates[0]

  report('adapter', 'Style Adapter 风格适配', 80)
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

  report('quality', '质量检查', 92)
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
