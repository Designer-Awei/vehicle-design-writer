import { randomUUID } from 'crypto'

/**
 * 生成带业务前缀的本地实体 ID。
 */
export function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`
}

/**
 * 当前 ISO 时间戳。
 */
export function nowIso(): string {
  return new Date().toISOString()
}
