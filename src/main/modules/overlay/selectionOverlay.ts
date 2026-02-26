import { BrowserWindow } from 'electron';
import { NormalizedRect } from '@main/utils/geometry';

const selectionHtml = encodeURIComponent(`
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
      }
      #box {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        border: 1px solid rgba(236, 239, 241, 0.65);
        background: rgba(236, 239, 241, 0.09);
        border-radius: 6px;
        box-shadow: 0 0 0 1px rgba(20, 24, 28, 0.25) inset;
      }
    </style>
  </head>
  <body>
    <div id="box"></div>
  </body>
</html>
`);

export class SelectionOverlay {
  private window: BrowserWindow | null = null;

  async show(): Promise<void> {
    if (!this.window || this.window.isDestroyed()) {
      this.window = new BrowserWindow({
        width: 2,
        height: 2,
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
      await this.window.loadURL(`data:text/html,${selectionHtml}`);
    }
  }

  updateRect(rect: NormalizedRect | null): void {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }

    if (!rect) {
      this.window.hide();
      return;
    }

    this.window.setBounds({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.max(2, Math.round(rect.width)),
      height: Math.max(2, Math.round(rect.height))
    });
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
