export const PLATFORMS = ['B站', '抖音', '小红书', 'YouTube', 'X'] as const

/** 当前产品覆盖的汽车设计内容类型；风格库类别与文案类型共用。 */
export const CONTENT_TYPES = [
  '车型解读',
  '设计知识',
  '设计观点',
  '设计回顾',
  '新车热点',
  '设计跨界'
] as const

export const STYLE_CATEGORIES = CONTENT_TYPES

export const DEFAULT_BASE_URL = 'https://api.siliconflow.cn/v1'
export const DEFAULT_TEXT_MODEL = 'deepseek-ai/DeepSeek-V4-Flash'
export const DEFAULT_VISION_MODEL = 'Qwen/Qwen3-VL-32B-Instruct'

export const PROMPT_VERSION = 'pfdbi-v3'

/** 同时发给模型的请求上限，避免触发网关限流。 */
export const LLM_REQUEST_CONCURRENCY = 3

/** Style DNA 提取各阶段，进度条和等待层共用。 */
export const STYLE_EXTRACT_STEPS = [
  { id: 'document_analysis', label: '单篇分析' },
  { id: 'style_aggregation', label: '聚合 Writing DNA' },
  { id: 'templates', label: '生成结构模板' },
  { id: 'fewshot', label: '挑选代表性片段' },
  { id: 'quality', label: '质量检查' },
  { id: 'done', label: '保存到风格库' }
] as const

export type PlatformName = (typeof PLATFORMS)[number]
export type ContentType = (typeof CONTENT_TYPES)[number]
export type StyleCategory = (typeof STYLE_CATEGORIES)[number]
