import { describe, expect, it, vi } from 'vitest';
import { LatestResponseStore } from '@main/modules/runtime/latestResponseStore';
import { InferenceCoordinator } from './inferenceCoordinator';
import { OpenRouterClient } from './openRouterClient';

class FakeClient {
  constructor(private readonly answer: string) {}

  async runVisionQuery(): Promise<{
    text: string;
    corpusTruncated: boolean;
    usage: null;
    costEstimateUsd: null;
    reportedCostUsd: null;
  }> {
    return {
      text: this.answer,
      corpusTruncated: false,
      usage: null,
      costEstimateUsd: null,
      reportedCostUsd: null
    };
  }
}

describe('InferenceCoordinator', () => {
  it('marks missing context without calling model', async () => {
    const store = new LatestResponseStore();
    const client = new FakeClient('diegetic') as unknown as OpenRouterClient;
    const coordinator = new InferenceCoordinator(client, store, async () => 'abc');

    await coordinator.runCaptureQuery(
      {
        buffer: Buffer.from('fake'),
        mimeType: 'image/png',
        width: 100,
        height: 100,
        compressed: false
      },
      {
      corpus: '   ',
      customInfo: '',
      defaultModel: 'google/gemini-3-flash-preview',
      showSelectionBox: true,
      launchAtLogin: false,
      imageCompressionEnabled: true,
      contextCachingEnabled: true
    }
    );

    const latest = coordinator.getLatestState();
    expect(latest.status).toBe('error');
    expect(latest.text).toBe('missing_context');
  });

  it('copies complete answer once per response', async () => {
    const store = new LatestResponseStore();
    const client = new FakeClient('diegetic') as unknown as OpenRouterClient;
    const coordinator = new InferenceCoordinator(client, store, async () => 'abc');

    await coordinator.runCaptureQuery(
      {
        buffer: Buffer.from('fake'),
        mimeType: 'image/png',
        width: 100,
        height: 100,
        compressed: false
      },
      {
      corpus: 'term definitions',
      customInfo: '',
      defaultModel: 'google/gemini-3-flash-preview',
      showSelectionBox: true,
      launchAtLogin: false,
      imageCompressionEnabled: true,
      contextCachingEnabled: true
    }
    );

    const writer = vi.fn();
    coordinator.copyLatestForDisplay(writer);
    coordinator.copyLatestForDisplay(writer);

    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer).toHaveBeenCalledWith('diegetic');
  });
});
