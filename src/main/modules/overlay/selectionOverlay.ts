import { BrowserWindow, Rectangle } from 'electron';
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
        position: absolute;
        box-sizing: border-box;
        border: 1px solid rgba(236, 239, 241, 0.65);
        background: rgba(236, 239, 241, 0.09);
        border-radius: 6px;
        box-shadow: 0 0 0 1px rgba(20, 24, 28, 0.25) inset;
        display: none;
      }
    </style>
  </head>
  <body>
    <div id="box"></div>
    <script>
      const { ipcRenderer } = require('electron');
      const box = document.getElementById('box');
      ipcRenderer.on('overlay:selection:update', (_event, rect) => {
        if (!rect) {
          box.style.display = 'none';
          return;
        }
        box.style.display = 'block';
        box.style.left = rect.x + 'px';
        box.style.top = rect.y + 'px';
        box.style.width = rect.width + 'px';
        box.style.height = rect.height + 'px';
      });
    </script>
  </body>
</html>
`);

export class SelectionOverlay {
  private window: BrowserWindow | null = null;

  async show(bounds: Rectangle): Promise<void> {
    if (!this.window || this.window.isDestroyed()) {
      this.window = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
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

    this.window.setBounds(bounds);
    this.window.showInactive();
  }

  updateRect(rect: NormalizedRect | null): void {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }

    this.window.webContents.send('overlay:selection:update', rect);
  }

  hide(): void {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }

    this.window.webContents.send('overlay:selection:update', null);
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
