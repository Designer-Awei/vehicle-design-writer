import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type AppApi, type ImageAnnotation, type WorkflowProgress } from '@shared/ipc'

const api: AppApi = {
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    save: (input) => ipcRenderer.invoke(IPC.settingsSave, input),
    pickProjectRoot: () => ipcRenderer.invoke(IPC.settingsPickProjectRoot),
    resetProjectRoot: () => ipcRenderer.invoke(IPC.settingsResetProjectRoot),
    openProjectRoot: () => ipcRenderer.invoke(IPC.settingsOpenProjectRoot),
    listModels: () => ipcRenderer.invoke(IPC.settingsModels),
    getPlatforms: () => ipcRenderer.invoke(IPC.settingsPlatforms),
    getDurations: () => ipcRenderer.invoke(IPC.settingsDurations),
    saveDuration: (profile) => ipcRenderer.invoke(IPC.settingsSaveDuration, profile),
    probe: () => ipcRenderer.invoke(IPC.settingsProbe)
  },
  styles: {
    list: () => ipcRenderer.invoke(IPC.stylesList),
    get: (id) => ipcRenderer.invoke(IPC.stylesGet, id),
    create: (input) => ipcRenderer.invoke(IPC.stylesCreate, input),
    createFromFolder: (input) => ipcRenderer.invoke(IPC.stylesCreateFromFolder, input),
    importFolder: (styleId) => ipcRenderer.invoke(IPC.stylesImportFolder, styleId),
    replaceFolder: (styleId) => ipcRenderer.invoke(IPC.stylesReplaceFolder, styleId),
    extract: (styleId) => ipcRenderer.invoke(IPC.stylesExtract, styleId),
    update: (id, patch) => ipcRenderer.invoke(IPC.stylesUpdate, id, patch),
    remove: (id) => ipcRenderer.invoke(IPC.stylesRemove, id),
    ingestPick: () => ipcRenderer.invoke(IPC.stylesIngestPick),
    listJobs: () => ipcRenderer.invoke(IPC.stylesJobsList),
    retryJob: (jobId) => ipcRenderer.invoke(IPC.stylesJobRetry, jobId),
    confirmJob: (jobId, patch) => ipcRenderer.invoke(IPC.stylesJobConfirm, jobId, patch),
    discardJob: (jobId) => ipcRenderer.invoke(IPC.stylesJobDiscard, jobId)
  },
  projects: {
    list: () => ipcRenderer.invoke(IPC.projectsList),
    get: (id) => ipcRenderer.invoke(IPC.projectsGet, id),
    create: (input) => ipcRenderer.invoke(IPC.projectsCreate, input),
    update: (id, patch) => ipcRenderer.invoke(IPC.projectsUpdate, id, patch),
    addImages: (projectId) => ipcRenderer.invoke(IPC.projectsAddImages, projectId),
    removeImage: (imageId) => ipcRenderer.invoke(IPC.projectsRemoveImage, imageId),
    updateImage: (imageId, patch) => ipcRenderer.invoke(IPC.projectsUpdateImage, imageId, patch),
    saveAnnotation: (annotation: ImageAnnotation) =>
      ipcRenderer.invoke(IPC.projectsSaveAnnotation, annotation),
    removeAnnotation: (annotationId) =>
      ipcRenderer.invoke(IPC.projectsRemoveAnnotation, annotationId),
    analyzeVision: (projectId) => ipcRenderer.invoke(IPC.projectsAnalyzeVision, projectId),
    analyzePfdbi: (projectId) => ipcRenderer.invoke(IPC.projectsAnalyzePfdbi, projectId),
    savePfdbi: (projectId, analysis) => ipcRenderer.invoke(IPC.projectsSavePfdbi, projectId, analysis),
    generate: (projectId) => ipcRenderer.invoke(IPC.projectsGenerate, projectId),
    rewrite: (projectId, selectedText, instruction) =>
      ipcRenderer.invoke(IPC.projectsRewrite, projectId, selectedText, instruction),
    restoreVersion: (versionId) => ipcRenderer.invoke(IPC.projectsRestoreVersion, versionId),
    save: (projectId) => ipcRenderer.invoke(IPC.projectsSave, projectId),
    export: (projectId, format) => ipcRenderer.invoke(IPC.projectsExport, projectId, format),
    exportBundle: (projectId) => ipcRenderer.invoke(IPC.projectsExportBundle, projectId),
    importBundle: () => ipcRenderer.invoke(IPC.projectsImportBundle),
    remove: (id) => ipcRenderer.invoke(IPC.projectsRemove, id)
  },
  dialog: {
    pickFolder: () => ipcRenderer.invoke(IPC.dialogFolder),
    pickImages: () => ipcRenderer.invoke(IPC.dialogImages),
    saveFile: (defaultName) => ipcRenderer.invoke(IPC.dialogSave, defaultName)
  },
  menu: {
    popup: (id, x, y) => ipcRenderer.invoke(IPC.menuPopup, id, x, y)
  },
  platform: process.platform,
  onProgress: (handler: (progress: WorkflowProgress) => void) => {
    const listener = (_event: unknown, progress: WorkflowProgress): void => handler(progress)
    ipcRenderer.on(IPC.workflowProgress, listener)
    return () => {
      ipcRenderer.removeListener(IPC.workflowProgress, listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
