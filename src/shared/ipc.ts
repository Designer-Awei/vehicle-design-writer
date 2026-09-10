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

export interface WorkflowProgress {
  projectId?: string
  styleId?: string
  stage: string
  message: string
  percent: number
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
  createdAt: string
  updatedAt: string
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
  matchedTemplate: { templateName: string; reason: string } | null
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
    generate: (projectId: string) => Promise<ProjectDetail>
    rewrite: (projectId: string, selectedText: string, instruction: string) => Promise<string>
    restoreVersion: (versionId: string) => Promise<ProjectDetail>
    export: (projectId: string, format: 'txt' | 'md') => Promise<string | null>
    remove: (id: string) => Promise<void>
  }
  dialog: {
    pickFolder: () => Promise<string | null>
    pickImages: () => Promise<string[]>
    saveFile: (defaultName: string) => Promise<string | null>
  }
  onProgress: (handler: (progress: WorkflowProgress) => void) => () => void
}

export const IPC = {
  settingsGet: 'settings:get',
  settingsSave: 'settings:save',
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
  projectsGenerate: 'projects:generate',
  projectsRewrite: 'projects:rewrite',
  projectsRestoreVersion: 'projects:restoreVersion',
  projectsExport: 'projects:export',
  projectsRemove: 'projects:remove',
  dialogFolder: 'dialog:folder',
  dialogImages: 'dialog:images',
  dialogSave: 'dialog:save',
  workflowProgress: 'workflow:progress'
} as const
