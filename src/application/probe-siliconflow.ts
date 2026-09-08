import { readFileSync } from 'fs'
import { join } from 'path'
import { toDataUrl } from '@infrastructure/filesystem/image-store'
import { SiliconFlowProvider } from '@infrastructure/llm/SiliconFlowProvider'
import { DEFAULT_BASE_URL, DEFAULT_TEXT_MODEL, DEFAULT_VISION_MODEL } from '@shared/constants'

export interface ProbeChannelResult {
  ok: boolean
  model: string
  preview: string
  durationMs: number
  error?: string
}

export interface ProbeResult {
  text: ProbeChannelResult
  vision: ProbeChannelResult
}

export interface ProbeOptions {
  apiKey: string
  baseUrl: string
  textModel: string
  visionModel: string
}

/**
 * 使用 SiliconFlow 真实接口探测文字与视觉能力，禁止走 Mock。
 */
export async function probeSiliconFlow(options: ProbeOptions): Promise<ProbeResult> {
  if (!options.apiKey) {
    throw new Error('未配置 API Key，无法进行真实调用。')
  }
  const provider = new SiliconFlowProvider({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl || DEFAULT_BASE_URL
  })
  const textModel = options.textModel || DEFAULT_TEXT_MODEL
  const visionModel = options.visionModel || DEFAULT_VISION_MODEL

  const text = await runChannel(async () => {
    const response = await provider.chat(
      {
        task: 'rewrite',
        capability: 'text',
        maxTokens: 128,
        messages: [
          { role: 'system', content: '你是汽车设计评论助手。只回答一句中文。' },
          { role: 'user', content: '用一句话说明比例和姿态在汽车设计评价里分别看什么。' }
        ]
      },
      textModel
    )
    return { model: response.model, preview: response.text.trim(), durationMs: response.durationMs }
  })

  const vision = await runChannel(async () => {
    const imageUrl = resolveProbeImage()
    const response = await provider.chat(
      {
        task: 'vision',
        capability: 'vision',
        maxTokens: 256,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '用两句话描述这张车的前脸图形和姿态。不确定品牌就写待确认，不要虚构。'
              },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ]
      },
      visionModel
    )
    return { model: response.model, preview: response.text.trim(), durationMs: response.durationMs }
  })

  return { text, vision }
}

async function runChannel(
  run: () => Promise<{ model: string; preview: string; durationMs: number }>
): Promise<ProbeChannelResult> {
  try {
    const result = await run()
    return { ok: true, ...result, preview: result.preview.slice(0, 280) }
  } catch (error) {
    return {
      ok: false,
      model: '',
      preview: '',
      durationMs: 0,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

function resolveProbeImage(): string {
  const jpgPath = join(process.cwd(), 'resources', 'fixtures', 'sample-car.jpg')
  const pngPath = join(process.cwd(), 'resources', 'fixtures', 'sample-car.png')
  try {
    readFileSync(jpgPath)
    return toDataUrl(jpgPath)
  } catch {
    readFileSync(pngPath)
    return toDataUrl(pngPath)
  }
}
