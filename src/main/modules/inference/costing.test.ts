import { describe, expect, it } from 'vitest';
import { estimateTokenCostUsd, normalizeUsage, parseUsdPerToken, toFixedUsd } from './costing';

describe('normalizeUsage', () => {
  it('normalizes standard usage payload keys', () => {
    const usage = normalizeUsage({
      prompt_tokens: 120,
      completion_tokens: 30,
      total_tokens: 150
    });

    expect(usage).toEqual({
      promptTokens: 120,
      completionTokens: 30,
      totalTokens: 150,
      cachedPromptTokens: null,
      cacheWritePromptTokens: null,
      costUsd: null
    });
  });

  it('normalizes input/output token keys', () => {
    const usage = normalizeUsage({
      input_tokens: '200',
      output_tokens: '20'
    });

    expect(usage).toEqual({
      promptTokens: 200,
      completionTokens: 20,
      totalTokens: null,
      cachedPromptTokens: null,
      cacheWritePromptTokens: null,
      costUsd: null
    });
  });

  it('captures direct cost when provided by upstream usage payload', () => {
    const usage = normalizeUsage({
      prompt_tokens: 10,
      completion_tokens: 5,
      cost: 0.000025
    });

    expect(usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: null,
      cachedPromptTokens: null,
      cacheWritePromptTokens: null,
      costUsd: 0.000025
    });
  });

  it('captures prompt cache detail tokens', () => {
    const usage = normalizeUsage({
      prompt_tokens: 2000,
      completion_tokens: 20,
      prompt_tokens_details: {
        cached_tokens: 1500,
        cache_write_tokens: 300
      }
    });

    expect(usage).toEqual({
      promptTokens: 2000,
      completionTokens: 20,
      totalTokens: null,
      cachedPromptTokens: 1500,
      cacheWritePromptTokens: 300,
      costUsd: null
    });
  });

  it('returns null when no token fields are present', () => {
    expect(normalizeUsage({ foo: 'bar' })).toBeNull();
  });
});

describe('estimateTokenCostUsd', () => {
  it('estimates total token cost from usage and rates', () => {
    const estimate = estimateTokenCostUsd(
      {
        promptTokens: 1000,
        completionTokens: 200,
        totalTokens: 1200,
        cachedPromptTokens: 0,
        cacheWritePromptTokens: 0,
        costUsd: null
      },
      {
        promptUsdPerToken: 0.0000005,
        completionUsdPerToken: 0.000003,
        inputCacheReadUsdPerToken: 0.00000005,
        inputCacheWriteUsdPerToken: 0.00000008333333333333334
      }
    );

    expect(estimate.promptUsd).toBeCloseTo(0.0005, 10);
    expect(estimate.completionUsd).toBeCloseTo(0.0006, 10);
    expect(estimate.totalUsd).toBeCloseTo(0.0011, 10);
  });

  it('applies cache read/write pricing when usage includes cached tokens', () => {
    const estimate = estimateTokenCostUsd(
      {
        promptTokens: 2000,
        completionTokens: 10,
        totalTokens: 2010,
        cachedPromptTokens: 1500,
        cacheWritePromptTokens: 300,
        costUsd: null
      },
      {
        promptUsdPerToken: 0.0000005,
        completionUsdPerToken: 0.000003,
        inputCacheReadUsdPerToken: 0.00000005,
        inputCacheWriteUsdPerToken: 0.00000008333333333333334
      }
    );

    // Prompt: 200 uncached + 1500 read-cached + 300 write-cached.
    expect(estimate.promptUsd).toBeCloseTo(0.0002, 10);
    expect(estimate.completionUsd).toBeCloseTo(0.00003, 10);
    expect(estimate.totalUsd).toBeCloseTo(0.00023, 10);
  });
});

describe('price parsing and formatting', () => {
  it('parses usd-per-token string values', () => {
    expect(parseUsdPerToken('0.0000005')).toBeCloseTo(0.0000005, 12);
  });

  it('formats usd values with fixed precision', () => {
    expect(toFixedUsd(0.0011)).toBe('0.00110000');
  });
});
