import { describe, expect, it, vi } from 'vitest';
import { LatestResponseStore } from '@main/modules/runtime/latestResponseStore';
import { InferenceCoordinator } from './inferenceCoordinator';
import { OpenRouterClient } from './openRouterClient';

class FakeClient {
  constructor(private readonly answer: string) {}

  async runVisionQuery(): Promise<{ text: string; corpusTruncated: boolean }> {
    return {
      text: this.answer,
      corpusTruncated: false
    };
  }
}

describe('InferenceCoordinator', () => {
  it('marks missing context without calling model', async () => {
    const store = new LatestResponseStore();
    const client = new FakeClient('diegetic') as unknown as OpenRouterClient;
    const coordinator = new InferenceCoordinator(client, store, async () => 'abc');

    await coordinator.runCaptureQuery(Buffer.from('fake'), {
      corpus: '   ',
      customInfo: '',
      defaultModel: 'google/gemini-3-flash-preview',
      showSelectionBox: true,
      launchAtLogin: false
    });

    const latest = coordinator.getLatestState();
    expect(latest.status).toBe('error');
    expect(latest.text).toBe('missing_context');
  });

  it('copies complete answer once per response', async () => {
    const store = new LatestResponseStore();
    const client = new FakeClient('diegetic') as unknown as OpenRouterClient;
    const coordinator = new InferenceCoordinator(client, store, async () => 'abc');

    await coordinator.runCaptureQuery(Buffer.from('fake'), {
      corpus: 'term definitions',
      customInfo: '',
      defaultModel: 'google/gemini-3-flash-preview',
      showSelectionBox: true,
      launchAtLogin: false
    });

    const writer = vi.fn();
    coordinator.copyLatestForDisplay(writer);
    coordinator.copyLatestForDisplay(writer);

    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer).toHaveBeenCalledWith('diegetic');
  });
});
