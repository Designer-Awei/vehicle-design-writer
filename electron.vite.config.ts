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
 * 忽略 Zod 注释里提到 `@__PURE__` 时被 Rollup 误报的告警。
 */
function ignoreZodPureCommentWarning(
  warning: { message: string; id?: string },
  defaultHandler: (warning: { message: string; id?: string }) => void
): void {
  const fromZod = (warning.id ?? warning.message).includes('zod')
  if (fromZod && warning.message.includes('annotation that Rollup cannot interpret')) {
    return
  }
  defaultHandler(warning)
}

const rollupOptions = {
  onwarn: ignoreZodPureCommentWarning
}

/**
 * electron-vite 构建配置：主进程、预加载脚本与渲染进程。
 */
export default defineConfig({
  main: {
    logLevel: 'warn',
    plugins: [externalizeDepsPlugin({ exclude: ['zod', 'nanoid'] })],
    resolve: { alias: aliases },
    build: { rollupOptions }
  },
  preload: {
    logLevel: 'warn',
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': aliases['@shared'] } },
    build: { rollupOptions }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': aliases['@shared'],
        '@schemas': aliases['@schemas']
      }
    },
    plugins: [react(), tailwindcss()],
    build: { rollupOptions }
  }
})
