import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '@main/utils/logger';

const execFileAsync = promisify(execFile);
const TYPE_CHUNK_SIZE = 120;
const RETURN_KEY_CODE = 36;
const TAB_KEY_CODE = 48;

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

  const lines = normalized.split('\n');
  lines.forEach((line, lineIndex) => {
    const tabSegments = line.split('\t');
    tabSegments.forEach((segment, segmentIndex) => {
      if (segment.length > 0) {
        for (const chunk of chunkText(segment, TYPE_CHUNK_SIZE)) {
          args.push('-e', `keystroke "${escapeForAppleScript(chunk)}"`);
        }
      }

      if (segmentIndex < tabSegments.length - 1) {
        args.push('-e', `key code ${TAB_KEY_CODE}`);
      }
    });

    if (lineIndex < lines.length - 1) {
      args.push('-e', `key code ${RETURN_KEY_CODE}`);
    }
  });

  args.push('-e', 'end tell');
  return args;
}

function chunkText(value: string, chunkSize: number): string[] {
  if (value.length <= chunkSize) {
    return [value];
  }

  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += chunkSize) {
    chunks.push(value.slice(index, index + chunkSize));
  }
  return chunks;
}

function escapeForAppleScript(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
