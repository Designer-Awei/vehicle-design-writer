type LogData = Record<string, unknown>

/**
 * 开发态工作流日志。禁止输出 API Key、完整文案和图片 base64。
 */
export function logInfo(event: string, data?: LogData): void {
  if (process.env.NODE_ENV === 'production') return
  console.log(`[vdw] ${event}`, data ? sanitize(data) : '')
}

/**
 * 记录错误信息，仅保留 message。
 */
export function logError(event: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[vdw] ${event}`, message)
}

function sanitize(data: LogData): LogData {
  const blocked = /key|secret|authorization|base64|script|content|excerpt/i
  const result: LogData = {}
  for (const [key, value] of Object.entries(data)) {
    if (blocked.test(key)) {
      result[key] = '[redacted]'
      continue
    }
    result[key] = value
  }
  return result
}
