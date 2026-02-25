export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.info(`[info] ${message}`, sanitizeMeta(meta));
      return;
    }
    console.info(`[info] ${message}`);
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.warn(`[warn] ${message}`, sanitizeMeta(meta));
      return;
    }
    console.warn(`[warn] ${message}`);
  },
  error(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.error(`[error] ${message}`, sanitizeMeta(meta));
      return;
    }
    console.error(`[error] ${message}`);
  }
};

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (key.toLowerCase().includes('key') || key.toLowerCase().includes('token')) {
      sanitized[key] = '[redacted]';
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}
