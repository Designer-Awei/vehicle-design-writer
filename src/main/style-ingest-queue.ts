import { BrowserWindow } from 'electron'
import { basename } from 'path'
import { createId } from '@domain/ids'
import { extractStyleArtifacts } from '@application/workflows/StyleExtractionWorkflow'
import { buildStylePreview, clipStyleNotes, deriveStyleNotes } from '@application/style-preview'
import { parseDocumentFile } from '@infrastructure/filesystem/document-parser'
import { logError } from '@infrastructure/logging/logger'
import {
  IPC,
  type StyleIngestConfirmPatch,
  type StyleIngestJob,
  type StyleRecord,
  type WorkflowProgress
} from '@shared/ipc'
import { createLlm, type AppContext } from './app-context'
import { isUnrecoverableProviderError } from '@infrastructure/llm/SiliconFlowProvider'

let pumping = false

/**
 * 把提取进度广播给所有窗口，用户离开风格库后回来仍能看到任务状态。
 */
export function broadcastWorkflowProgress(progress: WorkflowProgress): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(IPC.workflowProgress, progress)
  }
}

/**
 * 启动时恢复中断任务，并尝试继续跑队列。
 */
export function startStyleIngestQueue(ctx: AppContext): void {
  ctx.repos.requeueExtractingJobs()
  void pumpStyleIngestQueue(ctx)
}

/**
 * 把选中的文案文件逐篇入队。解析失败的任务直接标记失败，不占模型配额。
 */
export function enqueueStyleDocuments(ctx: AppContext, filePaths: string[]): StyleIngestJob[] {
  const jobs: StyleIngestJob[] = []
  for (const filePath of filePaths) {
    const filename = basename(filePath)
    const parsed = parseDocumentFile(filePath, filename)
    if (parsed.status !== 'ok') {
      jobs.push(
        ctx.repos.insertIngestJob({
          filename: parsed.filename,
          content: '',
          wordCount: parsed.wordCount,
          parseStatus: 'failed',
          parseError: parsed.error,
          status: 'failed',
          error: parsed.error
        })
      )
      continue
    }
    jobs.push(
      ctx.repos.insertIngestJob({
        filename: parsed.filename,
        content: parsed.text,
        wordCount: parsed.wordCount,
        parseStatus: 'ok',
        parseError: null,
        status: 'queued'
      })
    )
  }
  void pumpStyleIngestQueue(ctx)
  return jobs
}

/**
 * 失败任务重新排队；解析失败的不能重试。
 */
export function retryStyleIngestJob(ctx: AppContext, jobId: string): StyleIngestJob {
  const job = ctx.repos.getIngestJob(jobId)
  if (!job) throw new Error('任务不存在')
  if (job.status === 'ingested') throw new Error('该预览卡已经入库')
  if (job.status === 'extracting' || job.status === 'queued') return job
  const content = ctx.repos.getIngestJobContent(jobId)
  if (!content) throw new Error('原文解析失败，请重新上传该文件')
  const next = ctx.repos.updateIngestJobStatus(jobId, 'queued', {
    error: null,
    progressPercent: 0,
    progressMessage: '排队中',
    preview: null,
    styleId: null
  })
  void pumpStyleIngestQueue(ctx)
  return next as StyleIngestJob
}

/**
 * 人确认后才写入风格库。预览卡在确认前不能被创作链路选用。
 */
export function confirmStyleIngestJob(
  ctx: AppContext,
  jobId: string,
  patch: StyleIngestConfirmPatch
): StyleRecord {
  const job = ctx.repos.getIngestJob(jobId)
  if (!job) throw new Error('任务不存在')
  if (job.status === 'ingested' && job.styleId) {
    const existing = ctx.repos.getStyle(job.styleId)
    if (existing) return existing
  }
  if (job.status !== 'completed' || !job.preview) {
    throw new Error('请等待预览卡完成后再确认入库')
  }
  const content = ctx.repos.getIngestJobContent(jobId)
  if (!content) throw new Error('找不到原文，无法入库')
  const author = patch.author.trim() || job.preview.author
  const category = patch.category.trim() || job.preview.category
  const platform = patch.platform.trim() || job.preview.platform || 'B站'
  const notes =
    clipStyleNotes(patch.notes) || job.preview.notes || deriveStyleNotes(job.preview.profile)
  const style = ctx.repos.upsertStyle({
    id: createId('style'),
    name: `${author} · ${category}`,
    platform,
    category,
    notes,
    isDemo: false
  })
  const preview = {
    ...job.preview,
    author,
    platform,
    category,
    notes
  }
  ctx.repos.saveStyleProfile(style.id, {
    ...preview.profile,
    creator: { ...preview.profile.creator, notes }
  })
  ctx.repos.replaceTemplates(style.id, preview.templates)
  ctx.repos.replaceExamples(style.id, preview.examples)
  ctx.repos.insertDocument({
    styleId: style.id,
    filename: job.filename,
    content,
    wordCount: job.wordCount,
    parseStatus: 'ok',
    parseError: null
  })
  ctx.repos.updateIngestJobStatus(jobId, 'ingested', {
    preview,
    styleId: style.id,
    progressPercent: 100,
    progressMessage: '已入库',
    error: null
  })
  return style
}

