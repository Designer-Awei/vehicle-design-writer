/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: join(root, '.env'), quiet: true })

const apiKey = process.env.SILICONFLOW_API_KEY?.trim()
const baseUrl = (process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1').replace(
  /\/$/,
  ''
)
const textModel = process.env.SILICONFLOW_TEXT_MODEL || 'deepseek-ai/DeepSeek-V4-Flash'
const visionModel = process.env.SILICONFLOW_VISION_MODEL || 'Qwen/Qwen3-VL-32B-Instruct'

if (!apiKey) {
  console.error('missing SILICONFLOW_API_KEY')
  process.exit(1)
}

const imagePath = join(root, 'resources', 'fixtures', 'sample-car.jpg')
const dataUrl = `data:image/jpeg;base64,${readFileSync(imagePath).toString('base64')}`

/**
 * @param {Record<string, unknown>} body
 */
async function chat(body) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000)
  })
  const raw = await response.text()
  if (!response.ok) {
    throw new Error(`${response.status} ${raw.slice(0, 400)}`)
  }
  const payload = JSON.parse(raw)
  return payload.choices?.[0]?.message?.content ?? ''
}

if (process.argv[2] !== 'vision-only') {
  const text = await chat({
    model: textModel,
    max_tokens: 128,
    messages: [
      { role: 'system', content: '你是汽车设计评论助手。只回答一句中文。' },
      { role: 'user', content: '用一句话说明比例和姿态在汽车设计评价里分别看什么。' }
    ]
  })
  console.log('TEXT_OK', textModel)
  console.log(String(text).slice(0, 200))
}

const vision = await chat({
  model: visionModel,
  max_tokens: 256,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '用两句话描述这张车的前脸图形和姿态。不确定品牌就写待确认，不要虚构。'
        },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    }
  ]
})
console.log('VISION_OK', visionModel)
console.log(String(vision).slice(0, 300))
