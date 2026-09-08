import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { extname } from 'path'
import iconv from 'iconv-lite'
import jschardet from 'jschardet'

export interface ParsedDocument {
  filename: string
  text: string
  wordCount: number
  status: 'ok' | 'failed'
  error: string | null
}

const SUPPORTED = new Set(['.txt', '.md', '.rtf'])

/**
 * 统计中英混合字数：汉字按字，英文按词。
 */
export function countWords(text: string): number {
  const chinese = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  const rest = text.replace(/[\u4e00-\u9fff]/g, ' ')
  const latin = (rest.match(/[A-Za-z0-9]+/g) ?? []).length
  return chinese + latin
}

/**
 * 清洗并解析单个文案文件，单文件失败不影响其它文件。
 */
export function parseDocumentFile(filePath: string, filename: string): ParsedDocument {
  try {
    const ext = extname(filename).toLowerCase()
    if (!SUPPORTED.has(ext)) {
      return { filename, text: '', wordCount: 0, status: 'failed', error: `不支持的格式：${ext}` }
    }
    const buffer = readFileSync(filePath)
    let raw = decodeBuffer(buffer)
    if (ext === '.rtf') raw = stripRtf(raw)
    const text = raw.split('\u0000').join('').trim()
    if (!text) {
      return { filename, text: '', wordCount: 0, status: 'failed', error: '文件为空' }
    }
    return { filename, text, wordCount: countWords(text), status: 'ok', error: null }
  } catch (error) {
    return {
      filename,
      text: '',
      wordCount: 0,
      status: 'failed',
      error: error instanceof Error ? error.message : '解析失败'
    }
  }
}

/**
 * 检测编码并解码，尽可能兼容 UTF-8 / GBK / GB18030。
 */
export function decodeBuffer(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf8')
  }
  const detected = jschardet.detect(buffer)
  const encoding = (detected.encoding || 'UTF-8').toLowerCase()
  if (encoding.includes('utf-8') || encoding.includes('ascii')) {
    return buffer.toString('utf8')
  }
  if (
    encoding.includes('gb') ||
    encoding.includes('windows-1252') ||
    encoding.includes('iso-8859')
  ) {
    const mapped = encoding.includes('gb') ? 'gb18030' : encoding
    if (iconv.encodingExists(mapped)) {
      return iconv.decode(buffer, mapped)
    }
  }
  return buffer.toString('utf8')
}

/**
 * 基础 RTF 清洗，转为纯文本。
 */
export function stripRtf(input: string): string {
  return input
    .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
    .replace(/\\[a-zA-Z]+-?\d* ?/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 计算文件内容 SHA-256，用于视觉结果缓存。
 */
export function hashFile(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

/**
 * 计算文本缓存键。
 */
export function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}