/**
 * 丢弃预览与任务，不写入风格库。
 */
export function discardStyleIngestJob(ctx: AppContext, jobId: string): void {
  const job = ctx.repos.getIngestJob(jobId)
  if (!job) return
  if (job.status === 'ingested') {
    throw new Error('已入库的任务请到风格卡片右侧删除')
  }
  if (job.status === 'extracting') {
    throw new Error('正在提取的任务请稍后再丢弃')
  }
  ctx.repos.deleteIngestJob(jobId)
}

/**
 * 同一时间只跑一篇文档的提取；单篇内部仍按现有分片并行。
 */
export async function pumpStyleIngestQueue(ctx: AppContext): Promise<void> {
  if (pumping) return
  pumping = true
  try {
    while (true) {
      const job = ctx.repos.nextQueuedIngestJob()
      if (!job) break
      await processIngestJob(ctx, job)
    }
  } finally {
    pumping = false
  }
}

async function processIngestJob(
  ctx: AppContext,
  job: StyleIngestJob & { content: string }
): Promise<void> {
  ctx.repos.updateIngestJobStatus(job.id, 'extracting', {
    progressPercent: 4,
    progressMessage: '开始提取预览风格卡',
    error: null
  })
  broadcastWorkflowProgress({
    jobId: job.id,
    stage: 'document_analysis',
    message: '开始提取预览风格卡',
    percent: 4
  })
  try {
    const { provider, router } = createLlm(ctx.repos)
    const artifacts = await extractStyleArtifacts(
      [{ id: job.id, filename: job.filename, content: job.content }],
      {
        repos: ctx.repos,
        provider,
        router,
        onProgress: (progress) => {
          ctx.repos.updateIngestJobProgress(job.id, progress.percent, progress.message)
          broadcastWorkflowProgress({ ...progress, jobId: job.id })
        }
      },
      { creatorLabel: job.filename, jobId: job.id }
    )
    const preview = buildStylePreview(artifacts, {
      filename: job.filename,
      wordCount: job.wordCount
    })
    ctx.repos.updateIngestJobStatus(job.id, 'completed', {
      preview,
      progressPercent: 100,
      progressMessage: '预览卡已完成，等待确认入库',
      error: null
    })
    broadcastWorkflowProgress({
      jobId: job.id,
      stage: 'done',
      message: '预览卡已完成，等待确认入库',
      percent: 100
    })
  } catch (error) {
    logError('style.ingest', error)
    const message = error instanceof Error ? error.message : '提取失败'
    ctx.repos.updateIngestJobStatus(job.id, 'failed', {
      error: message,
      progressPercent: 100,
      progressMessage: message
    })
    broadcastWorkflowProgress({
      jobId: job.id,
      stage: 'failed',
      message,
      percent: 100
    })
    if (isUnrecoverableProviderError(message)) {
      failQueuedIngestJobs(ctx, message)
    }
  }
}

/**
 * 余额不足等错误会让后续排队任务同样失败，直接标失败避免反复打接口。
 */
function failQueuedIngestJobs(ctx: AppContext, message: string): void {
  for (const item of ctx.repos.listIngestJobs()) {
    if (item.status !== 'queued') continue
    ctx.repos.updateIngestJobStatus(item.id, 'failed', {
      error: message,
      progressPercent: 100,
      progressMessage: message
    })
    broadcastWorkflowProgress({
      jobId: item.id,
      stage: 'failed',
      message,
      percent: 100
    })
  }
}
