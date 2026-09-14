import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { basename, extname, join } from 'path'
import { pfdbiFromNotes, notesFromPfdbi, PFDBI_KEYS, type PfdbiKey } from '@shared/pfdbi-notes'
import type { ImageRole, PFDBIAnalysis } from '@schemas/index'

export const PROJECT_BUNDLE_FORMAT = 'vehicle-design-writer-project'
export const PROJECT_BUNDLE_VERSION = 3

/**
 * 现行导出约定：一份 JSON 清单 + 参考图子文件夹。
 */
export const PROJECT_EXPORT_LAYOUT = {
  imagesDir: '参考图',
  manifestFile: '项目.json'
} as const

/** 上一版拆成多个 txt，导入时仍可读。 */
const LEGACY_EXPORT_FILES = {
  topicFile: '选题.txt',
  ideaFile: '初步想法.txt',
  factsFile: '事实补充.txt',
  pfdbiFile: 'PFDBI分析.txt',
  draftFile: '初稿文案.txt'
} as const

export interface ProjectBundleImage {
  id?: string
  file: string
  filename: string
  role: ImageRole
  vehicleLabel: string
  comparisonNote: string
}

export interface ProjectBundlePfdbiNotes {
  P: string
  F: string
  D: string
  B: string
  I: string
}

/**
 * 导出清单：索引（标题、时长、图片角色）和文案内容都写在这一份 JSON 里。
 */
export interface ProjectBundleManifest {
  format: typeof PROJECT_BUNDLE_FORMAT
  formatVersion: number
  id: string
  title: string
  topic: string
  idea: string
  facts: string
  platform: string
  durationSeconds: number
  contentType: string
  pfdbi: ProjectBundlePfdbiNotes
  script: string
  images: ProjectBundleImage[]
  createdAt?: string
  updatedAt?: string
}

export interface ProjectBundleContents {
  id?: string
  title: string
  topic: string
  draft: string
  facts: string
  platform: string
  durationSeconds: number
  contentType: string
  pfdbi: PFDBIAnalysis | null
  script: string
  images: Array<ProjectBundleImage & { sourcePath?: string; dataUrl?: string }>
  createdAt?: string
  updatedAt?: string
}

const PFDBI_HEADING = /^([PFDBI])\s/u

/**
 * 去掉 Windows 文件夹不允许的字符。
 */
export function sanitizeFolderName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/gu, ' ').replace(/\s+/gu, ' ').trim()
  return cleaned.slice(0, 60) || '未命名文案'
}

/**
 * 把人写 PFDBI 收成清单里的五维正文。
 */
export function pfdbiNotesFromAnalysis(pfdbi: PFDBIAnalysis | null): ProjectBundlePfdbiNotes {
  return notesFromPfdbi(pfdbi)
}

/**
 * 从清单里的五维正文还原 PFDBI。
 */
export function pfdbiFromManifestNotes(
  topic: string,
  notes: ProjectBundlePfdbiNotes | null | undefined
): PFDBIAnalysis | null {
  if (!notes) return null
  const normalized: ProjectBundlePfdbiNotes = {
    P: notes.P?.trim() ?? '',
    F: notes.F?.trim() ?? '',
    D: notes.D?.trim() ?? '',
    B: notes.B?.trim() ?? '',
    I: notes.I?.trim() ?? ''
  }
  const hasAny = PFDBI_KEYS.some((key) => normalized[key])
  return hasAny ? pfdbiFromNotes(topic, normalized, null) : null
}

/**
 * 从上一版 PFDBI 文本还原五维观察。
 */
export function parsePfdbiText(text: string, topic: string): PFDBIAnalysis | null {
  const trimmed = text.trim()
  if (!trimmed || trimmed === '（空）') return null
  const notes: ProjectBundlePfdbiNotes = { P: '', F: '', D: '', B: '', I: '' }
  let current: PfdbiKey | null = null
  const chunks: string[] = []
  const flush = (): void => {
    if (!current) return
    const body = chunks.join('\n').trim()
    notes[current] = body === '（空）' ? '' : body
    chunks.length = 0
  }
  for (const line of trimmed.split(/\r?\n/u)) {
    const match = line.match(PFDBI_HEADING)
    if (match && PFDBI_KEYS.includes(match[1] as PfdbiKey)) {
      flush()
      current = match[1] as PfdbiKey
      continue
    }
    if (current) chunks.push(line)
  }
  flush()
  return pfdbiFromManifestNotes(topic, notes)
}

/**
 * 在父目录下按标题新建项目文件夹并写入材料。
 */
