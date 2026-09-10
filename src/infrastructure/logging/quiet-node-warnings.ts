/**
 * 过滤 Node 实验特性告警。必须在加载 `node:sqlite` 之前导入。
 */
const originalEmitWarning = process.emitWarning.bind(process)

process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
  const message = typeof warning === 'string' ? warning : warning.message
  if (message.includes('SQLite is an experimental feature')) {
    return
  }
  return (originalEmitWarning as (warning: string | Error, ...args: unknown[]) => void)(
    warning,
    ...args
  )
}) as typeof process.emitWarning
