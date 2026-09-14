import { mapPool } from '@application/async-pool'
import { parseModelJson } from '@application/json-parse'
import { ModelRouter } from '@application/model-router'
import { deriveStyleNotes, pickContentType } from '@application/style-preview'
import { normalizeExamples, normalizeTemplates } from '@application/style-extract-normalize'
import type { Repositories } from '@infrastructure/db/repositories'
import { logError } from '@infrastructure/logging/logger'
import type { ChatResponse, LLMProvider, LLMTask } from '@infrastructure/llm/types'
import {
  DocumentAnalysisSchema,
  ExampleBundleSchema,
  SingleTemplateSchema,
  StyleArgumentationSliceSchema,
  StyleAutomotiveSliceSchema,
  StyleCommercialSliceSchema,
  StyleCreatorToneSliceSchema,
  StyleLanguageSliceSchema,
  StyleProfileSchema,
  StyleQualitySchema,
  StyleRhetoricSliceSchema,
  type DocumentAnalysis,
  type ExampleCase,
  type StyleProfile,
  type StructureTemplate
} from '@schemas/index'
import { LLM_REQUEST_CONCURRENCY, type ContentType } from '@shared/constants'
import type { WorkflowProgress } from '@shared/ipc'
import {
  documentAnalysisPrompt,
  documentAnalysisRepairInstruction,
  fewshotPrompt,
  fewshotRepairInstruction,
  styleQualityPrompt,
  styleSlicePrompt,
  styleSliceRepairInstruction,
  templateOnePrompt,
  templateOneRepairInstruction
} from '@prompts/index'
import type { z } from 'zod'

export interface StyleExtractionContext {
  repos: Repositories
  provider: LLMProvider
  router: ModelRouter
  onProgress?: (progress: WorkflowProgress) => void
}

/** Style DNA 并行切片：每次只抽一组字段，降低单次超时风险。 */
const DNA_SLICES = [
  {
    id: 'tone',
    label: '语气与人设',
    schema: StyleCreatorToneSliceSchema,
    promptSlice: 'tone'
  },
  {
    id: 'language',
    label: '语言',
    schema: StyleLanguageSliceSchema,
    promptSlice: 'language'
  },
  {
    id: 'argumentation',
    label: '论证',
    schema: StyleArgumentationSliceSchema,
    promptSlice: 'argumentation'
  },
  {
    id: 'rhetoric',
    label: '修辞',
    schema: StyleRhetoricSliceSchema,
    promptSlice: 'rhetoric'
  },
  {
    id: 'automotive',
    label: '设计表达',
    schema: StyleAutomotiveSliceSchema,
    promptSlice: 'automotive'
  },
  {
    id: 'commercial',
    label: '商业与签名',
    schema: StyleCommercialSliceSchema,
    promptSlice: 'commercial'
  }
] as const

export interface StyleArtifacts {
  profile: StyleProfile
  templates: StructureTemplate[]
  examples: ExampleCase[]
  category: ContentType
}

/**
 * 多文案并行分析 → DNA 切片并行聚合 → 抽出 1 个结构模板 → few-shot → 质量审查。
 * 只产出结果，不写风格库；队列预览和旧的聚合提取共用。
 */
