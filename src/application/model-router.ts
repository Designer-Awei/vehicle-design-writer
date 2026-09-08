import { inferCapability } from '@infrastructure/llm/capability'
import type { ModelCapability } from '@schemas/index'
import { DEFAULT_TEXT_MODEL, DEFAULT_VISION_MODEL } from '@shared/constants'

export interface ModelSelection {
  textModel: string
  visionModel: string
}

/**
 * 按任务类型选择模型，模型名始终来自配置而非写死。
 */
export class ModelRouter {
  constructor(private readonly selection: ModelSelection) {}

  select(kind: 'text' | 'vision' | 'json' | 'reasoning'): string {
    if (kind === 'vision') return this.selection.visionModel || DEFAULT_VISION_MODEL
    return this.selection.textModel || DEFAULT_TEXT_MODEL
  }

  capability(kind: 'text' | 'vision' | 'json' | 'reasoning'): ModelCapability {
    return inferCapability(this.select(kind))
  }
}
