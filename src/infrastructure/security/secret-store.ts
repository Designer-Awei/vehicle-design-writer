import { safeStorage } from 'electron'

/**
 * 使用 Electron safeStorage 加密 API Key；不可用时回退为明文本地存储标记。
 */
export function encryptSecret(plain: string): { payload: string; encrypted: boolean } {
  if (plain.length === 0) {
    return { payload: '', encrypted: false }
  }
  if (safeStorage.isEncryptionAvailable()) {
    return { payload: safeStorage.encryptString(plain).toString('base64'), encrypted: true }
  }
  return { payload: plain, encrypted: false }
}

/**
 * 解密本地保存的 API Key。
 */
export function decryptSecret(payload: string, encrypted: boolean): string {
  if (!payload) return ''
  if (!encrypted) return payload
  try {
    return safeStorage.decryptString(Buffer.from(payload, 'base64'))
  } catch {
    return ''
  }
}

/**
 * 供设置页展示的掩码 Key。
 */
export function maskSecret(plain: string): string {
  if (!plain) return ''
  if (plain.length < 10) return '********'
  return `${plain.slice(0, 4)}****${plain.slice(-4)}`
}
