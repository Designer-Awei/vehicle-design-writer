import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createId, nowIso } from '@domain/ids'
import { toDataUrl } from '@infrastructure/filesystem/image-store'
import type { CommercialBrief, ScriptDraft } from '@schemas/index'
import type { ProjectDetail, ProjectRecord, ProjectSaveStatus, ReferenceImageRecord } from '@shared/ipc'
import {
  isProjectBundle,
  PROJECT_EXPORT_LAYOUT,
  readProjectBundle,
  uniqueBundleDir,
  writeProjectBundleTo,
  type ProjectBundleContents
} from './project-bundle'

/** 新建项目用的空商业简报。 */
export const EMPTY_COMMERCIAL: CommercialBrief = {
  enabled: false,
  brand: '',
  model: '',
  goal: '',
  sellingPoints: [],
  mustInclude: [],
  mustAvoid: [],
  placement: 'narrative',
  cta: ''
}

/**
 * 列出项目库根目录下可识别的项目文件夹。
 */
export function listProjectFolders(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name))
    .filter((folder) => isProjectBundle(folder))
}

/**
 * 只读清单生成列表项，不把图片读进内存。
 */
export function readProjectRecord(folder: string): ProjectRecord {
  const filePath = join(folder, PROJECT_EXPORT_LAYOUT.manifestFile)
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as {
    id?: string
    title?: string
    topic?: string
    idea?: string
    draft?: string
    facts?: string
    platform?: string
    durationSeconds?: number
    contentType?: string
    script?: string
    createdAt?: string
    updatedAt?: string
  }
  const now = nowIso()
  const id = String(raw.id ?? '').trim() || ensureManifestId(folder, raw)
  const topic = String(raw.topic ?? '未命名选题')
  const title = String(raw.title ?? '').trim() || topic.slice(0, 40) || '未命名文案'
  return {
    id,
    title,
    topic,
    draft: String(raw.idea ?? raw.draft ?? ''),
    platform: String(raw.platform ?? 'B站'),
    durationSeconds: Number(raw.durationSeconds) || 300,
    contentType: String(raw.contentType ?? '车型解读'),
    styleId: null,
    commercial: EMPTY_COMMERCIAL,
    status: String(raw.script ?? '').trim() ? 'ready' : 'draft',
    facts: String(raw.facts ?? ''),
    createdAt: raw.createdAt ? String(raw.createdAt) : now,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : now,
    folderPath: folder,
    saveStatus: 'saved'
  }
}

/**
 * 从已保存的项目文件夹加载完整详情（含预览 data URL）。
 */
export function loadProjectDetail(folder: string): ProjectDetail {
  const bundle = readProjectBundle(folder)
  const id = bundle.id?.trim() || readProjectRecord(folder).id
  const now = nowIso()
  const createdAt = bundle.createdAt || now
  const updatedAt = bundle.updatedAt || now
  const images: ReferenceImageRecord[] = bundle.images.flatMap((image, index) => {
    if (!image.sourcePath) return []
    try {
      return [
        {
          id: image.id || createId('img'),
          projectId: id,
          filename: image.filename,
          hash: '',
          sortOrder: index,
          role: image.role,
          vehicleLabel: image.vehicleLabel,
          comparisonNote: image.comparisonNote,
          dataUrl: toDataUrl(image.sourcePath),
          annotations: [],
          sourcePath: image.sourcePath
        }
      ]
    } catch {
      return []
    }
  })
  const script = bundle.script
  const finalDraft: ScriptDraft | null = script.trim()
    ? { title: bundle.title, outline: [], script, pfdbiReferences: [] }
    : null
  return {
    id,
    title: bundle.title,
    topic: bundle.topic,
    draft: bundle.draft,
    platform: bundle.platform,
    durationSeconds: bundle.durationSeconds,
    contentType: bundle.contentType,
    styleId: null,
    commercial: EMPTY_COMMERCIAL,
    status: finalDraft ? 'ready' : 'draft',
    facts: bundle.facts,
    createdAt,
    updatedAt,
    folderPath: folder,
    saveStatus: 'saved' satisfies ProjectSaveStatus,
    images,
    visionObservations: [],
    pfdbi: bundle.pfdbi,
    baseDraft: null,
    finalDraft,
    quality: null,
    matchedTemplate: null,
    versions: [],
    usage: []
  }
}

/**
 * 按标题在项目库中新建或覆盖写入当前内容。
 */
export function persistProjectDetail(root: string, detail: ProjectDetail): ProjectDetail {
  mkdirSync(root, { recursive: true })
  const folder = detail.folderPath || uniqueBundleDir(root, detail.title || detail.topic)
  writeProjectBundleTo(folder, contentsFromDetail(detail))
  const saved = loadProjectDetail(folder)
  saved.id = detail.id
  saved.images = saved.images.map((image) => ({ ...image, projectId: detail.id }))
  saved.saveStatus = 'saved'
  return saved
}

/**
 * 把内存中的项目转成磁盘清单。
 */
export function contentsFromDetail(detail: ProjectDetail): ProjectBundleContents {
  return {
    id: detail.id,
    title: detail.title,
    topic: detail.topic,
    draft: detail.draft,
    facts: detail.facts,
    platform: detail.platform,
    durationSeconds: detail.durationSeconds,
    contentType: detail.contentType,
    pfdbi: detail.pfdbi,
    script: detail.finalDraft?.script ?? '',
    images: detail.images.map((image) => ({
      id: image.id,
      file: '',
      filename: image.filename,
      role: image.role,
      vehicleLabel: image.vehicleLabel,
      comparisonNote: image.comparisonNote,
      sourcePath: image.sourcePath,
      dataUrl: image.dataUrl
    })),
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt
  }
}

/**
 * 列表展示用的精简记录。
 */
export function toProjectRecord(detail: ProjectDetail): ProjectRecord {
  return {
    id: detail.id,
    title: detail.title,
    topic: detail.topic,
    draft: detail.draft,
    platform: detail.platform,
    durationSeconds: detail.durationSeconds,
    contentType: detail.contentType,
    styleId: detail.styleId,
    commercial: detail.commercial,
    status: detail.status,
    facts: detail.facts,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    folderPath: detail.folderPath ?? null,
    saveStatus: detail.saveStatus ?? 'unsaved'
  }
}

/**
 * 旧版清单没有 id 时补一个并写回，避免每次扫描都换号。
 */
function ensureManifestId(folder: string, raw: { id?: string }): string {
  const id = createId('proj')
  const filePath = join(folder, PROJECT_EXPORT_LAYOUT.manifestFile)
  writeFileSync(filePath, `${JSON.stringify({ ...raw, id }, null, 2)}\n`, 'utf8')
  return id
}
