import { describe, expect, it } from 'vitest';
import { buildPrompt, truncateCorpus } from './promptBuilder';

describe('truncateCorpus', () => {
  it('keeps short corpus untouched', () => {
    const result = truncateCorpus('abc', 10);
    expect(result.truncated).toBe(false);
    expect(result.value).toBe('abc');
  });

  it('truncates oversized corpus and appends marker', () => {
    const result = truncateCorpus('x'.repeat(20), 5);
    expect(result.truncated).toBe(true);
    expect(result.value).toContain('[truncated]');
  });
});

describe('buildPrompt', () => {
  it('builds multimodal payload with minimal-answer policy', () => {
    const result = buildPrompt({
      corpus: 'Term: diegetic means sound from story world.',
      customInfo: 'Use internal definitions first.',
      model: 'google/gemini-3-flash-preview',
      imageBase64: 'ZmFrZS1pbWFnZQ==',
      imageMimeType: 'image/png',
      contextCachingEnabled: true
    });

    expect(result.body.model).toBe('google/gemini-3-flash-preview');
    expect(result.body.max_tokens).toBe(2000);
    expect(result.body.reasoning).toEqual({
      effort: 'xhigh'
    });
    const messages = result.body.messages as Array<{ role: string; content: unknown }>;
    expect(messages[0].role).toBe('system');
    expect(String(messages[0].content)).toContain('Answer using the screenshot and provided context only.');
    expect(result.contextCacheHintApplied).toBe(true);
  });

  it('omits cache control when context caching is disabled', () => {
    const result = buildPrompt({
      corpus: 'Company term glossary',
      customInfo: '',
      model: 'google/gemini-3-flash-preview',
      imageBase64: 'ZmFrZS1pbWFnZQ==',
      imageMimeType: 'image/png',
      contextCachingEnabled: false
    });

    const messages = result.body.messages as Array<{ role: string; content: unknown }>;
    const userContent = messages[1].content as Array<Record<string, unknown>>;
    const corpusPart = userContent[1];
    expect(corpusPart.cache_control).toBeUndefined();
    expect(result.contextCacheHintApplied).toBe(false);
  });

  it('uses reasoning max tokens for non-gemini models', () => {
    const result = buildPrompt({
      corpus: 'Company term glossary',
      customInfo: '',
      model: 'openai/gpt-5',
      imageBase64: 'ZmFrZS1pbWFnZQ==',
      imageMimeType: 'image/png',
      contextCachingEnabled: false
    });

    expect(result.body.reasoning).toEqual({
      max_tokens: 2000
    });
    expect(result.body.max_tokens).toBe(2000);
  });
});
