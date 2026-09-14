import type {
  CommercialBrief,
  DurationProfile,
  ImageAnnotation,
  ImageRole,
  LlmSettings,
  PFDBIAnalysis,
  PlatformProfile,
  QualityReport,
  ScriptDraft,
  StyleProfile,
  StructureTemplate,
  ExampleCase,
  VisionObservation
} from '@schemas/index'

export type { ImageAnnotation }

export type AppMenuId = 'file' | 'edit' | 'view' | 'window' | 'help'

export interface WorkflowProgress {
  projectId?: string
  styleId?: string
  jobId?: string
  stage: string
  message: string
  percent: number
}

/** 按篇提取完成后、确认入库前的预览风格卡。 */
export interface StylePreviewCard {
  author: string
  platform: string
  category: string
  summary: string
  notes: string
  sourceFilename: string
  wordCount: number
  profile: StyleProfile
  templates: StructureTemplate[]
  examples: ExampleCase[]
}

export type StyleIngestJobStatus =
  | 'queued'
  | 'extracting'
  | 'completed'
  | 'failed'
  | 'ingested'

export interface StyleIngestJob {
  id: string
  filename: string
  wordCount: number
  status: StyleIngestJobStatus
  error: string | null
  progressPercent: number
  progressMessage: string
  preview: StylePreviewCard | null
  styleId: string | null
  createdAt: string
  updatedAt: string
}

export interface StyleIngestConfirmPatch {
  author: string
  category: string
  platform: string
  notes?: string
}

export interface TokenUsageItem {
  task: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  durationMs: number
  estimated: boolean
}

/** 已创建风格的可改档案字段。 */
export interface StyleMetadataPatch {
  name?: string
  platform?: string
  category?: string
  notes?: string
}

export interface StyleRecord {
  id: string
  name: string
  platform: string
  category: string
  notes: string
  isDemo: boolean
  createdAt: string
  updatedAt: string
}

export interface StyleDocumentRecord {
  id: string
  styleId: string
  filename: string
  wordCount: number
  parseStatus: 'ok' | 'failed'
  parseError: string | null
  createdAt: string
}

export interface StyleDetail extends StyleRecord {
  profile: StyleProfile | null
  templates: StructureTemplate[]
  examples: ExampleCase[]
  documents: StyleDocumentRecord[]
}

export type ProjectSaveStatus = 'unsaved' | 'dirty' | 'saved'

export interface ProjectRecord {
  id: string
  title: string
  topic: string
  draft: string
  platform: string
  durationSeconds: number
  contentType: string
  styleId: string | null
  commercial: CommercialBrief
  status: string
  facts: string
  createdAt: string
  updatedAt: string
  /** 已保存时指向 data/projects 下的项目文件夹。 */
  folderPath?: string | null
  /** 未保存 / 未更新 / 已保存。 */
  saveStatus?: ProjectSaveStatus
}

export interface ReferenceImageRecord {
  id: string
  projectId: string
  filename: string
  hash: string
  sortOrder: number
  role: ImageRole
  vehicleLabel: string
  comparisonNote: string
  dataUrl: string
  annotations: ImageAnnotation[]
  /** 本地源文件或已保存项目里的参考图路径。 */
  sourcePath?: string
}

export interface ImageMetadataPatch {
  role?: ImageRole
  vehicleLabel?: string
  comparisonNote?: string
}

export interface ScriptVersionRecord {
  id: string
  projectId: string
  version: number
  label: string
  content: string
  createdAt: string
}

export interface ProjectDetail extends ProjectRecord {
  images: ReferenceImageRecord[]
  visionObservations: VisionObservation[]
  pfdbi: PFDBIAnalysis | null
  baseDraft: ScriptDraft | null
  finalDraft: ScriptDraft | null
  quality: QualityReport | null
  matchedTemplate: {
    templateName: string
    reason: string
    styleId?: string | null
    styleName?: string
  } | null
  versions: ScriptVersionRecord[]
  usage: TokenUsageItem[]
}

export interface ScanFileResult {
  filename: string
  wordCount: number
  parseStatus: 'ok' | 'failed'
  parseError: string | null
}

export interface CreateProjectInput {
  topic: string
  draft: string
  facts?: string
  platform: string
  durationSeconds: number
  contentType: string
  styleId: string | null
  commercial?: CommercialBrief
  imagePaths?: string[]
}

