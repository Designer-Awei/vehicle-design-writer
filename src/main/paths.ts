import { app } from 'electron'
import { dirname, isAbsolute, join } from 'path'
import type { Repositories } from '@infrastructure/db/repositories'

export const PROJECTS_ROOT_SETTING = 'projects_root'

/**
 * 安装目录：打包后是 exe 所在文件夹（安装路径或便携目录），开发时是项目根目录。
 */
export function getInstallDir(): string {
  if (app.isPackaged) {
    return dirname(app.getPath('exe'))
  }
  return process.cwd()
}

/**
 * 已保存项目的默认根目录：安装目录/data/projects。
 */
export function getDefaultProjectsRoot(): string {
  return join(getInstallDir(), 'data', 'projects')
}

/**
 * 当前项目库根目录。只有用户主动改过才用设置值，默认始终跟当前安装目录走。
 */
export function resolveProjectsRoot(repos: Repositories): string {
  const stored = repos.getSetting(PROJECTS_ROOT_SETTING)?.trim()
  if (stored && isAbsolute(stored)) {
    return stored
  }
  return getDefaultProjectsRoot()
}
