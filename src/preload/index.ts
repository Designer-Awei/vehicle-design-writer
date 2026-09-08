import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type AppApi, type ImageAnnotation, type WorkflowProgress } from '@shared/ipc'

const api: AppApi = {
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    save: (input) => ipcRenderer.invoke(IPC.settingsSave, input),
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
    importFolder: (styleId) => ipcRenderer.invoke(IPC.stylesImportFolder, styleId),
    extract: (styleId) => ipcRenderer.invoke(IPC.stylesExtract, styleId),
    remove: (id) => ipcRenderer.invoke(IPC.stylesRemove, id)
  },
  projects: {
    list: () => ipcRenderer.invoke(IPC.projectsList),
    get: (id) => ipcRenderer.invoke(IPC.projectsGet, id),
    create: (input) => ipcRenderer.invoke(IPC.projectsCreate, input),
    update: (id, patch) => ipcRenderer.invoke(IPC.projectsUpdate, id, patch),
    addImages: (projectId) => ipcRenderer.invoke(IPC.projectsAddImages, projectId),
    removeImage: (imageId) => ipcRenderer.invoke(IPC.projectsRemoveImage, imageId),
    saveAnnotation: (annotation: ImageAnnotation) =>
      ipcRenderer.invoke(IPC.projectsSaveAnnotation, annotation),
    generate: (projectId) => ipcRenderer.invoke(IPC.projectsGenerate, projectId),
    rewrite: (projectId, selectedText, instruction) =>
      ipcRenderer.invoke(IPC.projectsRewrite, projectId, selectedText, instruction),
    restoreVersion: (versionId) => ipcRenderer.invoke(IPC.projectsRestoreVersion, versionId),
    export: (projectId, format) => ipcRenderer.invoke(IPC.projectsExport, projectId, format),
    remove: (id) => ipcRenderer.invoke(IPC.projectsRemove, id)
  },
  dialog: {
    pickFolder: () => ipcRenderer.invoke(IPC.dialogFolder),
    pickImages: () => ipcRenderer.invoke(IPC.dialogImages),
    saveFile: (defaultName) => ipcRenderer.invoke(IPC.dialogSave, defaultName)
  },
  onProgress: (handler: (progress: WorkflowProgress) => void) => {
    const listener = (_event: unknown, progress: WorkflowProgress): void => handler(progress)
    ipcRenderer.on(IPC.workflowProgress, listener)
    return () => {
      ipcRenderer.removeListener(IPC.workflowProgress, listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
