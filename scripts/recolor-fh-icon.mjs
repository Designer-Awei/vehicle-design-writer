import { writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve('D:/AI_project/fast-hardware/assets/icon_1024x1024.png')
const GOLD = { r: 196, g: 165, b: 116 }

/**
 * 把 Fast Hardware 图标里的蓝色换成应用金色，黑色背景保持不变。
 * 用蓝色相对红色的差值做过渡，抗锯齿边缘不会发糊。
 * @returns {Promise<void>}
 */
async function main() {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const blueness = Math.max(0, Math.min(1, (b - r) / 160))
    if (blueness <= 0) continue
    data[i] = Math.round(r + (GOLD.r - r) * blueness)
    data[i + 1] = Math.round(g + (GOLD.g - g) * blueness)
    data[i + 2] = Math.round(b + (GOLD.b - b) * blueness)
  }
  const png = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .png()
    .toBuffer()
  writeFileSync(resolve(root, 'resources/icon.png'), png)
  console.log(`recolored ${info.width}x${info.height} -> resources/icon.png`)
}

void main()
