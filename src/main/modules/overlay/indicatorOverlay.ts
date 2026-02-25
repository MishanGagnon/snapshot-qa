import { BrowserWindow } from 'electron';
import { Point } from '@main/utils/geometry';
import { logger } from '@main/utils/logger';

type IndicatorState = 'pending' | 'complete' | 'error';
interface IndicatorVisualOptions {
  ultraDiscreteMode: boolean;
  showResponseChrome: boolean;
}

const indicatorHtml = encodeURIComponent(`
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: transparent;
      }
      #root {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #bubble {
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        min-width: 10px;
        min-height: 10px;
        border-radius: 6px;
        padding: 2px 6px;
        font-family: "Avenir Next", "IBM Plex Sans", "Helvetica Neue", sans-serif;
        font-size: 12px;
        line-height: 1.3;
        letter-spacing: 0.01em;
        text-align: center;
        color: #eef2f4;
        background: rgba(25, 30, 36, 0.88);
        border: 1px solid rgba(238, 242, 244, 0.2);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.52);
        backdrop-filter: blur(6px) saturate(110%);
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      #bubble.pending {
        width: 10px;
        min-width: 10px;
        height: 10px;
        min-height: 10px;
        padding: 0;
        border-radius: 3px;
        background: rgba(218, 165, 32, 0.95);
        border: 1px solid rgba(218, 165, 32, 0.95);
      }
      #bubble.error {
        width: 10px;
        min-width: 10px;
        height: 10px;
        min-height: 10px;
        padding: 0;
        border-radius: 3px;
        background: rgba(191, 61, 61, 0.94);
        border: 1px solid rgba(191, 61, 61, 0.94);
      }
      #bubble.no-chrome {
        border-color: transparent;
        border-width: 0;
        box-shadow: none;
        background: rgba(25, 30, 36, 0.58);
      }
      #bubble.complete.ultra-discrete {
        color: rgba(145, 156, 170, 0.86);
        background: transparent;
        border-color: transparent;
        border-width: 0;
        box-shadow: none;
        text-shadow: none;
        backdrop-filter: none;
        padding: 0 1px;
      }
      #bubble.complete.ultra-discrete.no-chrome {
        color: rgba(145, 156, 170, 0.82);
        background: transparent;
        border-width: 0;
        box-shadow: none;
        text-shadow: none;
        backdrop-filter: none;
        padding: 0 1px;
      }
      #bubble.pending.no-chrome,
      #bubble.error.no-chrome {
        border-color: transparent;
        border-width: 0;
        box-shadow: none;
      }
    </style>
  </head>
  <body>
    <div id="root">
      <div id="bubble"></div>
    </div>
    <script>
      const { ipcRenderer } = require('electron');
      const bubble = document.getElementById('bubble');
      ipcRenderer.on('overlay:indicator:update', (_event, payload) => {
        const classes = [payload.state];
        if (payload.ultraDiscreteMode) {
          classes.push('ultra-discrete');
        }
        if (payload.showResponseChrome === false) {
          classes.push('no-chrome');
        }
        bubble.className = classes.join(' ');
        bubble.textContent = payload.state === 'complete' ? payload.text : '';
      });
    </script>
  </body>
</html>
`);

export class IndicatorOverlay {
  private window: BrowserWindow | null = null;
  private lastLoggedDisplaySignature: string | null = null;

  async showAt(point: Point, payload: { state: IndicatorState; text?: string } & IndicatorVisualOptions): Promise<void> {
    if (!this.window || this.window.isDestroyed()) {
      this.window = new BrowserWindow({
        width: 160,
        height: 26,
        frame: false,
        transparent: true,
        show: false,
        focusable: false,
        resizable: false,
        movable: false,
        fullscreenable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        hasShadow: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          devTools: false
        }
      });

      this.window.setIgnoreMouseEvents(true, { forward: true });
      await this.window.loadURL(`data:text/html,${indicatorHtml}`);
    }

    const displayText = payload.state === 'complete' || payload.state === 'error' ? payload.text ?? '' : '';
    const displaySignature = [
      payload.state,
      payload.ultraDiscreteMode ? 'u1' : 'u0',
      payload.showResponseChrome ? 'c1' : 'c0',
      displayText
    ].join('|');

    if (this.lastLoggedDisplaySignature !== displaySignature) {
      this.lastLoggedDisplaySignature = displaySignature;
      logger.info('Indicator overlay target display', {
        state: payload.state,
        displayText,
        displayTextChars: displayText.length,
        ultraDiscreteMode: payload.ultraDiscreteMode,
        showResponseChrome: payload.showResponseChrome
      });
    }

    const bounds = getBounds(payload);
    this.window.setBounds({
      x: point.x,
      y: point.y,
      width: bounds.width,
      height: bounds.height
    });

    this.window.webContents.send('overlay:indicator:update', payload);
    this.window.showInactive();
  }

  hide(): void {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }

    this.lastLoggedDisplaySignature = null;
    this.window.hide();
  }

  destroy(): void {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }

    this.lastLoggedDisplaySignature = null;
    this.window.destroy();
    this.window = null;
  }
}

const COMPLETE_BUBBLE_MIN_WIDTH = 24;
const COMPLETE_BUBBLE_MAX_WIDTH = 420;
const COMPLETE_BUBBLE_MIN_HEIGHT = 22;
const COMPLETE_BUBBLE_MAX_LINES = 6;
const COMPLETE_BUBBLE_HORIZONTAL_CHROME = 16;
const COMPLETE_BUBBLE_VERTICAL_CHROME = 8;
const COMPLETE_BUBBLE_LINE_HEIGHT = 15;
const AVERAGE_GLYPH_WIDTH = 6.4;

function getBounds(payload: {
  state: IndicatorState;
  text?: string;
  ultraDiscreteMode?: boolean;
}): { width: number; height: number } {
  if (payload.state === 'pending' || payload.state === 'error') {
    return {
      width: 14,
      height: 14
    };
  }

  const isTextOnly = payload.ultraDiscreteMode;
  const horizontalChrome = isTextOnly ? 4 : COMPLETE_BUBBLE_HORIZONTAL_CHROME;
  const verticalChrome = isTextOnly ? 2 : COMPLETE_BUBBLE_VERTICAL_CHROME;
  const minHeight = isTextOnly ? 16 : COMPLETE_BUBBLE_MIN_HEIGHT;

  const text = (payload.text ?? '').trim() || 'unknown';
  const lines = text.replace(/\r/g, '').split('\n');
  const longestLineLength = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const estimatedLineWidth = Math.max(1, longestLineLength * AVERAGE_GLYPH_WIDTH);

  const width = clamp(
    Math.ceil(estimatedLineWidth + horizontalChrome),
    COMPLETE_BUBBLE_MIN_WIDTH,
    COMPLETE_BUBBLE_MAX_WIDTH
  );

  const usableTextWidth = Math.max(1, width - horizontalChrome);
  const wrappedLineCount = lines.reduce((total, line) => {
    const lineWidth = Math.max(1, line.length * AVERAGE_GLYPH_WIDTH);
    return total + Math.max(1, Math.ceil(lineWidth / usableTextWidth));
  }, 0);
  const lineCount = clamp(wrappedLineCount, 1, COMPLETE_BUBBLE_MAX_LINES);

  return {
    width,
    height: minHeight + (lineCount - 1) * COMPLETE_BUBBLE_LINE_HEIGHT + verticalChrome
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
