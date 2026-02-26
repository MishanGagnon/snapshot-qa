import { BrowserWindow } from 'electron';
import { Point } from '@main/utils/geometry';

const DOT_SIZE = 10;
const DOT_RADIUS = Math.floor(DOT_SIZE / 2);

interface CursorDebugOverlayOptions {
  dotColor?: string;
}

export class CursorDebugOverlay {
  private window: BrowserWindow | null = null;
  private readonly dotColor: string;

  constructor(options: CursorDebugOverlayOptions = {}) {
    this.dotColor = options.dotColor ?? 'rgba(255, 76, 76, 0.95)';
  }

  async showAt(point: Point): Promise<void> {
    if (!this.window || this.window.isDestroyed()) {
      this.window = new BrowserWindow({
        width: DOT_SIZE,
        height: DOT_SIZE,
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
          nodeIntegration: false,
          contextIsolation: true,
          devTools: false
        }
      });

      this.window.setIgnoreMouseEvents(true, { forward: true });
      await this.window.loadURL(`data:text/html,${buildCursorDebugHtml(this.dotColor)}`);
    }

    this.window.setBounds({
      x: Math.round(point.x - DOT_RADIUS),
      y: Math.round(point.y - DOT_RADIUS),
      width: DOT_SIZE,
      height: DOT_SIZE
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

function buildCursorDebugHtml(dotColor: string): string {
  return encodeURIComponent(`
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
      #root {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #dot {
        box-sizing: border-box;
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: ${dotColor};
        border: 1px solid rgba(255, 255, 255, 0.92);
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.52);
      }
    </style>
  </head>
  <body>
    <div id="root">
      <div id="dot"></div>
    </div>
  </body>
</html>
`);
}
