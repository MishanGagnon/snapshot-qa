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
  const sensitiveKeyPatterns = [/api[_-]?key/i, /secret/i, /password/i, /authorization/i, /^token$/i, /bearer/i];

  for (const [key, value] of Object.entries(meta)) {
    const hasSensitiveKey = sensitiveKeyPatterns.some((pattern) => pattern.test(key));
    const hasSensitiveValue = typeof value === 'string' && /^sk-[a-z0-9_-]+/i.test(value);

    if (hasSensitiveKey || hasSensitiveValue) {
      sanitized[key] = '[redacted]';
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}
