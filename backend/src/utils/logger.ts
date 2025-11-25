type LogMeta = Record<string, unknown>

function ts() {
  return new Date().toISOString()
}

function format(meta?: LogMeta) {
  if (!meta) return ''
  try {
    return ' ' + JSON.stringify(meta)
  } catch {
    return ''
  }
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    // eslint-disable-next-line no-console
    console.log(`[${ts()}] INFO  ${message}${format(meta)}`)
  },
  warn(message: string, meta?: LogMeta) {
    // eslint-disable-next-line no-console
    console.warn(`[${ts()}] WARN  ${message}${format(meta)}`)
  },
  error(message: string, meta?: LogMeta) {
    // eslint-disable-next-line no-console
    console.error(`[${ts()}] ERROR ${message}${format(meta)}`)
  },
}


