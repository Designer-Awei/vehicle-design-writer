import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 Tailwind class。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * 去掉 Electron IPC 包装，只保留业务错误信息。
 */
export function ipcErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw
    .replace(/^Error invoking remote method '[^']+': (?:Error: )?/u, '')
    .replace(/^TimeoutError:\s*/u, '模型响应超时。')
}
