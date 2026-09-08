import type { ModelCapability } from '@schemas/index'
import { ModelCapabilityError, type ChatRequest, type ChatResponse } from './types'

/**
 * 根据模型名推断能力。不确定时宁可保守，不猜测视觉能力。
 */
export function inferCapability(model: string): ModelCapability {
  const name = model.toLowerCase()
  const supportsVision =
    /(^|[-_/])vl($|[-_/0-9])|vision|glm-4\.5v|glm-4\.6v|glm-5v|deepseek-vl/.test(name)
  return {
    supportsText: true,
    supportsVision,
    supportsVideo: false,
    supportsJson: true,
    supportsStreaming: true
  }
}

/**
 * 调用前检查任务与模型能力是否匹配。
 */
export function assertCapability(request: ChatRequest, capability: ModelCapability): void {
  if (request.capability === 'vision' && !capability.supportsVision) {
    throw new ModelCapabilityError('当前视觉模型不支持图像输入，请在设置中更换 Vision Model。')
  }
  if (request.capability === 'json' && !capability.supportsJson) {
    throw new ModelCapabilityError('当前模型未声明 JSON 输出能力。')
  }
}

/**
 * 估算 token，仅在 API 未返回 usage 时使用。
 */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 2))
}

export function toUsage(
  prompt: string,
  completion: string,
  api?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
): ChatResponse['usage'] {
  if (api?.prompt_tokens != null && api.completion_tokens != null) {
    return {
      promptTokens: api.prompt_tokens,
      completionTokens: api.completion_tokens,
      totalTokens: api.total_tokens ?? api.prompt_tokens + api.completion_tokens,
      estimated: false
    }
  }
  const promptTokens = estimateTokens(prompt)
  const completionTokens = estimateTokens(completion)
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimated: true
  }
}
