import { copyFileSync, mkdirSync, readFileSync, rmSync, unlinkSync } from 'fs'
import { extname, isAbsolute, join, relative, resolve } from 'path'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
}

/**
 * 某个文案项目在参考图根目录下的子文件夹。
 */
export function projectImageDir(imageRoot: string, projectId: string): string {
  return join(imageRoot, projectId)
}

/**
 * 把参考图复制到当前根目录/{projectId}/{imageId}.ext，不改动用户原文件。
 */
export function storeImage(
  imageRoot: string,
  projectId: string,
  imageId: string,
  sourcePath: string
): string {
  const dir = projectImageDir(imageRoot, projectId)
  mkdirSync(dir, { recursive: true })
  const target = join(dir, `${imageId}${extname(sourcePath).toLowerCase()}`)
  copyFileSync(sourcePath, target)
  return target
}

/**
 * 删除单张已复制的参考图；文件不存在时忽略。
 */
export function removeStoredImage(filePath: string): void {
  try {
    unlinkSync(filePath)
  } catch {
    // 原复制件可能已被人从磁盘挪走
  }
}

/**
 * 判断路径是否落在参考图存储根内（上传复制件），导入时引用的原文件夹不算。
 */
export function isManagedImagePath(imageRoot: string, filePath: string): boolean {
  const root = resolve(imageRoot)
  const target = resolve(filePath)
  const rel = relative(root, target)
  return Boolean(rel) && !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * 只删除软件自己复制的参考图，不碰用户导入文件夹里的原文件。
 */
export function removeManagedImage(imageRoot: string, filePath: string): void {
  if (!isManagedImagePath(imageRoot, filePath)) return
  removeStoredImage(filePath)
}

/**
 * 删除一个项目的参考图文件夹。
 */
export function removeProjectImages(imageRoot: string, projectId: string): void {
  rmSync(projectImageDir(imageRoot, projectId), { recursive: true, force: true })
}

/**
 * 读取本地图片为 data URL，供预览使用。不把 base64 写入数据库。
 */
export function toDataUrl(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  const mime = MIME[ext]
  if (!mime) {
    throw new Error(`不支持的图片格式：${ext}`)
  }
  const base64 = readFileSync(filePath).toString('base64')
  return `data:${mime};base64,${base64}`
}

/**
 * 是否为当前支持复制入库的图片扩展名。
 */
export function isSupportedImage(filename: string): boolean {
  return Object.keys(MIME).includes(extname(filename).toLowerCase())
}
