import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import { createId, nowIso } from '@domain/ids'
import { isSupportedImage, toDataUrl } from '@infrastructure/filesystem/image-store'
import { hashFile } from '@infrastructure/filesystem/document-parser'
import {
  EMPTY_COMMERCIAL,
  listProjectFolders,
  loadProjectDetail,
  persistProjectDetail,
  readProjectRecord,
  toProjectRecord
} from '@application/project-library'
import {
  isProjectBundle,
  readProjectBundle,
  uniqueBundleDir,
  writeProjectBundleTo
} from '@application/project-bundle'
import {
  isProjectZip,
  resolveBundleRoot,
  unzipProjectPackage,
  zipProjectFolder
} from '@application/project-package'
import { PFDBIAnalysisSchema, type ImageAnnotation, type ImageRole, type PFDBIAnalysis, type ScriptDraft } from '@schemas/index'
import type {
  CreateProjectInput,
  ImageMetadataPatch,
  ProjectDetail,
  ProjectRecord,
  ReferenceImageRecord
} from '@shared/ipc'
import { resolveProjectsRoot } from './paths'
import type { AppContext } from './app-context'

/**
 * 扫描磁盘项目库并叠加上尚未落盘的内存稿。
 */
export function listSessionProjects(ctx: AppContext): ProjectRecord[] {
  const byId = new Map<string, ProjectRecord>()
  for (const folder of listProjectFolders(resolveProjectsRoot(ctx.repos))) {
    try {
      const record = readProjectRecord(folder)
      byId.set(record.id, record)
    } catch {
      // 跳过损坏的项目文件夹
    }
  }
  for (const draft of ctx.drafts.values()) {
    byId.set(draft.id, toProjectRecord(draft))
  }
  return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/**
 * 读取项目：优先内存，否则从 data/projects 加载。
 */
export function getSessionProject(ctx: AppContext, id: string): ProjectDetail | null {
  const cached = ctx.drafts.get(id)
  if (cached) return cached
  const folder = findProjectFolder(ctx, id)
  if (!folder) return null
  const detail = loadProjectDetail(folder)
  detail.id = id
  ctx.drafts.set(id, detail)
  return detail
}

/**
 * 新建文案只进内存，不写磁盘、不复制参考图。
 */
export function createSessionProject(ctx: AppContext, input: CreateProjectInput): ProjectDetail {
  const id = createId('proj')
  const now = nowIso()
  const detail: ProjectDetail = {
    id,
    title: input.topic.slice(0, 40) || '未命名文案',
    topic: input.topic,
    draft: input.draft,
    facts: input.facts ?? '',
    platform: input.platform,
    durationSeconds: input.durationSeconds,
    contentType: input.contentType,
    styleId: input.styleId,
    commercial: input.commercial ?? EMPTY_COMMERCIAL,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    folderPath: null,
    saveStatus: 'unsaved',
    images: [],
    visionObservations: [],
    pfdbi: null,
    baseDraft: null,
    finalDraft: null,
    quality: null,
    matchedTemplate: null,
    versions: [],
    usage: []
  }
  for (const [index, imagePath] of (input.imagePaths ?? []).entries()) {
    addMemoryImage(detail, imagePath, index)
  }
  ctx.drafts.set(id, detail)
  return detail
}

/**
 * 更新内存中的文案字段，标记为未保存或未更新。
 */
export function updateSessionProject(
  ctx: AppContext,
  id: string,
  patch: Partial<CreateProjectInput> & { title?: string; finalScript?: string }
): ProjectDetail {
  const current = mustGet(ctx, id)
  current.title = patch.title ?? current.title
  current.topic = patch.topic ?? current.topic
  current.draft = patch.draft ?? current.draft
  current.facts = patch.facts ?? current.facts
  current.platform = patch.platform ?? current.platform
  current.durationSeconds = patch.durationSeconds ?? current.durationSeconds
  current.contentType = patch.contentType ?? current.contentType
  current.styleId = patch.styleId === undefined ? current.styleId : patch.styleId
  current.commercial = patch.commercial ?? current.commercial
  if (patch.finalScript != null) {
    const finalDraft: ScriptDraft = current.finalDraft ?? {
      title: current.title,
      outline: [],
      script: patch.finalScript,
      pfdbiReferences: []
    }
    current.finalDraft = { ...finalDraft, title: current.title, script: patch.finalScript }
    current.status = patch.finalScript.trim() ? 'ready' : current.status
  }
  markDirty(current)
  return current
}

/**
 * 把选中的本地图片读进内存，保存项目时才写入 参考图/。
 */
export function addSessionImages(ctx: AppContext, id: string, filePaths: string[]): ReferenceImageRecord[] {
  const detail = mustGet(ctx, id)
  const added: ReferenceImageRecord[] = []
  for (const filePath of filePaths) {
    const image = addMemoryImage(detail, filePath, detail.images.length)
    if (image) added.push(image)
  }
  if (added.length > 0) markDirty(detail)
  return detail.images
}

/**
 * 从当前项目里去掉一张参考图。
 */
export function removeSessionImage(ctx: AppContext, imageId: string): void {
  for (const detail of ctx.drafts.values()) {
    const next = detail.images.filter((image) => image.id !== imageId)
    if (next.length === detail.images.length) continue
    detail.images = next.map((image, index) => ({ ...image, sortOrder: index }))
    markDirty(detail)
    return
  }
}

/**
 * 改参考图角色、车型标签或比较说明。
 */
export function updateSessionImage(
  ctx: AppContext,
  imageId: string,
  patch: ImageMetadataPatch
): ReferenceImageRecord {
  for (const detail of ctx.drafts.values()) {
    const image = detail.images.find((item) => item.id === imageId)
    if (!image) continue
    if (patch.role) image.role = patch.role
    if (patch.vehicleLabel != null) image.vehicleLabel = patch.vehicleLabel
    if (patch.comparisonNote != null) image.comparisonNote = patch.comparisonNote
    markDirty(detail)
    return image
  }
  throw new Error('参考图不存在')
}

/**
 * 框选标注仍写入当前图片；本期 UI 不用，保留接口。
 */
export function saveSessionAnnotation(ctx: AppContext, annotation: ImageAnnotation): ImageAnnotation {
  const stored = { ...annotation, id: annotation.id || createId('ann') }
  for (const detail of ctx.drafts.values()) {
    const image = detail.images.find((item) => item.id === stored.imageId)
    if (!image) continue
    const index = image.annotations.findIndex((item) => item.id === stored.id)
    if (index >= 0) image.annotations[index] = stored
    else image.annotations.push(stored)
    markDirty(detail)
    return stored
  }
  throw new Error('参考图不存在')
}

/**
 * 删除一张图上的标注。
 */
export function removeSessionAnnotation(ctx: AppContext, annotationId: string): void {
  for (const detail of ctx.drafts.values()) {
    for (const image of detail.images) {
      const next = image.annotations.filter((item) => item.id !== annotationId)
      if (next.length === image.annotations.length) continue
      image.annotations = next
      markDirty(detail)
      return
    }
  }
}

/**
 * 把人写的 PFDBI 记在内存里。
 */
export function saveSessionPfdbi(ctx: AppContext, projectId: string, analysis: PFDBIAnalysis): ProjectDetail {
  const detail = mustGet(ctx, projectId)
  detail.pfdbi = PFDBIAnalysisSchema.parse(analysis)
  markDirty(detail)
  return detail
}

/**
 * 写入安装目录 data/projects（或用户改过的项目库根）。
 */
export function saveSessionProject(ctx: AppContext, id: string): ProjectDetail {
  const current = mustGet(ctx, id)
  current.updatedAt = nowIso()
  const saved = persistProjectDetail(resolveProjectsRoot(ctx.repos), current)
  ctx.drafts.set(id, saved)
  return saved
}

/**
 * 把当前项目文件夹打成 zip。尚未落盘时先保存。
 */
export function exportSessionZip(ctx: AppContext, id: string, zipPath: string): string {
  const saved = saveSessionProject(ctx, id)
  if (!saved.folderPath) throw new Error('保存项目失败，无法导出')
  zipProjectFolder(saved.folderPath, zipPath)
  return zipPath
}

/**
 * 导入 zip 或旧版项目文件夹，复制进当前项目库。
 */
export function importSessionPackage(ctx: AppContext, sourcePath: string): ProjectDetail {
  const root = resolveProjectsRoot(ctx.repos)
  mkdirSync(root, { recursive: true })
    const temp = isProjectZip(sourcePath) ? mkdtempSync(join(tmpdir(), 'vdw-import-')) : null
  try {
    if (temp) unzipProjectPackage(sourcePath, temp)
    const bundleDir = temp ? resolveBundleRoot(temp) : sourcePath
    if (!isProjectBundle(bundleDir)) {
      throw new Error('这不是可导入的文案项目文件夹（需要含 项目.json）')
    }
    const bundle = readProjectBundle(bundleDir)
    const existingIds = new Set(listSessionProjects(ctx).map((item) => item.id))
    const id = bundle.id && !existingIds.has(bundle.id) ? bundle.id : createId('proj')
    const folder = uniqueBundleDir(root, bundle.title || bundle.topic)
    writeProjectBundleTo(folder, { ...bundle, id, updatedAt: nowIso() })
    const detail = loadProjectDetail(folder)
    detail.id = id
    ctx.drafts.set(id, detail)
    return detail
  } finally {
    if (temp) rmSync(temp, { recursive: true, force: true })
  }
}

/**
 * 删除内存稿；若已保存则同时删掉项目文件夹。
 */
export function removeSessionProject(ctx: AppContext, id: string): void {
  const detail = getSessionProject(ctx, id)
  ctx.drafts.delete(id)
  if (detail?.folderPath) {
    rmSync(detail.folderPath, { recursive: true, force: true })
  }
}

/**
 * 从路径读图进内存，不复制文件。
 */
function addMemoryImage(detail: ProjectDetail, sourcePath: string, sortOrder: number): ReferenceImageRecord | null {
  const filename = basename(sourcePath)
  if (!isSupportedImage(filename) && !isSupportedImage(sourcePath)) {
    throw new Error(`不支持的图片格式：${filename}`)
  }
  const image: ReferenceImageRecord = {
    id: createId('img'),
    projectId: detail.id,
    filename,
    hash: hashFile(sourcePath),
    sortOrder,
    role: 'primary' as ImageRole,
    vehicleLabel: '',
    comparisonNote: '',
    dataUrl: toDataUrl(sourcePath),
    annotations: [],
    sourcePath
  }
  detail.images.push(image)
  return image
}

function markDirty(detail: ProjectDetail): void {
  detail.saveStatus = detail.folderPath ? 'dirty' : 'unsaved'
  detail.updatedAt = nowIso()
}

function mustGet(ctx: AppContext, id: string): ProjectDetail {
  const detail = getSessionProject(ctx, id)
  if (!detail) throw new Error('项目不存在')
  return detail
}

function findProjectFolder(ctx: AppContext, id: string): string | null {
  for (const folder of listProjectFolders(resolveProjectsRoot(ctx.repos))) {
    try {
      if (readProjectRecord(folder).id === id) return folder
    } catch {
      // 跳过
    }
  }
  return null
}
