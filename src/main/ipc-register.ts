import { BrowserWindow, dialog, ipcMain } from 'electron'
import { extname, join } from 'path'
import { readdirSync, statSync, writeFileSync } from 'fs'
import { createId, nowIso } from '@domain/ids'
import { runStyleExtraction } from '@application/workflows/StyleExtractionWorkflow'
import { runDraftGeneration, runRewrite } from '@application/workflows/DraftGenerationWorkflow'
import { parseDocumentFile, hashFile } from '@infrastructure/filesystem/document-parser'
import { isSupportedImage, storeImage, toDataUrl } from '@infrastructure/filesystem/image-store'
import { encryptSecret } from '@infrastructure/security/secret-store'
import type {
  ImageAnnotation,
  LlmSettings,
  ScriptDraft,
  QualityReport,
  TemplateMatch
} from '@schemas/index'
import {
  IPC,
  type CreateProjectInput,
  type ProjectDetail,
  type ReferenceImageRecord,
  type StyleDetail
} from '@shared/ipc'
import { probeSiliconFlow } from '@application/probe-siliconflow'
import { createLlm, readApiKey, type AppContext } from './app-context'
import { DEFAULT_BASE_URL, DEFAULT_TEXT_MODEL, DEFAULT_VISION_MODEL } from '@shared/constants'

/**
 * 注册全部业务 IPC。API Key 只留在主进程。
 */
