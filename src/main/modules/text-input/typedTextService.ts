import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '@main/utils/logger';

const execFileAsync = promisify(execFile);
const FAST_CHUNK_SIZE = 56;
const THROTTLE_CHUNK_SIZE = 28;
const THROTTLE_TEXT_LENGTH_CHARS = 320;
const HEAVY_THROTTLE_TEXT_LENGTH_CHARS = 780;
const THROTTLE_DELAY_SECONDS = 0.0054;
const HEAVY_THROTTLE_DELAY_SECONDS = 0.0118;
const THROTTLE_EVERY_CHUNKS = 2;
const HEAVY_THROTTLE_EVERY_CHUNKS = 1;
const RETURN_KEY_CODE = 36;
const TAB_KEY_CODE = 48;

interface TypingThrottleProfile {
  enabled: boolean;
  delaySeconds: number;
  everyChunks: number;
  chunkSize: number;
  mode: 'size' | 'word';
}

export class TypedTextService {
  private queue: Promise<void> = Promise.resolve();

  typeText(text: string, source: string): Promise<void> {
    this.queue = this.queue
      .then(async () => {
        if (!text) {
          return;
        }

        logger.info('Typing text via keyboard events', {
          source,
          textChars: text.length
        });
        await runAppleScriptTyping(text);
      })
      .catch((error) => {
        logger.warn('Failed to type text via keyboard events', {
          source,
          reason: error instanceof Error ? error.message : 'unknown'
        });
      });

    return this.queue;
  }
}

async function runAppleScriptTyping(text: string): Promise<void> {
  const args = buildAppleScriptArgs(text);
  await execFileAsync('osascript', args);
}

function buildAppleScriptArgs(text: string): string[] {
  const args: string[] = ['-e', 'tell application "System Events"'];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const throttle = getTypingThrottleProfile(normalized);
  let chunksTyped = 0;

  const lines = normalized.split('\n');
  lines.forEach((line, lineIndex) => {
    const tabSegments = line.split('\t');
    tabSegments.forEach((segment, segmentIndex) => {
      if (segment.length > 0) {
        for (const chunk of chunkText(segment, throttle)) {
          args.push('-e', `keystroke "${escapeForAppleScript(chunk)}"`);
          chunksTyped += 1;
          if (throttle.enabled && chunksTyped % throttle.everyChunks === 0) {
            args.push('-e', `delay ${throttle.delaySeconds}`);
          }
        }
      }

      if (segmentIndex < tabSegments.length - 1) {
        args.push('-e', `key code ${TAB_KEY_CODE}`);
        if (throttle.enabled) {
          args.push('-e', `delay ${throttle.delaySeconds}`);
        }
      }
    });

    if (lineIndex < lines.length - 1) {
      args.push('-e', `key code ${RETURN_KEY_CODE}`);
      if (throttle.enabled) {
        args.push('-e', `delay ${throttle.delaySeconds}`);
      }
    }
  });

  args.push('-e', 'end tell');
  return args;
}

function chunkText(value: string, profile: TypingThrottleProfile): string[] {
  if (profile.mode === 'word') {
    return chunkWords(value);
  }

  const chunkSize = profile.chunkSize;
  if (value.length <= chunkSize) {
    return [value];
  }

  const tokens = value.split(/(\s+)/).filter((token) => token.length > 0);
  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (!current.length) {
      return;
    }
    chunks.push(current);
    current = '';
  };

  for (const token of tokens) {
    if (token.length > chunkSize) {
      pushCurrent();
      for (let index = 0; index < token.length; index += chunkSize) {
        chunks.push(token.slice(index, index + chunkSize));
      }
      continue;
    }

    if (!current.length) {
      current = token;
      continue;
    }

    if (current.length + token.length <= chunkSize) {
      current += token;
      continue;
    }

    pushCurrent();
    current = token;
  }

  pushCurrent();
  return chunks;
}

function getTypingThrottleProfile(text: string): TypingThrottleProfile {
  if (text.length >= HEAVY_THROTTLE_TEXT_LENGTH_CHARS) {
    return {
      enabled: true,
      delaySeconds: HEAVY_THROTTLE_DELAY_SECONDS,
      everyChunks: HEAVY_THROTTLE_EVERY_CHUNKS,
      chunkSize: 0,
      mode: 'word'
    };
  }

  if (text.length >= THROTTLE_TEXT_LENGTH_CHARS) {
    return {
      enabled: true,
      delaySeconds: THROTTLE_DELAY_SECONDS,
      everyChunks: THROTTLE_EVERY_CHUNKS,
      chunkSize: THROTTLE_CHUNK_SIZE,
      mode: 'size'
    };
  }

  return {
    enabled: false,
    delaySeconds: THROTTLE_DELAY_SECONDS,
    everyChunks: THROTTLE_EVERY_CHUNKS,
    chunkSize: FAST_CHUNK_SIZE,
    mode: 'size'
  };
}

function chunkWords(value: string): string[] {
  const tokens = value.match(/\S+\s*|\s+/g);
  if (!tokens || tokens.length === 0) {
    return [value];
  }

  return tokens.filter((token) => token.length > 0);
}

function escapeForAppleScript(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