export interface AppApi {
  settings: {
    get: () => Promise<LlmSettings>
    save: (input: {
      apiKey?: string
      baseUrl: string
      textModel: string
      visionModel: string
    }) => Promise<LlmSettings>
    pickProjectRoot: () => Promise<LlmSettings | null>
    resetProjectRoot: () => Promise<LlmSettings>
    openProjectRoot: () => Promise<string>
    listModels: () => Promise<string[]>
    getPlatforms: () => Promise<PlatformProfile[]>
    getDurations: () => Promise<DurationProfile[]>
    saveDuration: (profile: DurationProfile) => Promise<DurationProfile>
    probe: () => Promise<{
      text: { ok: boolean; model: string; preview: string; durationMs: number; error?: string }
      vision: { ok: boolean; model: string; preview: string; durationMs: number; error?: string }
    }>
  }
  styles: {
    list: () => Promise<StyleRecord[]>
    get: (id: string) => Promise<StyleDetail | null>
    create: (input: {
      name: string
      platform: string
      category: string
      notes: string
    }) => Promise<StyleRecord>
    createFromFolder: (input: {
      name: string
      platform: string
      category: string
      notes: string
    }) => Promise<{ style: StyleRecord; files: ScanFileResult[] } | null>
    importFolder: (styleId: string) => Promise<ScanFileResult[]>
    replaceFolder: (styleId: string) => Promise<ScanFileResult[] | null>
    extract: (styleId: string) => Promise<StyleDetail>
    update: (id: string, patch: StyleMetadataPatch) => Promise<StyleRecord>
    remove: (id: string) => Promise<void>
    ingestPick: () => Promise<StyleIngestJob[]>
    listJobs: () => Promise<StyleIngestJob[]>
    retryJob: (jobId: string) => Promise<StyleIngestJob>
    confirmJob: (jobId: string, patch: StyleIngestConfirmPatch) => Promise<StyleRecord>
    discardJob: (jobId: string) => Promise<void>
  }
  projects: {
    list: () => Promise<ProjectRecord[]>
    get: (id: string) => Promise<ProjectDetail | null>
    create: (input: CreateProjectInput) => Promise<ProjectDetail>
    update: (
      id: string,
      patch: Partial<CreateProjectInput> & { title?: string; finalScript?: string }
    ) => Promise<ProjectDetail>
    addImages: (projectId: string) => Promise<ReferenceImageRecord[]>
    removeImage: (imageId: string) => Promise<void>
    updateImage: (imageId: string, patch: ImageMetadataPatch) => Promise<ReferenceImageRecord>
    saveAnnotation: (annotation: ImageAnnotation) => Promise<ImageAnnotation>
    removeAnnotation: (annotationId: string) => Promise<void>
    analyzeVision: (projectId: string) => Promise<ProjectDetail>
    analyzePfdbi: (projectId: string) => Promise<ProjectDetail>
    savePfdbi: (projectId: string, analysis: PFDBIAnalysis) => Promise<ProjectDetail>
    generate: (projectId: string) => Promise<ProjectDetail>
    rewrite: (projectId: string, selectedText: string, instruction: string) => Promise<string>
    restoreVersion: (versionId: string) => Promise<ProjectDetail>
    save: (projectId: string) => Promise<ProjectDetail>
    export: (projectId: string, format: 'txt' | 'md') => Promise<string | null>
    exportBundle: (projectId: string) => Promise<string | null>
    importBundle: () => Promise<ProjectDetail | null>
    remove: (id: string) => Promise<void>
  }
  dialog: {
    pickFolder: () => Promise<string | null>
    pickImages: () => Promise<string[]>
    saveFile: (defaultName: string) => Promise<string | null>
  }
  menu: {
    popup: (id: AppMenuId, x: number, y: number) => Promise<void>
  }
  platform: 'win32' | 'darwin' | 'linux' | string
  onProgress: (handler: (progress: WorkflowProgress) => void) => () => void
}

export const IPC = {
  settingsGet: 'settings:get',
  settingsSave: 'settings:save',
  settingsPickProjectRoot: 'settings:pickProjectRoot',
  settingsResetProjectRoot: 'settings:resetProjectRoot',
  settingsOpenProjectRoot: 'settings:openProjectRoot',
  settingsModels: 'settings:models',
  settingsPlatforms: 'settings:platforms',
  settingsDurations: 'settings:durations',
  settingsSaveDuration: 'settings:saveDuration',
  settingsProbe: 'settings:probe',
  stylesList: 'styles:list',
  stylesGet: 'styles:get',
  stylesCreate: 'styles:create',
  stylesCreateFromFolder: 'styles:createFromFolder',
  stylesImportFolder: 'styles:importFolder',
  stylesReplaceFolder: 'styles:replaceFolder',
  stylesExtract: 'styles:extract',
  stylesUpdate: 'styles:update',
  stylesRemove: 'styles:remove',
  stylesIngestPick: 'styles:ingestPick',
  stylesJobsList: 'styles:jobsList',
  stylesJobRetry: 'styles:jobRetry',
  stylesJobConfirm: 'styles:jobConfirm',
  stylesJobDiscard: 'styles:jobDiscard',
  projectsList: 'projects:list',
  projectsGet: 'projects:get',
  projectsCreate: 'projects:create',
  projectsUpdate: 'projects:update',
  projectsAddImages: 'projects:addImages',
  projectsRemoveImage: 'projects:removeImage',
  projectsUpdateImage: 'projects:updateImage',
  projectsSaveAnnotation: 'projects:saveAnnotation',
  projectsRemoveAnnotation: 'projects:removeAnnotation',
  projectsAnalyzeVision: 'projects:analyzeVision',
  projectsAnalyzePfdbi: 'projects:analyzePfdbi',
  projectsSavePfdbi: 'projects:savePfdbi',
  projectsGenerate: 'projects:generate',
  projectsRewrite: 'projects:rewrite',
  projectsRestoreVersion: 'projects:restoreVersion',
  projectsSave: 'projects:save',
  projectsExport: 'projects:export',
  projectsExportBundle: 'projects:exportBundle',
  projectsImportBundle: 'projects:importBundle',
  projectsRemove: 'projects:remove',
  dialogFolder: 'dialog:folder',
  dialogImages: 'dialog:images',
  dialogSave: 'dialog:save',
  menuPopup: 'menu:popup',
  workflowProgress: 'workflow:progress'
} as const