export function writeProjectBundle(parentDir: string, contents: ProjectBundleContents): string {
  mkdirSync(parentDir, { recursive: true })
  const folder = uniqueBundleDir(parentDir, contents.title || contents.topic)
  writeProjectBundleTo(folder, contents)
  return folder
}

/**
 * 把项目材料写入指定文件夹（覆盖参考图目录和项目.json）。
 */
export function writeProjectBundleTo(folder: string, contents: ProjectBundleContents): string {
  mkdirSync(folder, { recursive: true })
  const imagesDir = join(folder, PROJECT_EXPORT_LAYOUT.imagesDir)
  const staged = contents.images.map((image) => ({
    image,
    ext: inferImageExt(image),
    bytes: readImageBytes(image)
  }))
  rmSync(imagesDir, { recursive: true, force: true })
  mkdirSync(imagesDir, { recursive: true })
  const images: ProjectBundleImage[] = []
  staged.forEach((item, index) => {
    if (!item.bytes) return
    const file = `${String(index + 1).padStart(2, '0')}${item.ext}`
    writeFileSync(join(imagesDir, file), item.bytes)
    images.push({
      id: item.image.id,
      file,
      filename: item.image.filename,
      role: item.image.role,
      vehicleLabel: item.image.vehicleLabel,
      comparisonNote: item.image.comparisonNote
    })
  })
  const manifest: ProjectBundleManifest = {
    format: PROJECT_BUNDLE_FORMAT,
    formatVersion: PROJECT_BUNDLE_VERSION,
    id: contents.id ?? '',
    title: contents.title,
    topic: contents.topic,
    idea: contents.draft,
    facts: contents.facts,
    platform: contents.platform,
    durationSeconds: contents.durationSeconds,
    contentType: contents.contentType,
    pfdbi: pfdbiNotesFromAnalysis(contents.pfdbi),
    script: contents.script,
    images,
    createdAt: contents.createdAt,
    updatedAt: contents.updatedAt
  }
  writeFileSync(
    join(folder, PROJECT_EXPORT_LAYOUT.manifestFile),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  )
  return folder
}

/**
 * 读取导出文件夹。现行包只读 项目.json；上一版多个 txt 仍可导入。
 */
export function readProjectBundle(folder: string): ProjectBundleContents {
  if (!existsSync(folder)) {
    throw new Error('找不到要导入的文件夹')
  }
  const manifest = readManifest(folder)
  const fromManifest = (manifest?.formatVersion ?? 0) >= 2
  const topic =
    (fromManifest ? manifest?.topic : firstText(manifest?.topic, readText(join(folder, LEGACY_EXPORT_FILES.topicFile)))) ||
    ''
  if (!topic.trim() && !manifest) {
    throw new Error('这不是可导入的文案项目文件夹（缺少 项目.json）')
  }
  const imagesDir = join(folder, PROJECT_EXPORT_LAYOUT.imagesDir)
  const listed = manifest?.images?.length ? manifest.images : inferImages(imagesDir)
  const images = listed.flatMap((item) => {
    const sourcePath = join(imagesDir, item.file)
    if (!existsSync(sourcePath)) return []
    return [{ ...item, sourcePath }]
  })
  const idea = fromManifest
    ? (manifest?.idea ?? '')
    : firstText(manifest?.idea, readText(join(folder, LEGACY_EXPORT_FILES.ideaFile)))
  const facts = fromManifest
    ? (manifest?.facts ?? '')
    : firstText(manifest?.facts, readText(join(folder, LEGACY_EXPORT_FILES.factsFile)))
  const script = fromManifest
    ? (manifest?.script ?? '')
    : firstText(manifest?.script, readText(join(folder, LEGACY_EXPORT_FILES.draftFile)))
  const pfdbi = fromManifest
    ? pfdbiFromManifestNotes(topic || manifest?.topic || '', manifest?.pfdbi)
    : pfdbiFromManifestNotes(topic || manifest?.topic || '', manifest?.pfdbi) ??
      parsePfdbiText(readText(join(folder, LEGACY_EXPORT_FILES.pfdbiFile)), topic || manifest?.topic || '')
  return {
    id: manifest?.id || undefined,
    title: manifest?.title || topic.slice(0, 40) || '导入的文案',
    topic: topic || manifest?.topic || '未命名选题',
    draft: idea,
    facts,
    platform: manifest?.platform || 'B站',
    durationSeconds: manifest?.durationSeconds || 300,
    contentType: manifest?.contentType || '车型解读',
    pfdbi,
    script,
    images,
    createdAt: manifest?.createdAt,
    updatedAt: manifest?.updatedAt
  }
}

/**
 * 判断文件夹是否像一份导出包。
 */
export function isProjectBundle(folder: string): boolean {
  return (
    existsSync(join(folder, PROJECT_EXPORT_LAYOUT.manifestFile)) ||
    existsSync(join(folder, LEGACY_EXPORT_FILES.topicFile))
  )
}

