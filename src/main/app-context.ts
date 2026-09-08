import { config } from 'dotenv'
import { join } from 'path'
import { app } from 'electron'
import { seedIfEmpty } from '@application/demo-seed'
import { ModelRouter } from '@application/model-router'
import { AppDatabase } from '@infrastructure/db/database'
import { Repositories } from '@infrastructure/db/repositories'
import { MockLLMProvider } from '@infrastructure/llm/MockLLMProvider'
import { SiliconFlowProvider } from '@infrastructure/llm/SiliconFlowProvider'
import type { LLMProvider } from '@infrastructure/llm/types'
import { decryptSecret, encryptSecret } from '@infrastructure/security/secret-store'
import { DEFAULT_BASE_URL, DEFAULT_TEXT_MODEL, DEFAULT_VISION_MODEL } from '@shared/constants'

export interface AppContext {
  db: AppDatabase
  repos: Repositories
  userData: string
}

/**
 * 加载根目录 .env，初始化 SQLite，并在无密钥时启用 Demo Mode。
 */
export function createAppContext(): AppContext {
  config({ path: join(process.cwd(), '.env') })
  const userData = app.getPath('userData')
  const db = new AppDatabase(join(userData, 'vehicle-design-writer.sqlite'))
  const repos = new Repositories(db)
  hydrateSettingsFromEnv(repos)
  seedIfEmpty(repos)
  return { db, repos, userData }
}

export function hydrateSettingsFromEnv(repos: Repositories): void {
  const envKey = process.env.SILICONFLOW_API_KEY?.trim()
  if (envKey) {
    const packed = encryptSecret(envKey)
    repos.setSetting('api_key_payload', packed.payload)
    repos.setSetting('api_key_encrypted', packed.encrypted ? '1' : '0')
  }
  if (process.env.SILICONFLOW_BASE_URL) {
    repos.setSetting('base_url', process.env.SILICONFLOW_BASE_URL)
  } else if (!repos.getSetting('base_url')) {
    repos.setSetting('base_url', DEFAULT_BASE_URL)
  }
  if (process.env.SILICONFLOW_TEXT_MODEL) {
    repos.setSetting('text_model', process.env.SILICONFLOW_TEXT_MODEL)
  } else if (!repos.getSetting('text_model')) {
    repos.setSetting('text_model', DEFAULT_TEXT_MODEL)
  }
  if (process.env.SILICONFLOW_VISION_MODEL) {
    repos.setSetting('vision_model', process.env.SILICONFLOW_VISION_MODEL)
  } else if (!repos.getSetting('vision_model')) {
    repos.setSetting('vision_model', DEFAULT_VISION_MODEL)
  }
}

export function readApiKey(repos: Repositories): string {
  const payload = repos.getSetting('api_key_payload') ?? ''
  const encrypted = repos.getSetting('api_key_encrypted') === '1'
  return decryptSecret(payload, encrypted)
}

export function createLlm(repos: Repositories): {
  provider: LLMProvider
  router: ModelRouter
  demo: boolean
} {
  const apiKey = readApiKey(repos)
  const baseUrl = repos.getSetting('base_url') || DEFAULT_BASE_URL
  const textModel = repos.getSetting('text_model') || DEFAULT_TEXT_MODEL
  const visionModel = repos.getSetting('vision_model') || DEFAULT_VISION_MODEL
  const provider = apiKey ? new SiliconFlowProvider({ apiKey, baseUrl }) : new MockLLMProvider()
  return { provider, router: new ModelRouter({ textModel, visionModel }), demo: !apiKey }
}
