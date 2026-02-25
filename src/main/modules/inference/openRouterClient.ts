import { ErrorCode } from '@shared/contracts';
import { InferenceError } from './errors';
import { buildPrompt } from './promptBuilder';
import { logger } from '@main/utils/logger';
import { writeLatestImageArtifact } from '@main/modules/debug/imageArtifact';
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
  imageMimeType: string;
  contextCachingEnabled: boolean;
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

    try {
      const sentImagePath = await writeLatestImageArtifact('latest-sent-image.png', input.imageBuffer);
      logger.info('Wrote latest sent image artifact', {
        requestId: input.requestId ?? 'n/a',
        sentImagePath,
        imageBytes: input.imageBuffer.length
      });
    } catch (error) {
      logger.warn('Failed to write latest sent image artifact', {
        requestId: input.requestId ?? 'n/a',
        reason: error instanceof Error ? error.message : 'unknown'
      });
    }

    const imageBase64 = input.imageBuffer.toString('base64');
    const prompt = buildPrompt({
      corpus: input.corpus,
      customInfo: input.customInfo,
      model: input.model,
      imageBase64,
      imageMimeType: input.imageMimeType,
      contextCachingEnabled: input.contextCachingEnabled
    });

    logger.info('Dispatching OpenRouter request', {
      requestId: input.requestId ?? 'n/a',
      model: input.model,
      timeoutMs,
      contextCachingEnabled: input.contextCachingEnabled,
      contextCacheHintApplied: prompt.contextCacheHintApplied
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
      let streamDone = false;

      const handleDataPayload = (data: string) => {
        if (data === '[DONE]') {
          streamDone = true;
          return;
        }

        const parsed = parseStreamEventData(data);

        if (parsed.usage) {
          usageSnapshot = parsed.usage;
        }

        if (parsed.deltaText) {
          aggregated += parsed.deltaText;
          input.onToken?.(parsed.deltaText);
        }
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) {
          pending += decoder.decode();
          break;
        }

        pending += decoder.decode(value, { stream: true });
        const consumed = consumeSseDataPayloads(pending, false, handleDataPayload);
        pending = consumed.pending;
        if (consumed.done) {
          streamDone = true;
        }
      }

      if (!streamDone) {
        const consumed = consumeSseDataPayloads(pending, true, handleDataPayload);
        pending = consumed.pending;
        if (consumed.done) {
          streamDone = true;
        }
      }

      const text = aggregated.trim() || 'unknown';
      const pricing = await pricingPromise;
      const costEstimate = usageSnapshot && pricing ? estimateTokenCostUsd(usageSnapshot, pricing) : null;

      logger.info('OpenRouter response completed', {
        requestId: input.requestId ?? 'n/a',
        outputChars: text.length,
        corpusTruncated: prompt.corpusTruncated,
        responseText: text
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
      const inputCacheReadUsdPerToken = parseUsdPerToken(modelCard.pricing?.input_cache_read) ?? promptUsdPerToken;
      const inputCacheWriteUsdPerToken = parseUsdPerToken(modelCard.pricing?.input_cache_write) ?? promptUsdPerToken;

      const pricing: TokenPricing = {
        promptUsdPerToken,
        completionUsdPerToken,
        inputCacheReadUsdPerToken,
        inputCacheWriteUsdPerToken
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

    const nonReasoningCompletionTokens =
      usage.completionTokens !== null && usage.reasoningTokens !== null
        ? Math.max(0, usage.completionTokens - usage.reasoningTokens)
        : null;

    logger.info('OpenRouter usage summary', {
      requestId: requestId ?? 'n/a',
      promptTokens: usage.promptTokens ?? 'n/a',
      completionTokens: usage.completionTokens ?? 'n/a',
      reasoningTokens: usage.reasoningTokens ?? 'n/a',
      nonReasoningCompletionTokens: nonReasoningCompletionTokens ?? 'n/a',
      totalTokens: usage.totalTokens ?? 'n/a',
      cachedPromptTokens: usage.cachedPromptTokens ?? 'n/a',
      cacheWritePromptTokens: usage.cacheWritePromptTokens ?? 'n/a',
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

function consumeSseDataPayloads(
  chunk: string,
  flushRemainder: boolean,
  onPayload: (data: string) => void
): { pending: string; done: boolean } {
  let pending = chunk.replace(/\r\n/g, '\n');
  let done = false;

  while (true) {
    const boundaryIndex = pending.indexOf('\n\n');
    if (boundaryIndex < 0) {
      break;
    }

    const eventBlock = pending.slice(0, boundaryIndex);
    pending = pending.slice(boundaryIndex + 2);

    const data = extractSseDataPayload(eventBlock);
    if (!data) {
      continue;
    }

    onPayload(data);
    if (data === '[DONE]') {
      done = true;
    }
  }

  if (flushRemainder) {
    const tail = pending.trim();
    pending = '';
    if (tail) {
      const data = extractSseDataPayload(tail);
      if (data) {
        onPayload(data);
        if (data === '[DONE]') {
          done = true;
        }
      }
    }
  }

  return { pending, done };
}

function extractSseDataPayload(eventBlock: string): string | null {
  const dataLines: string[] = [];

  for (const rawLine of eventBlock.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(':')) {
      continue;
    }

    if (!line.startsWith('data:')) {
      continue;
    }

    dataLines.push(line.slice(5).trimStart());
  }

  if (dataLines.length === 0) {
    return null;
  }

  return dataLines.join('\n').trim();
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

  const firstChoice = choices[0] as {
    delta?: { content?: unknown; text?: unknown };
    message?: { content?: unknown };
  };
  const delta = firstChoice?.delta?.content;

  if (typeof delta === 'string') {
    return delta;
  }

  const deltaText = firstChoice?.delta?.text;
  if (typeof deltaText === 'string') {
    return deltaText;
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

  const messageContent = firstChoice?.message?.content;
  if (typeof messageContent === 'string') {
    return messageContent;
  }

  if (Array.isArray(messageContent)) {
    return messageContent
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
