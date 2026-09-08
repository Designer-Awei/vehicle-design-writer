export const PLATFORMS = ['B站', '抖音', '小红书', 'YouTube', 'X'] as const
export const CONTENT_TYPES = [
  '热点设计评论',
  '单车型设计深度分析',
  '双车设计比较',
  '品牌设计语言分析',
  '汽车设计史 / 经典车型',
  '商业合作内容'
] as const

export const DEFAULT_BASE_URL = 'https://api.siliconflow.cn/v1'
export const DEFAULT_TEXT_MODEL = 'deepseek-ai/DeepSeek-V4-Flash'
export const DEFAULT_VISION_MODEL = 'Qwen/Qwen3-VL-32B-Instruct'

export const PROMPT_VERSION = 'pfdbi-v1'

export type PlatformName = (typeof PLATFORMS)[number]
export type ContentType = (typeof CONTENT_TYPES)[number]
