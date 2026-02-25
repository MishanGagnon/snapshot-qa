import { GeneralSettings } from '@shared/contracts';
import { InferenceError } from './errors';
import { OpenRouterClient } from './openRouterClient';
import { LatestResponseStore } from '@main/modules/runtime/latestResponseStore';

export class InferenceCoordinator {
  private sequence = 0;
  private activeAbort: AbortController | null = null;

  constructor(
    private readonly client: OpenRouterClient,
    private readonly latestStore: LatestResponseStore,
    private readonly getOpenRouterKey: () => Promise<string | null>
  ) {}

  getLatestState() {
    return this.latestStore.get();
  }

  async runCaptureQuery(imageBuffer: Buffer, settings: GeneralSettings): Promise<void> {
    const responseId = ++this.sequence;
    this.latestStore.setPending(responseId);

    this.activeAbort?.abort();
    const controller = new AbortController();
    this.activeAbort = controller;

    if (!settings.corpus.trim()) {
      this.latestStore.setError(responseId, 'missing_context', 'MISSING_CONTEXT');
      return;
    }

    const apiKey = await this.getOpenRouterKey();
    if (!apiKey) {
      this.latestStore.setError(responseId, 'missing_key', 'MISSING_KEY');
      return;
    }

    try {
      const result = await this.client.runVisionQuery({
        apiKey,
        model: settings.defaultModel,
        corpus: settings.corpus,
        customInfo: settings.customInfo,
        imageBuffer,
        timeoutMs: 20_000,
        signal: controller.signal
      });

      const finalText = normalizeAnswer(result.text);
      this.latestStore.setComplete(responseId, finalText);
    } catch (error) {
      if (controller.signal.aborted && this.sequence !== responseId) {
        return;
      }

      const inferenceError =
        error instanceof InferenceError
          ? error
          : new InferenceError('MODEL_ERROR', error instanceof Error ? error.message : 'Model request failed.');

      this.latestStore.setError(responseId, mapErrorText(inferenceError.code), inferenceError.code);
    }
  }

  copyLatestForDisplay(writer: (text: string) => void): void {
    const latest = this.latestStore.get();
    if (latest.status !== 'complete' && latest.status !== 'error') {
      return;
    }

    if (latest.copiedForDisplay) {
      return;
    }

    writer(latest.text);
    this.latestStore.markCopiedForDisplay(latest.responseId);
  }
}

function normalizeAnswer(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'unknown';
  }

  const sanitized = trimmed.replace(/[\r\n]+/g, ' ').trim();
  return sanitized || 'unknown';
}

function mapErrorText(code: InferenceError['code']): string {
  switch (code) {
    case 'TIMEOUT':
      return 'timeout';
    case 'NETWORK':
      return 'network_error';
    case 'MODEL_ERROR':
      return 'model_error';
    case 'PERMISSION_DENIED':
      return 'permission_denied';
    case 'MISSING_CONTEXT':
      return 'missing_context';
    case 'MISSING_KEY':
      return 'missing_key';
    default:
      return 'model_error';
  }
}
