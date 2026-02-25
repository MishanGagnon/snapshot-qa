export interface UsageSnapshot {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cachedPromptTokens: number | null;
  cacheWritePromptTokens: number | null;
  costUsd: number | null;
}

export interface TokenPricing {
  promptUsdPerToken: number;
  completionUsdPerToken: number;
  inputCacheReadUsdPerToken: number;
  inputCacheWriteUsdPerToken: number;
}

export interface CostEstimate {
  promptUsd: number;
  completionUsd: number;
  totalUsd: number;
}

export function normalizeUsage(raw: unknown): UsageSnapshot | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const usage = raw as Record<string, unknown>;

  const promptTokens = toFiniteNumber(
    usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens ?? usage.inputTokens
  );
  const completionTokens = toFiniteNumber(
    usage.completion_tokens ?? usage.output_tokens ?? usage.completionTokens ?? usage.outputTokens
  );
  const totalTokens = toFiniteNumber(usage.total_tokens ?? usage.totalTokens);
  const promptTokenDetails = (usage.prompt_tokens_details ??
    usage.promptTokensDetails ??
    usage.input_tokens_details ??
    usage.inputTokensDetails) as Record<string, unknown> | undefined;
  const cachedPromptTokens = toFiniteNumber(
    promptTokenDetails?.cached_tokens ?? promptTokenDetails?.cachedTokens
  );
  const cacheWritePromptTokens = toFiniteNumber(
    promptTokenDetails?.cache_write_tokens ?? promptTokenDetails?.cacheWriteTokens
  );
  const costUsd = toFiniteNumber(usage.cost ?? usage.total_cost ?? usage.totalCost);

  if (
    promptTokens === null &&
    completionTokens === null &&
    totalTokens === null &&
    cachedPromptTokens === null &&
    cacheWritePromptTokens === null &&
    costUsd === null
  ) {
    return null;
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    cachedPromptTokens,
    cacheWritePromptTokens,
    costUsd
  };
}

export function estimateTokenCostUsd(usage: UsageSnapshot, pricing: TokenPricing): CostEstimate {
  const promptTokens = usage.promptTokens ?? 0;
  const completionTokens = usage.completionTokens ?? 0;
  const cachedPromptTokens = usage.cachedPromptTokens ?? 0;
  const cacheWritePromptTokens = usage.cacheWritePromptTokens ?? 0;

  const normalPromptTokens = Math.max(0, promptTokens - cachedPromptTokens - cacheWritePromptTokens);

  const promptUsd =
    normalPromptTokens * pricing.promptUsdPerToken +
    cachedPromptTokens * pricing.inputCacheReadUsdPerToken +
    cacheWritePromptTokens * pricing.inputCacheWriteUsdPerToken;
  const completionUsd = completionTokens * pricing.completionUsdPerToken;

  return {
    promptUsd,
    completionUsd,
    totalUsd: promptUsd + completionUsd
  };
}

export function parseUsdPerToken(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed < 0) {
    return null;
  }

  return parsed;
}

export function toFixedUsd(value: number): string {
  return value.toFixed(8);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
