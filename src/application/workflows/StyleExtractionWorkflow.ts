import { parseModelJson } from '@application/json-parse'
import { ModelRouter } from '@application/model-router'
import type { Repositories } from '@infrastructure/db/repositories'
import type { LLMProvider } from '@infrastructure/llm/types'
import {
  DocumentAnalysisSchema,
  ExampleBundleSchema,
  StyleProfileSchema,
  StyleQualitySchema,
  TemplateBundleSchema,
  type DocumentAnalysis
} from '@schemas/index'
import type { WorkflowProgress } from '@shared/ipc'
import {
  documentAnalysisPrompt,
  fewshotPrompt,
  styleAggregationPrompt,
  styleQualityPrompt,
  templateGenerationPrompt
} from '@prompts/index'

export interface StyleExtractionContext {
  repos: Repositories
  provider: LLMProvider
  router: ModelRouter
  onProgress?: (progress: WorkflowProgress) => void
}

/**
 * 多文案 → 单篇分析 → 聚合 DNA → 模板 → few-shot → 质量审查。
 */
export async function runStyleExtraction(
  styleId: string,
  ctx: StyleExtractionContext
): Promise<void> {
  const style = ctx.repos.getStyle(styleId)
  if (!style) throw new Error('风格不存在')
  const documents = ctx.repos.getDocumentContents(styleId)
  if (documents.length === 0) throw new Error('请先导入至少 1 篇文案')

  const report = (stage: string, message: string, percent: number): void => {
    ctx.onProgress?.({ styleId, stage, message, percent })
  }

  const model = ctx.router.select('json')
  const analyses: DocumentAnalysis[] = []
  for (const [index, doc] of documents.entries()) {
    report(
      'document_analysis',
      `单篇分析 ${index + 1}/${documents.length}`,
      10 + Math.round((index / documents.length) * 40)
    )
    const prompt = documentAnalysisPrompt({
      documentId: doc.id,
      filename: doc.filename,
      text: doc.content
    })
    const response = await ctx.provider.chat(
      {
        task: 'document_analysis',
        capability: 'json',
        json: true,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ]
      },
      model
    )
    ctx.repos.addUsage({
      projectId: undefined,
      task: 'document_analysis',
      model: response.model,
      ...toUsageFields(response)
    })
    analyses.push(await parseModelJson(response.text, DocumentAnalysisSchema, ctx.provider, model))
  }

  report('style_aggregation', '聚合 Writing DNA', 55)
  const agg = styleAggregationPrompt({
    creator: `${style.name} / ${style.platform}`,
    analyses: JSON.stringify(analyses)
  })
  const profileRes = await ctx.provider.chat(
    {
      task: 'style_aggregation',
      capability: 'json',
      json: true,
      messages: [
        { role: 'system', content: agg.system },
        { role: 'user', content: agg.user }
      ]
    },
    model
  )
  ctx.repos.addUsage({
    task: 'style_aggregation',
    model: profileRes.model,
    ...toUsageFields(profileRes)
  })
  const profile = await parseModelJson(profileRes.text, StyleProfileSchema, ctx.provider, model)
  ctx.repos.saveStyleProfile(styleId, profile)

  report('templates', '生成场景化结构模板', 70)
  const tplPrompt = templateGenerationPrompt({
    profile: JSON.stringify(profile),
    documents: documents.map((item) => item.filename).join(', ')
  })
  const tplRes = await ctx.provider.chat(
    {
      task: 'template_generation',
      capability: 'json',
      json: true,
      messages: [
        { role: 'system', content: tplPrompt.system },
        { role: 'user', content: tplPrompt.user }
      ]
    },
    model
  )
  ctx.repos.addUsage({ task: 'template_generation', model: tplRes.model, ...toUsageFields(tplRes) })
  const templates = await parseModelJson(tplRes.text, TemplateBundleSchema, ctx.provider, model)
  ctx.repos.replaceTemplates(styleId, templates.templates)

  report('fewshot', '挑选代表性短片段', 82)
  const few = fewshotPrompt({
    documents: documents.map((item) => `${item.id}\n${item.content.slice(0, 1200)}`).join('\n---\n')
  })
  const fewRes = await ctx.provider.chat(
    {
      task: 'fewshot_generation',
      capability: 'json',
      json: true,
      messages: [
        { role: 'system', content: few.system },
        { role: 'user', content: few.user }
      ]
    },
    model
  )
  ctx.repos.addUsage({ task: 'fewshot_generation', model: fewRes.model, ...toUsageFields(fewRes) })
  const examples = await parseModelJson(fewRes.text, ExampleBundleSchema, ctx.provider, model)
  ctx.repos.replaceExamples(styleId, examples.examples)

  report('quality', 'Style DNA 质量检查', 92)
  const qualityPrompt = styleQualityPrompt({
    profile: JSON.stringify(profile),
    docCount: documents.length
  })
  const qualityRes = await ctx.provider.chat(
    {
      task: 'style_quality',
      capability: 'json',
      json: true,
      messages: [
        { role: 'system', content: qualityPrompt.system },
        { role: 'user', content: qualityPrompt.user }
      ]
    },
    model
  )
  ctx.repos.addUsage({
    task: 'style_quality',
    model: qualityRes.model,
    ...toUsageFields(qualityRes)
  })
  await parseModelJson(qualityRes.text, StyleQualitySchema, ctx.provider, model)
  report('done', '风格已保存到风格库', 100)
}

function toUsageFields(response: {
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
