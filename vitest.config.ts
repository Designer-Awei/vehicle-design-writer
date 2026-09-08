import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

/**
 * 主进程与领域层单测配置，使用 Node 环境与 MockLLMProvider。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@domain': resolve('src/domain'),
      '@schemas': resolve('src/schemas'),
      '@application': resolve('src/application'),
      '@infrastructure': resolve('src/infrastructure'),
      '@prompts': resolve('src/prompts')
    }
  }
})
