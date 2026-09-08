import { copyFileSync, mkdirSync, readFileSync } from 'fs'
import { extname, join } from 'path'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
}

/**
 * 将参考图复制到应用数据目录，不写入第三方图床。
 */
export function storeImage(
  userData: string,
  projectId: string,
  imageId: string,
  sourcePath: string
): string {
  const dir = join(userData, 'images', projectId)
  mkdirSync(dir, { recursive: true })
  const target = join(dir, `${imageId}${extname(sourcePath).toLowerCase()}`)
  copyFileSync(sourcePath, target)
  return target
}

/**
 * 读取本地图片为 data URL，供视觉模型与预览使用。
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

export function isSupportedImage(filename: string): boolean {
  return Object.keys(MIME).includes(extname(filename).toLowerCase())
}
