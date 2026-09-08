import type { DurationProfile } from '@schemas/index'
import { countWords } from '@infrastructure/filesystem/document-parser'

export const DEFAULT_DURATION: DurationProfile = {
  id: 'zh-default',
  name: '中文口播默认',
  language: 'zh',
  wordsPerMinute: 290,
  tolerancePercent: 10
}

export interface DurationEstimate {
  targetWords: number
  actualWords: number
  estimatedSeconds: number
  errorPercent: number
  warning: string | null
}

/**
 * 按配置的语速估算口播时长。
 */
export function estimateDuration(
  script: string,
  durationSeconds: number,
  profile: DurationProfile
): DurationEstimate {
  const actualWords = countWords(script)
  const targetWords = Math.round((durationSeconds / 60) * profile.wordsPerMinute)
  const estimatedSeconds = Math.round((actualWords / profile.wordsPerMinute) * 60)
  const errorPercent = targetWords === 0 ? 0 : ((actualWords - targetWords) / targetWords) * 100
  const abs = Math.abs(errorPercent)
  let warning: string | null = null
  if (abs > profile.tolerancePercent) {
    warning = `时长偏差 ${errorPercent.toFixed(1)}%，超出 ±${profile.tolerancePercent}%`
  } else if (abs > 5) {
    warning = `时长偏差 ${errorPercent.toFixed(1)}%，建议微调`
  }
  return { targetWords, actualWords, estimatedSeconds, errorPercent, warning }
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}分${String(s).padStart(2, '0')}秒`
}