/**
 * 在父目录下生成不冲突的项目文件夹路径。
 */
export function uniqueBundleDir(parentDir: string, title: string): string {
  const base = sanitizeFolderName(title)
  const first = join(parentDir, base)
  if (!existsSync(first)) return first
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-').slice(0, 19)
  let folder = join(parentDir, `${base}-${stamp}`)
  let n = 2
  while (existsSync(folder)) {
    folder = join(parentDir, `${base}-${stamp}-${n}`)
    n += 1
  }
  return folder
}

function readText(filePath: string): string {
  if (!existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, '')
}

function firstText(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value != null && value !== '') return value
  }
  return ''
}

function readManifest(folder: string): ProjectBundleManifest | null {
  const filePath = join(folder, PROJECT_EXPORT_LAYOUT.manifestFile)
  if (!existsSync(filePath)) return null
  const raw = JSON.parse(readText(filePath)) as Partial<ProjectBundleManifest> & { draft?: string }
  if (raw.format && raw.format !== PROJECT_BUNDLE_FORMAT) {
    throw new Error('项目.json 格式不匹配')
  }
  return {
    format: PROJECT_BUNDLE_FORMAT,
    formatVersion: Number(raw.formatVersion) || 1,
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    topic: String(raw.topic ?? ''),
    idea: String(raw.idea ?? raw.draft ?? ''),
    facts: String(raw.facts ?? ''),
    platform: String(raw.platform ?? 'B站'),
    durationSeconds: Number(raw.durationSeconds) || 300,
    contentType: String(raw.contentType ?? '车型解读'),
    pfdbi: normalizePfdbiNotes(raw.pfdbi),
    script: String(raw.script ?? ''),
    images: Array.isArray(raw.images) ? raw.images.map(normalizeImageMeta) : [],
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined
  }
}

function normalizePfdbiNotes(value: unknown): ProjectBundlePfdbiNotes {
  const empty: ProjectBundlePfdbiNotes = { P: '', F: '', D: '', B: '', I: '' }
  if (!value || typeof value !== 'object') return empty
  const record = value as Record<string, unknown>
  const first = record.P
  if (first && typeof first === 'object' && !Array.isArray(first)) {
    return notesFromPfdbi(value as PFDBIAnalysis)
  }
  return {
    P: String(record.P ?? ''),
    F: String(record.F ?? ''),
    D: String(record.D ?? ''),
    B: String(record.B ?? ''),
    I: String(record.I ?? '')
  }
}

function normalizeImageMeta(item: Partial<ProjectBundleImage>): ProjectBundleImage {
  return {
    id: item.id ? String(item.id) : undefined,
    file: String(item.file ?? ''),
    filename: String(item.filename ?? item.file ?? ''),
    role: item.role === 'other' ? 'other' : 'primary',
    vehicleLabel: String(item.vehicleLabel ?? ''),
    comparisonNote: String(item.comparisonNote ?? '')
  }
}

/**
 * 先读出图片字节，避免覆盖保存时源文件就在即将清空的 参考图/ 里。
 */
function readImageBytes(image: { sourcePath?: string; dataUrl?: string }): Buffer | null {
  if (image.sourcePath && existsSync(image.sourcePath)) {
    return readFileSync(image.sourcePath)
  }
  if (image.dataUrl?.startsWith('data:')) {
    const comma = image.dataUrl.indexOf(',')
    if (comma < 0) return null
    return Buffer.from(image.dataUrl.slice(comma + 1), 'base64')
  }
  return null
}

/**
 * 根据源路径或 data URL 推断图片后缀。
 */
function inferImageExt(image: { sourcePath?: string; filename?: string; dataUrl?: string }): string {
  const fromPath = extname(image.sourcePath ?? '').toLowerCase() || extname(image.filename ?? '').toLowerCase()
  if (fromPath) return fromPath
  const mime = image.dataUrl?.match(/^data:image\/([\w+.-]+);/u)?.[1]?.toLowerCase()
  if (mime === 'jpeg' || mime === 'jpg') return '.jpg'
  if (mime === 'webp') return '.webp'
  return '.png'
}

function inferImages(imagesDir: string): ProjectBundleImage[] {
  if (!existsSync(imagesDir)) return []
  return readdirSync(imagesDir)
    .filter((name) => ['.png', '.jpg', '.jpeg', '.webp'].includes(extname(name).toLowerCase()))
    .sort()
    .map((name) => ({
      file: name,
      filename: basename(name),
      role: 'primary' as ImageRole,
      vehicleLabel: '',
      comparisonNote: ''
    }))
}
