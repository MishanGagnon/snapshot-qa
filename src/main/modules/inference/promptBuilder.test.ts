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
      imageBase64: 'ZmFrZS1pbWFnZQ=='
    });

    expect(result.body.model).toBe('google/gemini-3-flash-preview');
    const messages = result.body.messages as Array<{ role: string; content: unknown }>;
    expect(messages[0].role).toBe('system');
    expect(String(messages[0].content)).toContain('unknown');
  });
});
