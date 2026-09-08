import { createId, nowIso } from '@domain/ids'
import type {
  CommercialBrief,
  DurationProfile,
  ExampleCase,
  ImageAnnotation,
  PFDBIAnalysis,
  PlatformProfile,
  QualityReport,
  ScriptDraft,
  StyleProfile,
  StructureTemplate,
  VisionObservation
} from '@schemas/index'
import type {
  ProjectRecord,
  ReferenceImageRecord,
  ScriptVersionRecord,
  StyleDocumentRecord,
  StyleRecord,
  TokenUsageItem
} from '@shared/ipc'
import type { AppDatabase } from './database'

interface StyleRow {
  id: string
  name: string
  platform: string
  category: string
  notes: string
  is_demo: number
  created_at: string
  updated_at: string
}

interface ProjectRow {
  id: string
  title: string
  topic: string
  draft: string
  platform: string
  duration_seconds: number
  content_type: string
  style_id: string | null
  commercial_json: string
  status: string
  created_at: string
  updated_at: string
}

const defaultCommercial = (): CommercialBrief => ({
  enabled: false,
  brand: '',
  model: '',
  goal: '',
  sellingPoints: [],
  mustInclude: [],
  mustAvoid: [],
  placement: 'narrative',
  cta: ''
})

function mapStyle(row: StyleRow): StyleRecord {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    category: row.category,
    notes: row.notes,
    isDemo: row.is_demo === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    title: row.title,
    topic: row.topic,
    draft: row.draft,
    platform: row.platform,
    durationSeconds: row.duration_seconds,
    contentType: row.content_type,
    styleId: row.style_id,
    commercial: row.commercial_json
      ? (JSON.parse(row.commercial_json) as CommercialBrief)
      : defaultCommercial(),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/**
 * 所有持久化访问入口，渲染进程不得直接使用。
 */
export class Repositories {
  constructor(private readonly db: AppDatabase) {}

  getSetting(key: string): string | undefined {
    return this.db.get<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key])
      ?.value
  }

  setSetting(key: string, value: string): void {
    this.db.run(
      'INSERT INTO app_settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value]
    )
  }

  listStyles(): StyleRecord[] {
    return this.db.all<StyleRow>('SELECT * FROM styles ORDER BY updated_at DESC').map(mapStyle)
  }

  getStyle(id: string): StyleRecord | undefined {
    const row = this.db.get<StyleRow>('SELECT * FROM styles WHERE id = ?', [id])
    return row ? mapStyle(row) : undefined
  }

  upsertStyle(
    input: Omit<StyleRecord, 'createdAt' | 'updatedAt'> & { createdAt?: string }
  ): StyleRecord {
    const now = nowIso()
    const existing = this.getStyle(input.id)
    if (existing) {
      this.db.run(
        'UPDATE styles SET name=?, platform=?, category=?, notes=?, is_demo=?, updated_at=? WHERE id=?',
        [
          input.name,
          input.platform,
          input.category,
          input.notes,
          input.isDemo ? 1 : 0,
          now,
          input.id
        ]
      )
    } else {
      this.db.run(
        'INSERT INTO styles(id, name, platform, category, notes, is_demo, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?)',
        [
          input.id,
          input.name,
          input.platform,
          input.category,
          input.notes,
          input.isDemo ? 1 : 0,
          input.createdAt ?? now,
          now
        ]
      )
    }
    return this.getStyle(input.id) as StyleRecord
  }

  deleteStyle(id: string): void {
    this.db.run('DELETE FROM styles WHERE id = ?', [id])
  }

  listDocuments(styleId: string): StyleDocumentRecord[] {
    return this.db
      .all<{
        id: string
        style_id: string
        filename: string
        word_count: number
        parse_status: 'ok' | 'failed'
        parse_error: string | null
        created_at: string
      }>(
        'SELECT id, style_id, filename, word_count, parse_status, parse_error, created_at FROM style_documents WHERE style_id = ?',
        [styleId]
      )
      .map((row) => ({
        id: row.id,
        styleId: row.style_id,
        filename: row.filename,
        wordCount: row.word_count,
        parseStatus: row.parse_status,
        parseError: row.parse_error,
        createdAt: row.created_at
      }))
  }

  getDocumentContents(styleId: string): Array<{ id: string; filename: string; content: string }> {
    return this.db.all<{ id: string; filename: string; content: string }>(
      'SELECT id, filename, content FROM style_documents WHERE style_id = ? AND parse_status = ?',
      [styleId, 'ok']
    )
  }

  insertDocument(doc: {
    styleId: string
    filename: string
    content: string
    wordCount: number
    parseStatus: 'ok' | 'failed'
    parseError: string | null
  }): StyleDocumentRecord {
    const id = createId('doc')
    const createdAt = nowIso()
    this.db.run(
      'INSERT INTO style_documents(id, style_id, filename, content, word_count, parse_status, parse_error, created_at) VALUES(?,?,?,?,?,?,?,?)',
      [
        id,
        doc.styleId,
        doc.filename,
        doc.content,
        doc.wordCount,
        doc.parseStatus,
        doc.parseError,
        createdAt
      ]
    )
    return {
      id,
      styleId: doc.styleId,
      filename: doc.filename,
      wordCount: doc.wordCount,
      parseStatus: doc.parseStatus,
      parseError: doc.parseError,
      createdAt
    }
  }

  saveStyleProfile(styleId: string, profile: StyleProfile): void {
    const id = createId('profile')
    this.db.run('DELETE FROM style_profiles WHERE style_id = ?', [styleId])
    this.db.run('INSERT INTO style_profiles(id, style_id, json, created_at) VALUES(?,?,?,?)', [
      id,
      styleId,
      JSON.stringify(profile),
      nowIso()
    ])
  }

  getStyleProfile(styleId: string): StyleProfile | null {
    const row = this.db.get<{ json: string }>(
      'SELECT json FROM style_profiles WHERE style_id = ?',
      [styleId]
    )
    return row ? (JSON.parse(row.json) as StyleProfile) : null
  }

  replaceTemplates(styleId: string, templates: StructureTemplate[]): void {
    this.db.run('DELETE FROM style_structure_templates WHERE style_id = ?', [styleId])
    for (const template of templates) {
      this.db.run('INSERT INTO style_structure_templates(id, style_id, json) VALUES(?,?,?)', [
        createId('tpl'),
        styleId,
        JSON.stringify(template)
      ])
    }
  }

  listTemplates(styleId: string): StructureTemplate[] {
    return this.db
      .all<{ json: string }>('SELECT json FROM style_structure_templates WHERE style_id = ?', [
        styleId
      ])
      .map((row) => JSON.parse(row.json) as StructureTemplate)
  }

  replaceExamples(styleId: string, examples: ExampleCase[]): void {
    this.db.run('DELETE FROM style_examples WHERE style_id = ?', [styleId])
    for (const example of examples) {
      this.db.run('INSERT INTO style_examples(id, style_id, json) VALUES(?,?,?)', [
        createId('ex'),
        styleId,
        JSON.stringify(example)
      ])
    }
  }

  listExamples(styleId: string): ExampleCase[] {
    return this.db
      .all<{ json: string }>('SELECT json FROM style_examples WHERE style_id = ?', [styleId])
      .map((row) => JSON.parse(row.json) as ExampleCase)
  }

  listProjects(): ProjectRecord[] {
    return this.db
      .all<ProjectRow>('SELECT * FROM projects ORDER BY updated_at DESC')
      .map(mapProject)
  }

  getProject(id: string): ProjectRecord | undefined {
    const row = this.db.get<ProjectRow>('SELECT * FROM projects WHERE id = ?', [id])
    return row ? mapProject(row) : undefined
  }

  upsertProject(input: ProjectRecord): ProjectRecord {
    const existing = this.getProject(input.id)
    const commercial = JSON.stringify(input.commercial)
    if (existing) {
      this.db.run(
        `UPDATE projects SET title=?, topic=?, draft=?, platform=?, duration_seconds=?, content_type=?, style_id=?, commercial_json=?, status=?, updated_at=? WHERE id=?`,
        [
          input.title,
          input.topic,
          input.draft,
          input.platform,
          input.durationSeconds,
          input.contentType,
          input.styleId,
          commercial,
          input.status,
          nowIso(),
          input.id
        ]
      )
    } else {
      this.db.run(
        `INSERT INTO projects(id, title, topic, draft, platform, duration_seconds, content_type, style_id, commercial_json, status, created_at, updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          input.id,
          input.title,
          input.topic,
          input.draft,
          input.platform,
          input.durationSeconds,
          input.contentType,
          input.styleId,
          commercial,
          input.status,
          input.createdAt,
          input.updatedAt
        ]
      )
    }
    return this.getProject(input.id) as ProjectRecord
  }

  deleteProject(id: string): void {
    this.db.run('DELETE FROM projects WHERE id = ?', [id])
  }

  insertImage(image: {
    id?: string
    projectId: string
    path: string
    filename: string
    hash: string
    sortOrder: number
  }): { id: string; createdAt: string } {
    const id = image.id ?? createId('img')
    const createdAt = nowIso()
    this.db.run(
      'INSERT INTO reference_images(id, project_id, path, filename, hash, sort_order, created_at) VALUES(?,?,?,?,?,?,?)',
      [id, image.projectId, image.path, image.filename, image.hash, image.sortOrder, createdAt]
    )
    return { id, createdAt }
  }

  listImages(projectId: string): Array<{
    id: string
    projectId: string
    path: string
    filename: string
    hash: string
    sortOrder: number
  }> {
    return this.db
      .all<{
        id: string
        project_id: string
        path: string
        filename: string
        hash: string
        sort_order: number
      }>('SELECT * FROM reference_images WHERE project_id = ? ORDER BY sort_order ASC', [projectId])
      .map((row) => ({
        id: row.id,
        projectId: row.project_id,
        path: row.path,
        filename: row.filename,
        hash: row.hash,
        sortOrder: row.sort_order
      }))
  }

  getImage(
    id: string
  ): { id: string; projectId: string; path: string; filename: string; hash: string } | undefined {
    const row = this.db.get<{
      id: string
      project_id: string
      path: string
      filename: string
      hash: string
    }>('SELECT * FROM reference_images WHERE id = ?', [id])
    if (!row) return undefined
    return {
      id: row.id,
      projectId: row.project_id,
      path: row.path,
      filename: row.filename,
      hash: row.hash
    }
  }

  deleteImage(id: string): void {
    this.db.run('DELETE FROM image_annotations WHERE image_id = ?', [id])
    this.db.run('DELETE FROM reference_images WHERE id = ?', [id])
  }

  listAnnotations(imageId: string): ImageAnnotation[] {
    return this.db
      .all<{
        id: string
        image_id: string
        x: number
        y: number
        width: number
        height: number
        note: string
      }>('SELECT * FROM image_annotations WHERE image_id = ?', [imageId])
      .map((row) => ({
        id: row.id,
        imageId: row.image_id,
        x: row.x,
        y: row.y,
        width: row.width,
        height: row.height,
        note: row.note
      }))
  }

  saveAnnotation(annotation: ImageAnnotation): ImageAnnotation {
    const id = annotation.id ?? createId('ann')
    this.db.run('DELETE FROM image_annotations WHERE id = ?', [id])
    this.db.run(
      'INSERT INTO image_annotations(id, image_id, x, y, width, height, note) VALUES(?,?,?,?,?,?,?)',
      [
        id,
        annotation.imageId,
        annotation.x,
        annotation.y,
        annotation.width,
        annotation.height,
        annotation.note
      ]
    )
    return { ...annotation, id }
  }

  saveVision(
    projectId: string,
    imageId: string,
    observation: VisionObservation,
    cacheKey: string
  ): void {
    this.db.run('DELETE FROM vision_observations WHERE image_id = ?', [imageId])
    this.db.run(
      'INSERT INTO vision_observations(id, project_id, image_id, json, cache_key, created_at) VALUES(?,?,?,?,?,?)',
      [createId('vis'), projectId, imageId, JSON.stringify(observation), cacheKey, nowIso()]
    )
  }

  getVisionByCache(cacheKey: string): VisionObservation | undefined {
    const row = this.db.get<{ json: string }>(
      'SELECT json FROM vision_observations WHERE cache_key = ?',
      [cacheKey]
    )
    return row ? (JSON.parse(row.json) as VisionObservation) : undefined
  }

  listVision(projectId: string): VisionObservation[] {
    return this.db
      .all<{ json: string }>('SELECT json FROM vision_observations WHERE project_id = ?', [
        projectId
      ])
      .map((row) => JSON.parse(row.json) as VisionObservation)
  }

  savePfdbi(projectId: string, analysis: PFDBIAnalysis, cacheKey: string): void {
    this.db.run('DELETE FROM pfdbi_analyses WHERE project_id = ?', [projectId])
    this.db.run(
      'INSERT INTO pfdbi_analyses(id, project_id, json, cache_key, created_at) VALUES(?,?,?,?,?)',
      [createId('pfdbi'), projectId, JSON.stringify(analysis), cacheKey, nowIso()]
    )
  }

  getPfdbiByCache(cacheKey: string): PFDBIAnalysis | undefined {
    const row = this.db.get<{ json: string }>(
      'SELECT json FROM pfdbi_analyses WHERE cache_key = ?',
      [cacheKey]
    )
    return row ? (JSON.parse(row.json) as PFDBIAnalysis) : undefined
  }

  getPfdbi(projectId: string): PFDBIAnalysis | null {
    const row = this.db.get<{ json: string }>(
      'SELECT json FROM pfdbi_analyses WHERE project_id = ?',
      [projectId]
    )
    return row ? (JSON.parse(row.json) as PFDBIAnalysis) : null
  }

  saveScript(projectId: string, kind: 'base' | 'final' | 'quality' | 'match', json: unknown): void {
    this.db.run('DELETE FROM scripts WHERE project_id = ? AND kind = ?', [projectId, kind])
    this.db.run('INSERT INTO scripts(id, project_id, kind, json, created_at) VALUES(?,?,?,?,?)', [
      createId('script'),
      projectId,
      kind,
      JSON.stringify(json),
      nowIso()
    ])
  }

  getScript<T>(projectId: string, kind: 'base' | 'final' | 'quality' | 'match'): T | null {
    const row = this.db.get<{ json: string }>(
      'SELECT json FROM scripts WHERE project_id = ? AND kind = ?',
      [projectId, kind]
    )
    return row ? (JSON.parse(row.json) as T) : null
  }

  nextVersion(projectId: string): number {
    const row = this.db.get<{ v: number }>(
      'SELECT COALESCE(MAX(version), 0) as v FROM script_versions WHERE project_id = ?',
      [projectId]
    )
    return (row?.v ?? 0) + 1
  }

  addVersion(projectId: string, label: string, content: string): ScriptVersionRecord {
    const version = this.nextVersion(projectId)
    const id = createId('ver')
    const createdAt = nowIso()
    this.db.run(
      'INSERT INTO script_versions(id, project_id, version, label, content, created_at) VALUES(?,?,?,?,?,?)',
      [id, projectId, version, label, content, createdAt]
    )
    return { id, projectId, version, label, content, createdAt }
  }

  listVersions(projectId: string): ScriptVersionRecord[] {
    return this.db
      .all<{
        id: string
        project_id: string
        version: number
        label: string
        content: string
        created_at: string
      }>('SELECT * FROM script_versions WHERE project_id = ? ORDER BY version DESC', [projectId])
      .map((row) => ({
        id: row.id,
        projectId: row.project_id,
        version: row.version,
        label: row.label,
        content: row.content,
        createdAt: row.created_at
      }))
  }

  getVersion(id: string): ScriptVersionRecord | undefined {
    const row = this.db.get<{
      id: string
      project_id: string
      version: number
      label: string
      content: string
      created_at: string
    }>('SELECT * FROM script_versions WHERE id = ?', [id])
    if (!row) return undefined
    return {
      id: row.id,
      projectId: row.project_id,
      version: row.version,
      label: row.label,
      content: row.content,
      createdAt: row.created_at
    }
  }

  addUsage(item: TokenUsageItem & { projectId?: string }): void {
    this.db.run(
      `INSERT INTO llm_usage(id, project_id, task, model, prompt_tokens, completion_tokens, total_tokens, duration_ms, estimated, created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [
        createId('usage'),
        item.projectId ?? null,
        item.task,
        item.model,
        item.promptTokens,
        item.completionTokens,
        item.totalTokens,
        item.durationMs,
        item.estimated ? 1 : 0,
        nowIso()
      ]
    )
  }

  listUsage(projectId: string): TokenUsageItem[] {
    return this.db
      .all<{
        task: string
        model: string
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
        duration_ms: number
        estimated: number
      }>(
        'SELECT task, model, prompt_tokens, completion_tokens, total_tokens, duration_ms, estimated FROM llm_usage WHERE project_id = ?',
        [projectId]
      )
      .map((row) => ({
        task: row.task,
        model: row.model,
        promptTokens: row.prompt_tokens,
        completionTokens: row.completion_tokens,
        totalTokens: row.total_tokens,
        durationMs: row.duration_ms,
        estimated: row.estimated === 1
      }))
  }

  upsertPlatform(profile: PlatformProfile): void {
    this.db.run(
      'INSERT INTO platform_profiles(platform, json) VALUES(?, ?) ON CONFLICT(platform) DO UPDATE SET json = excluded.json',
      [profile.platform, JSON.stringify(profile)]
    )
  }

  listPlatforms(): PlatformProfile[] {
    return this.db
      .all<{ json: string }>('SELECT json FROM platform_profiles')
      .map((row) => JSON.parse(row.json) as PlatformProfile)
  }

  upsertDuration(profile: DurationProfile): void {
    this.db.run(
      'INSERT INTO duration_profiles(id, json) VALUES(?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json',
      [profile.id, JSON.stringify(profile)]
    )
  }

  listDurations(): DurationProfile[] {
    return this.db
      .all<{ json: string }>('SELECT json FROM duration_profiles')
      .map((row) => JSON.parse(row.json) as DurationProfile)
  }

  countStyles(): number {
    return this.db.get<{ c: number }>('SELECT COUNT(*) as c FROM styles')?.c ?? 0
  }
}

export type { ScriptDraft, QualityReport, ReferenceImageRecord }
