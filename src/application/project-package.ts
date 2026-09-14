import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { extname, join } from 'path'
import { isProjectBundle } from './project-bundle'

/**
 * 是否为可导入的项目 zip 包。
 */
export function isProjectZip(filePath: string): boolean {
  return extname(filePath).toLowerCase() === '.zip'
}

/**
 * 把项目文件夹内容打成 zip（根目录就是 参考图/ 和 项目.json）。
 */
export function zipProjectFolder(folder: string, zipPath: string): void {
  if (existsSync(zipPath)) {
    unlinkSync(zipPath)
  }
  execFileSync('tar', ['-a', '-cf', zipPath, '-C', folder, '.'], {
    windowsHide: true,
    stdio: 'ignore'
  })
}

/**
 * 把 zip 解到目标目录。
 */
export function unzipProjectPackage(zipPath: string, dest: string): void {
  mkdirSync(dest, { recursive: true })
  execFileSync('tar', ['-xf', zipPath, '-C', dest], {
    windowsHide: true,
    stdio: 'ignore'
  })
}

/**
 * 解压后定位真正的项目根：有的 zip 会多包一层文件夹。
 */
export function resolveBundleRoot(dir: string): string {
  if (isProjectBundle(dir)) return dir
  const children = existsSync(dir)
    ? readdirSync(dir).map((name) => join(dir, name)).filter((path) => statSync(path).isDirectory())
    : []
  const nested = children.find((path) => isProjectBundle(path))
  if (nested) return nested
  throw new Error('这不是可导入的文案项目包（需要含 项目.json）')
}
