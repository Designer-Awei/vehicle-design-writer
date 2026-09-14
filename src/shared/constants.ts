export const PLATFORMS = ['B站', '抖音', '小红书', 'YouTube', 'X'] as const

/** 当前产品覆盖的汽车设计内容类型。 */
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
/** SiliconFlow 文字模型；风格提取和成稿默认走这个。 */
export const DEFAULT_TEXT_MODEL = 'Qwen/Qwen3.5-27B'
export const DEFAULT_VISION_MODEL = 'Qwen/Qwen3-VL-32B-Instruct'
/** 上一版内置默认文字模型；未手动改过的安装会切到新默认。 */
export const LEGACY_DEFAULT_TEXT_MODEL = 'deepseek-ai/DeepSeek-V4-Flash'

export const PROMPT_VERSION = 'pfdbi-v3'

/** 写入初稿提示词的事实补充上限，避免撑爆上下文。 */
export const FACTS_PROMPT_LIMIT = 8000

/** 同时发给模型的请求上限，避免触发网关限流。 */
export const LLM_REQUEST_CONCURRENCY = 3

/** 口播字数估算：一分钟约 250 字。 */
export const WORDS_PER_MINUTE = 250

/** 入库风格卡简介字数上限，供列表展示和 Agent 选卡。 */
export const STYLE_NOTES_LIMIT = 20

/** Style DNA 提取各阶段，进度条和等待层共用。 */
export const STYLE_EXTRACT_STEPS = [
  { id: 'document_analysis', label: '单篇分析' },
  { id: 'style_aggregation', label: '聚合 Writing DNA' },
  { id: 'templates', label: '抽出结构模板' },
  { id: 'fewshot', label: '挑选代表性片段' },
  { id: 'quality', label: '质量检查' },
  { id: 'done', label: '保存到风格库' }
] as const

export type PlatformName = (typeof PLATFORMS)[number]
export type ContentType = (typeof CONTENT_TYPES)[number]
export type StyleCategory = (typeof STYLE_CATEGORIES)[number]
