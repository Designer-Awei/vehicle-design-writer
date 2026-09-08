import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const aliases = {
  '@shared': resolve('src/shared'),
  '@domain': resolve('src/domain'),
  '@schemas': resolve('src/schemas'),
  '@application': resolve('src/application'),
  '@infrastructure': resolve('src/infrastructure'),
  '@prompts': resolve('src/prompts')
}

/**
 * electron-vite 构建配置：主进程、预加载脚本与渲染进程。
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['zod', 'nanoid'] })],
    resolve: { alias: aliases }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': aliases['@shared'] } }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': aliases['@shared'],
        '@schemas': aliases['@schemas']
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
