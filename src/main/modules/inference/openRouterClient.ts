import { ErrorCode } from '@shared/contracts';
import { InferenceError } from './errors';
import { buildPrompt } from './promptBuilder';
import { logger } from '@main/utils/logger';
import {
  CostEstimate,
  TokenPricing,
  UsageSnapshot,
  estimateTokenCostUsd,
  normalizeUsage,
  parseUsdPerToken,
  toFixedUsd
} from './costing';

export interface OpenRouterQueryInput {
  requestId?: number;
  apiKey: string;
  model: string;
  corpus: string;
  customInfo: string;
  imageBuffer: Buffer;
  timeoutMs?: number;
  signal?: AbortSignal;
  onToken?: (chunk: string) => void;
}

export interface OpenRouterQueryResult {
  text: string;
  corpusTruncated: boolean;
  usage: UsageSnapshot | null;
  costEstimateUsd: CostEstimate | null;
  reportedCostUsd: number | null;
}

interface StreamParseResult {
  deltaText: string;
  usage: UsageSnapshot | null;
}

export class OpenRouterClient {
  private readonly pricingCache = new Map<string, TokenPricing>();

  async runVisionQuery(input: OpenRouterQueryInput): Promise<OpenRouterQueryResult> {
    const timeoutMs = input.timeoutMs ?? 20_000;
    const imageBase64 = input.imageBuffer.toString('base64');
    const prompt = buildPrompt({
      corpus: input.corpus,
      customInfo: input.customInfo,
      model: input.model,
      imageBase64
    });

    logger.info('Dispatching OpenRouter request', {
      requestId: input.requestId ?? 'n/a',
      model: input.model,
      timeoutMs
    });

    // Start pricing lookup in parallel so cost logging is ready at stream completion.
    const pricingPromise = this.getPricingForModel(input.model);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), timeoutMs);

    const forwardAbort = () => controller.abort('external-abort');
    input.signal?.addEventListener('abort', forwardAbort, { once: true });

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(prompt.body),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new InferenceError('MODEL_ERROR', await this.extractFailureMessage(response));
      }

      logger.info('OpenRouter response stream opened', {
        requestId: input.requestId ?? 'n/a',
        status: response.status
      });

      if (!response.body) {
        throw new InferenceError('NETWORK', 'No response stream received from OpenRouter.');
      }

      let aggregated = '';
      let usageSnapshot: UsageSnapshot | null = null;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        pending += decoder.decode(value, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) {
            continue;
          }

          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') {
            break;
          }

          const parsed = parseStreamEventData(data);

          if (parsed.usage) {
            usageSnapshot = parsed.usage;
          }

          if (parsed.deltaText) {
            aggregated += parsed.deltaText;
            input.onToken?.(parsed.deltaText);
          }
        }
      }

      const text = aggregated.trim() || 'unknown';
      const pricing = await pricingPromise;
      const costEstimate = usageSnapshot && pricing ? estimateTokenCostUsd(usageSnapshot, pricing) : null;

      logger.info('OpenRouter response completed', {
        requestId: input.requestId ?? 'n/a',
        outputChars: text.length,
        corpusTruncated: prompt.corpusTruncated
      });

      this.logUsageAndCost(input.requestId, usageSnapshot, pricing, costEstimate);

      return {
        text,
        corpusTruncated: prompt.corpusTruncated,
        usage: usageSnapshot,
        costEstimateUsd: costEstimate,
        reportedCostUsd: usageSnapshot?.costUsd ?? null
      };
    } catch (error) {
      logger.warn('OpenRouter request failed', {
        requestId: input.requestId ?? 'n/a',
        reason: error instanceof Error ? error.message : 'unknown'
      });
      if (error instanceof InferenceError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        const code: ErrorCode = controller.signal.reason === 'timeout' ? 'TIMEOUT' : 'NETWORK';
        throw new InferenceError(code, code === 'TIMEOUT' ? 'Request timed out.' : 'Request aborted.');
      }

      throw new InferenceError('NETWORK', error instanceof Error ? error.message : 'Network failure');
    } finally {
      clearTimeout(timeout);
      input.signal?.removeEventListener('abort', forwardAbort);
    }
  }

  private async extractFailureMessage(response: Response): Promise<string> {
    try {
      const body = await response.json();
      const message =
        body?.error?.message ??
        body?.message ??
        `OpenRouter request failed with status ${response.status}`;
      return typeof message === 'string' ? message : `OpenRouter request failed with status ${response.status}`;
    } catch {
      return `OpenRouter request failed with status ${response.status}`;
    }
  }

  private async getPricingForModel(model: string): Promise<TokenPricing | null> {
    const cached = this.pricingCache.get(model);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/models');
      if (!response.ok) {
        return null;
      }

      const body = (await response.json()) as {
        data?: Array<{ id?: string; pricing?: Record<string, unknown> }>;
      };

      const modelCard = body.data?.find((candidate) => candidate?.id === model);
      if (!modelCard) {
        return null;
      }

      const promptUsdPerToken = parseUsdPerToken(modelCard.pricing?.prompt) ?? 0;
      const completionUsdPerToken = parseUsdPerToken(modelCard.pricing?.completion) ?? 0;

      const pricing: TokenPricing = {
        promptUsdPerToken,
        completionUsdPerToken
      };

      this.pricingCache.set(model, pricing);
      return pricing;
    } catch {
      return null;
    }
  }

  private logUsageAndCost(
    requestId: number | undefined,
    usage: UsageSnapshot | null,
    pricing: TokenPricing | null,
    estimate: CostEstimate | null
  ): void {
    if (!usage) {
      logger.warn('OpenRouter usage unavailable for completed request', {
        requestId: requestId ?? 'n/a'
      });
      return;
    }

    logger.info('OpenRouter usage summary', {
      requestId: requestId ?? 'n/a',
      promptTokens: usage.promptTokens ?? 'n/a',
      completionTokens: usage.completionTokens ?? 'n/a',
      totalTokens: usage.totalTokens ?? 'n/a',
      reportedCostUsd: usage.costUsd !== null ? toFixedUsd(usage.costUsd) : 'n/a'
    });

    if (usage.costUsd !== null) {
      logger.info('OpenRouter reported cost (USD)', {
        requestId: requestId ?? 'n/a',
        totalUsd: toFixedUsd(usage.costUsd)
      });
    }

    if (!pricing || !estimate) {
      logger.warn('OpenRouter pricing unavailable; cost estimate skipped', {
        requestId: requestId ?? 'n/a'
      });
      return;
    }

    logger.info('OpenRouter cost estimate (USD)', {
      requestId: requestId ?? 'n/a',
      promptUsd: toFixedUsd(estimate.promptUsd),
      completionUsd: toFixedUsd(estimate.completionUsd),
      totalUsd: toFixedUsd(estimate.totalUsd)
    });
  }
}

function parseStreamEventData(raw: string): StreamParseResult {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      deltaText: extractDeltaText(parsed),
      usage: normalizeUsage(parsed.usage)
    };
  } catch {
    return {
      deltaText: '',
      usage: null
    };
  }
}

function extractDeltaText(parsed: Record<string, unknown>): string {
  const choices = parsed.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return '';
  }

  const delta = (choices[0] as { delta?: { content?: unknown } })?.delta?.content;

  if (typeof delta === 'string') {
    return delta;
  }

  if (Array.isArray(delta)) {
    return delta
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (typeof item === 'object' && item && 'text' in item && typeof item.text === 'string') {
          return item.text;
        }
        return '';
      })
      .join('');
  }

  return '';
}