export function registerIpc(ctx: AppContext): void {
  ipcMain.handle(IPC.settingsGet, () => getSettings(ctx))
  ipcMain.handle(
    IPC.settingsSave,
    (
      _event,
      input: { apiKey?: string; baseUrl: string; textModel: string; visionModel: string }
    ) => {
      if (input.apiKey && input.apiKey.trim()) {
        const packed = encryptSecret(input.apiKey.trim())
        ctx.repos.setSetting('api_key_payload', packed.payload)
        ctx.repos.setSetting('api_key_encrypted', packed.encrypted ? '1' : '0')
      }
      ctx.repos.setSetting('base_url', input.baseUrl)
      ctx.repos.setSetting('text_model', input.textModel)
      ctx.repos.setSetting('vision_model', input.visionModel)
      return getSettings(ctx)
    }
  )
  ipcMain.handle(IPC.settingsModels, async () => {
    const { provider } = createLlm(ctx.repos)
    return provider.listModels()
  })
  ipcMain.handle(IPC.settingsPlatforms, () => ctx.repos.listPlatforms())
  ipcMain.handle(IPC.settingsDurations, () => ctx.repos.listDurations())
  ipcMain.handle(IPC.settingsSaveDuration, (_event, profile) => {
    ctx.repos.upsertDuration(profile)
    return profile
  })
  ipcMain.handle(IPC.settingsProbe, async () => {
    const settings = getSettings(ctx)
    return probeSiliconFlow({
      apiKey: readApiKey(ctx.repos),
      baseUrl: settings.baseUrl,
      textModel: settings.textModel,
      visionModel: settings.visionModel
    })
  })

  ipcMain.handle(IPC.stylesList, () => ctx.repos.listStyles())
  ipcMain.handle(IPC.stylesGet, (_event, id: string) => getStyleDetail(ctx, id))
  ipcMain.handle(
    IPC.stylesCreate,
    (_event, input: { name: string; platform: string; category: string; notes: string }) => {
      return ctx.repos.upsertStyle({
        id: createId('style'),
        name: input.name,
        platform: input.platform,
        category: input.category,
        notes: input.notes,
        isDemo: false
      })
    }
  )
  ipcMain.handle(IPC.stylesImportFolder, async (event, styleId: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const picked = await dialog.showOpenDialog(window!, { properties: ['openDirectory'] })
    if (picked.canceled || !picked.filePaths[0]) return []
    const files = walkDocs(picked.filePaths[0])
    const results: Array<{
      filename: string
      wordCount: number
      parseStatus: 'ok' | 'failed'
      parseError: string | null
    }> = []
    for (const filePath of files) {
      const filename = filePath.split(/[/\\]/).pop() ?? filePath
      const parsed = parseDocumentFile(filePath, filename)
      ctx.repos.insertDocument({
        styleId,
        filename: parsed.filename,
        content: parsed.text,
        wordCount: parsed.wordCount,
        parseStatus: parsed.status,
        parseError: parsed.error
      })
      results.push({
        filename: parsed.filename,
        wordCount: parsed.wordCount,
        parseStatus: parsed.status,
        parseError: parsed.error
      })
    }
    return results
  })
  ipcMain.handle(IPC.stylesExtract, async (event, styleId: string) => {
    const { provider, router } = createLlm(ctx.repos)
    await runStyleExtraction(styleId, {
      repos: ctx.repos,
      provider,
      router,
      onProgress: (progress) => event.sender.send(IPC.workflowProgress, progress)
    })
    return getStyleDetail(ctx, styleId)
  })
  ipcMain.handle(IPC.stylesRemove, (_event, id: string) => {
    ctx.repos.deleteStyle(id)
  })

  ipcMain.handle(IPC.projectsList, () => ctx.repos.listProjects())
  ipcMain.handle(IPC.projectsGet, (_event, id: string) => getProjectDetail(ctx, id))
  ipcMain.handle(IPC.projectsCreate, async (_event, input: CreateProjectInput) => {
    const id = createId('proj')
    const now = nowIso()
    ctx.repos.upsertProject({
      id,
      title: input.topic.slice(0, 40) || '未命名文案',
      topic: input.topic,
      draft: input.draft,
      platform: input.platform,
      durationSeconds: input.durationSeconds,
      contentType: input.contentType,
      styleId: input.styleId,
      commercial: input.commercial ?? {
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
    for (const [index, imagePath] of (input.imagePaths ?? []).entries()) {
      addImageFromPath(ctx, id, imagePath, index)
    }
    return getProjectDetail(ctx, id)
  })
  ipcMain.handle(
    IPC.projectsUpdate,
    (
      _event,
      id: string,
      patch: Partial<CreateProjectInput> & { title?: string; finalScript?: string }
    ) => {
      const current = ctx.repos.getProject(id)
      if (!current) throw new Error('项目不存在')
      const next = {
        ...current,
        title: patch.title ?? current.title,
        topic: patch.topic ?? current.topic,
        draft: patch.draft ?? current.draft,
        platform: patch.platform ?? current.platform,
        durationSeconds: patch.durationSeconds ?? current.durationSeconds,
        contentType: patch.contentType ?? current.contentType,
        styleId: patch.styleId === undefined ? current.styleId : patch.styleId,
        commercial: patch.commercial ?? current.commercial,
        updatedAt: nowIso()
      }
      ctx.repos.upsertProject(next)
      if (patch.finalScript != null) {
        const finalDraft = ctx.repos.getScript<ScriptDraft>(id, 'final') ?? {
          title: next.title,
          outline: [],
          script: patch.finalScript,
          pfdbiReferences: []
        }
        ctx.repos.saveScript(id, 'final', { ...finalDraft, script: patch.finalScript })
        ctx.repos.addVersion(id, 'V Manual', patch.finalScript)
      }
      return getProjectDetail(ctx, id)
    }
  )
  ipcMain.handle(IPC.projectsAddImages, async (event, projectId: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const picked = await dialog.showOpenDialog(window!, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    if (picked.canceled) return []
    const existing = ctx.repos.listImages(projectId).length
    for (const [index, filePath] of picked.filePaths.entries()) {
      addImageFromPath(ctx, projectId, filePath, existing + index)
    }
    return getProjectDetail(ctx, projectId)?.images ?? []
  })
  ipcMain.handle(IPC.projectsRemoveImage, (_event, imageId: string) => {
    ctx.repos.deleteImage(imageId)
  })
  ipcMain.handle(IPC.projectsSaveAnnotation, (_event, annotation: ImageAnnotation) => {
    return ctx.repos.saveAnnotation(annotation)
  })
  ipcMain.handle(IPC.projectsGenerate, async (event, projectId: string) => {
    const { provider, router } = createLlm(ctx.repos)
    await runDraftGeneration(projectId, {
      repos: ctx.repos,
      provider,
      router,
      onProgress: (progress) => event.sender.send(IPC.workflowProgress, progress)
    })
    return getProjectDetail(ctx, projectId)
  })
  ipcMain.handle(
    IPC.projectsRewrite,
    async (_event, projectId: string, selectedText: string, instruction: string) => {
      const detail = getProjectDetail(ctx, projectId)
      const { provider, router } = createLlm(ctx.repos)
      return runRewrite(selectedText, instruction, detail?.finalDraft?.script ?? '', {
        repos: ctx.repos,
        provider,
        router
      })
    }
  )
  ipcMain.handle(IPC.projectsRestoreVersion, (_event, versionId: string) => {
    const version = ctx.repos.getVersion(versionId)
    if (!version) throw new Error('版本不存在')
    const finalDraft = ctx.repos.getScript<ScriptDraft>(version.projectId, 'final') ?? {
      title: '恢复版本',
      outline: [],
      script: version.content,
      pfdbiReferences: []
    }
    ctx.repos.saveScript(version.projectId, 'final', { ...finalDraft, script: version.content })
    ctx.repos.addVersion(version.projectId, `恢复自 V${version.version}`, version.content)
    return getProjectDetail(ctx, version.projectId)
  })
  ipcMain.handle(IPC.projectsExport, async (event, projectId: string, format: 'txt' | 'md') => {
    const detail = getProjectDetail(ctx, projectId)
    if (!detail?.finalDraft) return null
    const window = BrowserWindow.fromWebContents(event.sender)
    const defaultName = `${detail.title}.${format}`
    const picked = await dialog.showSaveDialog(window!, { defaultPath: defaultName })
    if (picked.canceled || !picked.filePath) return null
    const body =
      format === 'md'
        ? `# ${detail.finalDraft.title}\n\n${detail.finalDraft.script}`
        : detail.finalDraft.script
    writeFileSync(picked.filePath, body, 'utf8')
    return picked.filePath
  })
  ipcMain.handle(IPC.projectsRemove, (_event, id: string) => {
    ctx.repos.deleteProject(id)
  })

  ipcMain.handle(IPC.dialogFolder, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const picked = await dialog.showOpenDialog(window!, { properties: ['openDirectory'] })
    return picked.canceled ? null : picked.filePaths[0]
  })
  ipcMain.handle(IPC.dialogImages, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const picked = await dialog.showOpenDialog(window!, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    return picked.canceled ? [] : picked.filePaths
  })
  ipcMain.handle(IPC.dialogSave, async (event, defaultName: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const picked = await dialog.showSaveDialog(window!, { defaultPath: defaultName })
    return picked.canceled ? null : (picked.filePath ?? null)
  })
}

function getSettings(ctx: AppContext): LlmSettings {
  return {
    provider: 'siliconflow',
    baseUrl: ctx.repos.getSetting('base_url') || DEFAULT_BASE_URL,
    textModel: ctx.repos.getSetting('text_model') || DEFAULT_TEXT_MODEL,
    visionModel: ctx.repos.getSetting('vision_model') || DEFAULT_VISION_MODEL,
    hasApiKey: Boolean(readApiKey(ctx.repos))
  }
}

function getStyleDetail(ctx: AppContext, id: string): StyleDetail | null {
  const style = ctx.repos.getStyle(id)
  if (!style) return null
  return {
    ...style,
    profile: ctx.repos.getStyleProfile(id),
    templates: ctx.repos.listTemplates(id),
    examples: ctx.repos.listExamples(id),
    documents: ctx.repos.listDocuments(id)
  }
}

function getProjectDetail(ctx: AppContext, id: string): ProjectDetail | null {
  const project = ctx.repos.getProject(id)
  if (!project) return null
  const images: ReferenceImageRecord[] = ctx.repos.listImages(id).map((image) => ({
    id: image.id,
    projectId: image.projectId,
    filename: image.filename,
    hash: image.hash,
    sortOrder: image.sortOrder,
    dataUrl: toDataUrl(image.path),
    annotations: ctx.repos.listAnnotations(image.id)
  }))
  return {
    ...project,
    images,
    visionObservations: ctx.repos.listVision(id),
    pfdbi: ctx.repos.getPfdbi(id),
    baseDraft: ctx.repos.getScript<ScriptDraft>(id, 'base'),
    finalDraft: ctx.repos.getScript<ScriptDraft>(id, 'final'),
    quality: ctx.repos.getScript<QualityReport>(id, 'quality'),
    matchedTemplate: ctx.repos.getScript<TemplateMatch>(id, 'match'),
    versions: ctx.repos.listVersions(id),
    usage: ctx.repos.listUsage(id)
  }
}

function addImageFromPath(
  ctx: AppContext,
  projectId: string,
  sourcePath: string,
  sortOrder: number
): void {
  const filename = sourcePath.split(/[/\\]/).pop() ?? sourcePath
  if (!isSupportedImage(filename)) {
    throw new Error(`不支持的图片格式：${filename}`)
  }
  const id = createId('img')
  const stored = storeImage(ctx.userData, projectId, id, sourcePath)
  ctx.repos.insertImage({
    id,
    projectId,
    path: stored,
    filename,
    hash: hashFile(stored),
    sortOrder
  })
}

function walkDocs(dir: string): string[] {
  const result: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      result.push(...walkDocs(full))
      continue
    }
    if (['.txt', '.md', '.rtf'].includes(extname(name).toLowerCase())) {
      result.push(full)
    }
  }
  return result
}
