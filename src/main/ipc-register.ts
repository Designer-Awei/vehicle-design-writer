import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { extname, join } from 'path'
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'fs'
import { createId } from '@domain/ids'
import { runStyleExtraction } from '@application/workflows/StyleExtractionWorkflow'
import {
  runDraftGeneration,
  runPfdbiAnalysis,
  runRewrite,
  runVisionAnalysis
} from '@application/workflows/DraftGenerationWorkflow'
import { parseDocumentFile } from '@infrastructure/filesystem/document-parser'
import { toDataUrl } from '@infrastructure/filesystem/image-store'
import { encryptSecret } from '@infrastructure/security/secret-store'
import { clipStyleNotes } from '@application/style-preview'
import {
  type ImageAnnotation,
  type LlmSettings,
  type PFDBIAnalysis,
  type ScriptDraft,
  type QualityReport,
  type TemplateMatch
} from '@schemas/index'
import {
  IPC,
  type CreateProjectInput,
  type ImageMetadataPatch,
  type ProjectDetail,
  type ReferenceImageRecord,
  type StyleDetail,
  type StyleIngestConfirmPatch,
  type StyleMetadataPatch,
  type StyleRecord
} from '@shared/ipc'
import { probeSiliconFlow } from '@application/probe-siliconflow'
import { createLlm, readApiKey, type AppContext } from './app-context'
import { getDefaultProjectsRoot, PROJECTS_ROOT_SETTING, resolveProjectsRoot } from './paths'
import { popupAppMenu, type AppMenuId } from './app-menu'
import {
  addSessionImages,
  createSessionProject,
  exportSessionZip,
  getSessionProject,
  importSessionPackage,
  listSessionProjects,
  removeSessionAnnotation,
  removeSessionImage,
  removeSessionProject,
  saveSessionAnnotation,
  saveSessionPfdbi,
  saveSessionProject,
  updateSessionImage,
  updateSessionProject
} from './project-session'
import {
  confirmStyleIngestJob,
  discardStyleIngestJob,
  enqueueStyleDocuments,
  retryStyleIngestJob,
  startStyleIngestQueue
} from './style-ingest-queue'
import {
  DEFAULT_BASE_URL,
  DEFAULT_TEXT_MODEL,
  DEFAULT_VISION_MODEL,
  PLATFORMS,
  STYLE_CATEGORIES
} from '@shared/constants'

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
  ipcMain.handle(IPC.settingsPickProjectRoot, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const picked = await dialog.showOpenDialog(window!, {
      title: '选择项目存储目录',
      defaultPath: resolveProjectsRoot(ctx.repos),
      properties: ['openDirectory', 'createDirectory']
    })
    if (picked.canceled || !picked.filePaths[0]) return null
    const next = picked.filePaths[0]
    mkdirSync(next, { recursive: true })
    ctx.repos.setSetting(PROJECTS_ROOT_SETTING, next)
    return getSettings(ctx)
  })
  ipcMain.handle(IPC.settingsResetProjectRoot, () => {
    ctx.repos.deleteSetting(PROJECTS_ROOT_SETTING)
    mkdirSync(getDefaultProjectsRoot(), { recursive: true })
    return getSettings(ctx)
  })
  ipcMain.handle(IPC.settingsOpenProjectRoot, async () => {
    const root = resolveProjectsRoot(ctx.repos)
    mkdirSync(root, { recursive: true })
    return shell.openPath(root)
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
        notes: clipStyleNotes(input.notes),
        isDemo: false
      })
    }
  )
  ipcMain.handle(
    IPC.stylesCreateFromFolder,
    async (event, input: { name: string; platform: string; category: string; notes: string }) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      const picked = await dialog.showOpenDialog(window!, { properties: ['openDirectory'] })
      if (picked.canceled || !picked.filePaths[0]) return null
      const style = ctx.repos.upsertStyle({
        id: createId('style'),
        name: input.name,
        platform: input.platform,
        category: input.category,
        notes: clipStyleNotes(input.notes),
        isDemo: false
      })
      try {
        const files = importDocuments(ctx, style.id, picked.filePaths[0])
        if (files.length === 0) {
          ctx.repos.deleteStyle(style.id)
          throw new Error('所选目录中没有 txt、md 或 rtf 文案')
        }
        return { style, files }
      } catch (error) {
        ctx.repos.deleteStyle(style.id)
        throw error
      }
    }
  )
  ipcMain.handle(IPC.stylesImportFolder, async (event, styleId: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const picked = await dialog.showOpenDialog(window!, { properties: ['openDirectory'] })
    if (picked.canceled || !picked.filePaths[0]) return []
    return importDocuments(ctx, styleId, picked.filePaths[0])
  })
  ipcMain.handle(IPC.stylesReplaceFolder, async (event, styleId: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const picked = await dialog.showOpenDialog(window!, { properties: ['openDirectory'] })
    if (picked.canceled || !picked.filePaths[0]) return null
    const folder = picked.filePaths[0]
    if (walkDocs(folder).length === 0) {
      throw new Error('所选目录中没有 txt、md 或 rtf 文案')
    }
    ctx.repos.deleteDocuments(styleId)
    ctx.repos.clearStyleExtracted(styleId)
    return importDocuments(ctx, styleId, folder)
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
  ipcMain.handle(IPC.stylesUpdate, (_event, id: string, patch: StyleMetadataPatch) => {
    return updateStyleMetadata(ctx, id, patch)
  })
  ipcMain.handle(IPC.stylesRemove, (_event, id: string) => {
    ctx.repos.deleteStyle(id)
  })
  ipcMain.handle(IPC.stylesIngestPick, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const picked = await dialog.showOpenDialog(window!, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '文案', extensions: ['txt', 'md', 'rtf'] }]
    })
    if (picked.canceled || picked.filePaths.length === 0) return []
    return enqueueStyleDocuments(ctx, picked.filePaths)
  })
  ipcMain.handle(IPC.stylesJobsList, () => ctx.repos.listIngestJobs())
  ipcMain.handle(IPC.stylesJobRetry, (_event, jobId: string) => retryStyleIngestJob(ctx, jobId))
  ipcMain.handle(
    IPC.stylesJobConfirm,
    (_event, jobId: string, patch: StyleIngestConfirmPatch) =>
      confirmStyleIngestJob(ctx, jobId, patch)
  )
  ipcMain.handle(IPC.stylesJobDiscard, (_event, jobId: string) => {
    discardStyleIngestJob(ctx, jobId)
  })

  startStyleIngestQueue(ctx)

  ipcMain.handle(IPC.projectsList, () => listSessionProjects(ctx))
  ipcMain.handle(IPC.projectsGet, (_event, id: string) => getSessionProject(ctx, id))
  ipcMain.handle(IPC.projectsCreate, (_event, input: CreateProjectInput) => createSessionProject(ctx, input))
  ipcMain.handle(
    IPC.projectsUpdate,
    (
      _event,
      id: string,
      patch: Partial<CreateProjectInput> & { title?: string; finalScript?: string }
    ) => updateSessionProject(ctx, id, patch)
  )
  ipcMain.handle(IPC.projectsAddImages, async (event, projectId: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const picked = await dialog.showOpenDialog(window!, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    if (picked.canceled) return []
    return addSessionImages(ctx, projectId, picked.filePaths)
  })
  ipcMain.handle(IPC.projectsRemoveImage, (_event, imageId: string) => {
    removeSessionImage(ctx, imageId)
  })
  ipcMain.handle(IPC.projectsUpdateImage, (_event, imageId: string, patch: ImageMetadataPatch) => {
    return updateSessionImage(ctx, imageId, patch)
  })
  ipcMain.handle(IPC.projectsSaveAnnotation, (_event, annotation: ImageAnnotation) => {
    return saveSessionAnnotation(ctx, annotation)
  })
  ipcMain.handle(IPC.projectsRemoveAnnotation, (_event, annotationId: string) => {
    removeSessionAnnotation(ctx, annotationId)
  })
  ipcMain.handle(IPC.projectsAnalyzeVision, async (event, projectId: string) => {
    const { provider, router } = createLlm(ctx.repos)
    await runVisionAnalysis(projectId, {
      repos: ctx.repos,
      provider,
      router,
      onProgress: (progress) => event.sender.send(IPC.workflowProgress, progress)
    })
    return getProjectDetail(ctx, projectId)
  })
  ipcMain.handle(IPC.projectsAnalyzePfdbi, async (event, projectId: string) => {
    const { provider, router } = createLlm(ctx.repos)
    await runPfdbiAnalysis(projectId, {
      repos: ctx.repos,
      provider,
      router,
      onProgress: (progress) => event.sender.send(IPC.workflowProgress, progress)
    })
    return getProjectDetail(ctx, projectId)
  })
  ipcMain.handle(IPC.projectsSavePfdbi, (_event, projectId: string, analysis: PFDBIAnalysis) => {
    return saveSessionPfdbi(ctx, projectId, analysis)
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
    const detail = getSessionProject(ctx, projectId)
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
  ipcMain.handle(IPC.projectsSave, (_event, projectId: string) => saveSessionProject(ctx, projectId))
  ipcMain.handle(IPC.projectsExportBundle, async (event, projectId: string) => {
    const detail = getSessionProject(ctx, projectId)
    if (!detail) throw new Error('项目不存在')
    const window = BrowserWindow.fromWebContents(event.sender)
    const defaultName = `${detail.title || detail.topic || '文案项目'}.zip`
    const picked = await dialog.showSaveDialog(window!, {
      title: '导出项目安装包',
      defaultPath: defaultName,
      filters: [{ name: '项目安装包', extensions: ['zip'] }]
    })
    if (picked.canceled || !picked.filePath) return null
    return exportSessionZip(ctx, projectId, picked.filePath)
  })
  ipcMain.handle(IPC.projectsImportBundle, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const picked = await dialog.showOpenDialog(window!, {
      title: '选择要导入的项目安装包或文件夹',
      buttonLabel: '导入',
      properties: ['openFile', 'openDirectory'],
      filters: [
        { name: '项目安装包', extensions: ['zip'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    if (picked.canceled || !picked.filePaths[0]) return null
    return importSessionPackage(ctx, picked.filePaths[0])
  })
  ipcMain.handle(IPC.projectsRemove, (_event, id: string) => {
    removeSessionProject(ctx, id)
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
  ipcMain.handle(IPC.menuPopup, (event, id: AppMenuId, x: number, y: number) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    popupAppMenu(window, id, x, y)
  })
}

function getSettings(ctx: AppContext): LlmSettings {
  return {
    provider: 'siliconflow',
    baseUrl: ctx.repos.getSetting('base_url') || DEFAULT_BASE_URL,
    textModel: ctx.repos.getSetting('text_model') || DEFAULT_TEXT_MODEL,
    visionModel: ctx.repos.getSetting('vision_model') || DEFAULT_VISION_MODEL,
    hasApiKey: Boolean(readApiKey(ctx.repos)),
    projectRoot: resolveProjectsRoot(ctx.repos),
    defaultProjectRoot: getDefaultProjectsRoot()
  }
}

/**
 * 更新已有风格的档案字段，不触碰 Style DNA。
 */
function updateStyleMetadata(ctx: AppContext, id: string, patch: StyleMetadataPatch): StyleRecord {
  const current = ctx.repos.getStyle(id)
  if (!current) throw new Error('风格不存在')
  const name = (patch.name ?? current.name).trim()
  if (!name) throw new Error('请填写风格名称')
  const platform = patch.platform ?? current.platform
  const category = patch.category ?? current.category
  if (patch.platform !== undefined && !(PLATFORMS as readonly string[]).includes(platform)) {
    throw new Error('不支持的发布平台')
  }
  if (patch.category !== undefined && !(STYLE_CATEGORIES as readonly string[]).includes(category)) {
    throw new Error('不支持的内容类型')
  }
  return ctx.repos.upsertStyle({
    ...current,
    name,
    platform,
    category,
    notes: patch.notes !== undefined ? clipStyleNotes(patch.notes) : current.notes
  })
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
    role: image.role,
    vehicleLabel: image.vehicleLabel,
    comparisonNote: image.comparisonNote,
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

/**
 * 解析目录中的支持文档并绑定到已创建的风格档案。
 */
function importDocuments(
  ctx: AppContext,
  styleId: string,
  folder: string
): Array<{
  filename: string
  wordCount: number
  parseStatus: 'ok' | 'failed'
  parseError: string | null
}> {
  const results: Array<{
    filename: string
    wordCount: number
    parseStatus: 'ok' | 'failed'
    parseError: string | null
  }> = []
  for (const filePath of walkDocs(folder)) {
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
}
