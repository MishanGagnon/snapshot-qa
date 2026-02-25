import { BrowserWindow } from 'electron';
import { Point } from '@main/utils/geometry';

type IndicatorState = 'pending' | 'complete' | 'error';

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
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 10px;
        min-height: 10px;
        max-width: 340px;
        border-radius: 6px;
        padding: 2px 7px;
        font-family: "Avenir Next", "IBM Plex Sans", "Helvetica Neue", sans-serif;
        font-size: 12px;
        letter-spacing: 0.01em;
        color: #eef2f4;
        background: rgba(25, 30, 36, 0.88);
        border: 1px solid rgba(238, 242, 244, 0.2);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
        white-space: nowrap;
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
        bubble.className = payload.state;
        bubble.textContent = payload.state === 'complete' ? payload.text : '';
      });
    </script>
  </body>
</html>
`);

export class IndicatorOverlay {
  private window: BrowserWindow | null = null;

  async showAt(point: Point, payload: { state: IndicatorState; text?: string }): Promise<void> {
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

    const bounds = getBounds(payload);
    this.window.setBounds({
      x: point.x + 12,
      y: point.y + 16,
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

    this.window.hide();
  }

  destroy(): void {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }

    this.window.destroy();
    this.window = null;
  }
}

function getBounds(payload: { state: IndicatorState; text?: string }): { width: number; height: number } {
  if (payload.state === 'pending' || payload.state === 'error') {
    return {
      width: 14,
      height: 14
    };
  }

  const textLength = payload.text?.length ?? 1;
  return {
    width: Math.min(340, Math.max(44, textLength * 8 + 24)),
    height: 28
  };
}
