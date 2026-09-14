import { mkdirSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import pngToIco from 'png-to-ico'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'resources/icon.png')
const icoSizes = [16, 24, 32, 48, 64, 128, 256]

/**
 * 把源 PNG 缩成 Windows 可识别的多尺寸 ICO，并同步安装/窗口用的 PNG。
 * EXE 资源里的图标必须含 16/32/48/256，单张超大 PNG 塞进 ICO 时资源管理器会回落到 Electron 默认图标。
 * @returns {Promise<void>}
 */
async function main() {
  const pngs = await Promise.all(
    icoSizes.map((size) => sharp(source).resize(size, size).png().toBuffer())
  )
  const ico = await pngToIco(pngs)
  const icon256 = pngs[pngs.length - 1]
  const dests = [
    resolve(root, 'build/icon.ico'),
    resolve(root, 'build/icon.png'),
    resolve(root, 'src/renderer/src/assets/app-icon.png')
  ]
  for (const dest of dests) {
    mkdirSync(dirname(dest), { recursive: true })
  }
  writeFileSync(resolve(root, 'build/icon.ico'), ico)
  writeFileSync(resolve(root, 'build/icon.png'), icon256)
  writeFileSync(resolve(root, 'src/renderer/src/assets/app-icon.png'), icon256)
  console.log(`wrote ico (${ico.length} bytes) and 256px png`)
}

void main()
