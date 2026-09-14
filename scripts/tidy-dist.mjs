import { existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const productName = '汽车设计文案助手'
const portableName = `${productName}-${pkg.version}-portable`

/**
 * 判断打包完成后是否保留该文件或文件夹。
 * @param {string} name dist 根目录下的名字
 * @returns {boolean}
 */
function shouldKeep(name) {
  if (name === portableName) return true
  if (name === `${productName}-${pkg.version}-setup.exe`) return true
  if (name === 'latest.yml') return true
  return false
}

/**
 * 把 win-unpacked 收成便携文件夹，并删掉 zip / 7z / 构建日志等多余产物。
 */
function tidyDist() {
  if (!existsSync(dist)) {
    console.warn('dist 不存在，跳过清理')
    return
  }
  const unpacked = join(dist, 'win-unpacked')
  const portable = join(dist, portableName)
  if (existsSync(unpacked)) {
    if (existsSync(portable)) {
      rmSync(portable, { recursive: true, force: true })
    }
    renameSync(unpacked, portable)
  }
  for (const name of readdirSync(dist)) {
    if (shouldKeep(name)) continue
    rmSync(join(dist, name), { recursive: true, force: true })
  }
  const kept = readdirSync(dist).sort()
  for (const name of kept) {
    const kind = statSync(join(dist, name)).isDirectory() ? 'dir' : 'file'
    console.log(`keep ${kind}: ${name}`)
  }
}

tidyDist()
