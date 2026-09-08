declare module 'jschardet' {
  export function detect(buffer: Buffer | Uint8Array | string): {
    encoding: string
    confidence: number
  }
}
