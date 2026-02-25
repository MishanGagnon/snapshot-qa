import { ErrorCode } from '@shared/contracts';
import { InferenceError } from './errors';
import { buildPrompt } from './promptBuilder';
import { logger } from '@main/utils/logger';

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
}

export class OpenRouterClient {
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

          const delta = extractDeltaText(data);
          if (delta) {
            aggregated += delta;
            input.onToken?.(delta);
          }
        }
      }

      const text = aggregated.trim() || 'unknown';
      logger.info('OpenRouter response completed', {
        requestId: input.requestId ?? 'n/a',
        outputChars: text.length,
        corpusTruncated: prompt.corpusTruncated
      });
      return {
        text,
        corpusTruncated: prompt.corpusTruncated
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
}

function extractDeltaText(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    const delta = parsed?.choices?.[0]?.delta?.content;

    if (typeof delta === 'string') {
      return delta;
    }

    if (Array.isArray(delta)) {
      return delta
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }
          if (typeof item?.text === 'string') {
            return item.text;
          }
          return '';
        })
        .join('');
    }

    return '';
  } catch {
    return '';
  }
}
