export const logger = {
  info: (msg: string, meta?: any) => {
    try {
      // Keep logs compact in browser console
      // eslint-disable-next-line no-console
      console.info(`[info] ${msg}`, meta ?? "");
    } catch {}
  },
  warn: (msg: string, meta?: any) => {
    try {
      // eslint-disable-next-line no-console
      console.warn(`[warn] ${msg}`, meta ?? "");
    } catch {}
  },
  error: (msg: string, meta?: any) => {
    try {
      // eslint-disable-next-line no-console
      console.error(`[error] ${msg}`, meta ?? "");
    } catch {}
  },
};