export async function extractStyleArtifacts(
  documents: Array<{ id: string; filename: string; content: string }>,
  ctx: StyleExtractionContext,
  options: { creatorLabel: string; styleId?: string; jobId?: string }
): Promise<StyleArtifacts> {
  if (documents.length === 0) throw new Error('请先导入至少 1 篇文案')

  const report = (stage: string, message: string, percent: number): void => {
    ctx.onProgress?.({
      styleId: options.styleId,
      jobId: options.jobId,
      stage,
      message,
      percent
    })
  }

  const model = ctx.router.select('json')
  report('document_analysis', `单篇分析 0/${documents.length}`, 8)

  let analyzed = 0
  let lastAnalysisError: Error | null = null
  const analysisResults = await mapPool(documents, LLM_REQUEST_CONCURRENCY, async (doc) => {
    try {
      const prompt = documentAnalysisPrompt({
        documentId: doc.id,
        filename: doc.filename,
        text: doc.content
      })
      const analysis = (await chatJson(
        ctx,
        model,
        'document_analysis',
        prompt,
        DocumentAnalysisSchema,
        documentAnalysisRepairInstruction(doc.id),
        2048
      )) as DocumentAnalysis
      analysis.documentId = doc.id
      return analysis
    } catch (error) {
      lastAnalysisError = error instanceof Error ? error : new Error(String(error))
      logError('style.document_analysis', lastAnalysisError)
      return null
    } finally {
      analyzed += 1
      report(
        'document_analysis',
        `单篇分析 ${analyzed}/${documents.length}`,
        8 + Math.round((analyzed / documents.length) * 32)
      )
    }
  })
  const analyses = analysisResults.filter((item): item is DocumentAnalysis => item != null)
  if (analyses.length === 0) {
    throw lastAnalysisError ?? new Error('全部样本文案分析失败或超时，请稍后重试。')
  }

  const compactAnalyses = JSON.stringify(
    analyses.map((item) => ({
      documentId: item.documentId,
      topic: item.topic,
      structure: item.structure,
      languageTraits: item.languageTraits,
      argumentationTraits: item.argumentationTraits,
      signatureLines: item.signatureLines.slice(0, 4),
      designKnowledgeVsStyle: item.designKnowledgeVsStyle
    }))
  )

  report('style_aggregation', '并行提取 Writing DNA 与代表性片段', 42)
  const documentIds = documents.map((item) => item.id)
  let sliceDone = 0
  const [sliceResults, exampleBundle] = await Promise.all([
    mapPool(DNA_SLICES, LLM_REQUEST_CONCURRENCY, async (slice) => {
      try {
        const prompt = styleSlicePrompt({
          slice: slice.promptSlice,
          creator: options.creatorLabel,
          analyses: compactAnalyses
        })
        return await chatJson(
          ctx,
          model,
          'style_aggregation',
          prompt,
          slice.schema,
          styleSliceRepairInstruction(slice.promptSlice),
          1536
        )
      } catch (error) {
        logError(`style.slice.${slice.id}`, error)
        return slice.schema.parse({})
      } finally {
        sliceDone += 1
        report(
          'style_aggregation',
          `Writing DNA ${sliceDone}/${DNA_SLICES.length}：${slice.label}`,
          42 + Math.round((sliceDone / DNA_SLICES.length) * 18)
        )
      }
    }),
    (async () => {
      try {
        const few = fewshotPrompt({
          documentIds: documentIds.join(', '),
          documents: documents
            .map(
              (item) =>
                `documentId=${item.id}\n文件：${item.filename}\n正文：\n${item.content.slice(0, 800)}`
            )
            .join('\n---\n')
        })
        return (await chatJson(
          ctx,
          model,
          'fewshot_generation',
          few,
          ExampleBundleSchema,
          fewshotRepairInstruction(documentIds.join(', ')),
          2048
        )) as { examples: ExampleCase[] }
      } catch (error) {
        logError('style.fewshot', error)
        return { examples: [] }
      }
    })()
  ])

  const profile = mergeStyleSlices(sliceResults)
  const examples = normalizeExamples(exampleBundle.examples, documentIds)

  const profileSummary = JSON.stringify({
    creator: profile.creator,
    language: profile.language,
    argumentation: profile.argumentation,
    rhetoric: profile.rhetoric,
    signaturePatterns: profile.signaturePatterns
  })
  const structureClues = JSON.stringify(
    analyses.map((item) => ({
      documentId: item.documentId,
      topic: item.topic,
      structure: item.structure
    }))
  )

  report('templates', '根据样本文案抽出结构模板', 62)
  let templates: StructureTemplate[] = []
  try {
    const prompt = templateOnePrompt({
      profile: profileSummary,
      analyses: structureClues
    })
    const template = (await chatJson(
      ctx,
      model,
      'template_generation',
      prompt,
      SingleTemplateSchema,
      templateOneRepairInstruction(),
      1536
    )) as StructureTemplate
    templates = normalizeTemplates([
      {
        ...template,
        applicableTopics: []
      }
    ])
  } catch (error) {
    logError('style.template', error)
  }
  report('templates', '结构模板已完成', 76)

  report('fewshot', '代表性片段已整理', 82)

  report('quality', 'Style DNA 质量检查', 92)
  try {
    const qualityPrompt = styleQualityPrompt({
      profile: profileSummary,
      docCount: documents.length
    })
    await chatJson(ctx, model, 'style_quality', qualityPrompt, StyleQualitySchema, undefined, 1024)
  } catch (error) {
    logError('style.quality', error)
  }
  report('done', '提取完成', 100)
  return { profile, templates, examples, category: pickContentType(analyses) }
}

/**
 * 旧入口：对已建档的风格聚合提取，并直接写入风格库。
 */
export async function runStyleExtraction(
  styleId: string,
  ctx: StyleExtractionContext
): Promise<void> {
  const style = ctx.repos.getStyle(styleId)
  if (!style) throw new Error('风格不存在')
  const documents = ctx.repos.getDocumentContents(styleId)
  const artifacts = await extractStyleArtifacts(documents, ctx, {
    creatorLabel: `${style.name} / ${style.platform}`,
    styleId
  })
  const notes = deriveStyleNotes(artifacts.profile)
  ctx.repos.saveStyleProfile(styleId, {
    ...artifacts.profile,
    creator: { ...artifacts.profile.creator, notes }
  })
  ctx.repos.replaceExamples(styleId, artifacts.examples)
  ctx.repos.replaceTemplates(styleId, artifacts.templates)
  ctx.repos.upsertStyle({
    ...style,
    notes
  })
  ctx.onProgress?.({ styleId, stage: 'done', message: '风格已保存到风格库', percent: 100 })
}

/**
 * 把并行切片收成完整 Style DNA；缺的切片走 schema 默认值。
 */
function mergeStyleSlices(slices: unknown[]): StyleProfile {
  return StyleProfileSchema.parse(Object.assign({}, ...slices))
}

/**
 * 发起一次 JSON 聊天并校验，同时记下用量。
 */
async function chatJson(
  ctx: StyleExtractionContext,
  model: string,
  task: LLMTask,
  prompt: { system: string; user: string },
  schema: z.ZodTypeAny,
  repairInstruction: string | undefined,
  maxTokens: number
): Promise<unknown> {
  const response = await ctx.provider.chat(
    {
      task,
      capability: 'json',
      json: true,
      maxTokens,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ]
    },
    model
  )
  ctx.repos.addUsage({
    task,
    model: response.model,
    ...toUsageFields(response)
  })
  return parseModelJson(response.text, schema, ctx.provider, model, repairInstruction)
}

function toUsageFields(response: ChatResponse): {
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
