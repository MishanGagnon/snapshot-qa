import { app, BrowserWindow, Menu, Tray, clipboard, nativeImage, screen } from 'electron';
import { join } from 'node:path';
import { HOTKEY_ACTION_DEFINITIONS, HotkeyActionId, LatestResponse } from '@shared/contracts';
import { CaptureService } from '@main/modules/capture/captureService';
import { HotkeyManager } from '@main/modules/hotkeys/hotkeyManager';
import { UiohookHotkeyService } from '@main/modules/hotkeys/uiohookHotkeyService';
import { InferenceCoordinator } from '@main/modules/inference/inferenceCoordinator';
import { OpenRouterClient } from '@main/modules/inference/openRouterClient';
import { registerIpcHandlers } from '@main/modules/ipc/registerIpcHandlers';
import { IndicatorOverlay } from '@main/modules/overlay/indicatorOverlay';
import { SelectionOverlay } from '@main/modules/overlay/selectionOverlay';
import { PermissionService } from '@main/modules/permissions/permissionService';
import { LatestResponseStore } from '@main/modules/runtime/latestResponseStore';
import { KeyStore } from '@main/modules/security/keyStore';
import { SettingsStore } from '@main/modules/settings/settingsStore';
import { clampRectToBounds, normalizeRect, Point, toRelativeRect } from '@main/utils/geometry';
import { logger } from '@main/utils/logger';

let tray: Tray | null = null;
let settingsWindow: BrowserWindow | null = null;
let isQuitting = false;

let keyStore: KeyStore | null = null;
let settingsStore: SettingsStore | null = null;
let permissionService: PermissionService | null = null;
let inferenceCoordinator: InferenceCoordinator | null = null;
let captureService: CaptureService | null = null;
let hotkeyManager: HotkeyManager | null = null;

const selectionOverlay = new SelectionOverlay();
const indicatorOverlay = new IndicatorOverlay();

let captureSession: {
  startPoint: Point;
  displayBounds: Electron.Rectangle;
  display: Electron.Display;
  poll?: NodeJS.Timeout;
} | null = null;

let indicatorPoll: NodeJS.Timeout | null = null;

// Tune capture anchor so selection uses the cursor's top-right corner.
const CAPTURE_CURSOR_ANCHOR_OFFSET = {
  x: 14,
  y: -20
} as const;

function getCaptureAnchorPoint(rawPoint: Point): Point {
  return {
    x: rawPoint.x + CAPTURE_CURSOR_ANCHOR_OFFSET.x,
    y: rawPoint.y + CAPTURE_CURSOR_ANCHOR_OFFSET.y
  };
}

function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 760,
    height: 620,
    show: false,
    title: 'Discreet QA Settings',
    backgroundColor: '#0e1318',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    void win.loadURL(rendererUrl);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  win.on('close', (event) => {
    if (isQuitting) {
      return;
    }
    event.preventDefault();
    win.hide();
  });

  // Open settings automatically on app launch, then allow hide/toggle via tray.
  win.once('ready-to-show', () => {
    if (!isQuitting) {
      win.show();
    }
  });

  return win;
}

function createTray(): Tray {
  const icon = nativeImage
    .createFromDataURL(
      `data:image/svg+xml;base64,${Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#e7ecef" /></svg>`
      ).toString('base64')}`
    )
    .resize({ width: 16, height: 16 });

  const nextTray = new Tray(icon);
  nextTray.setToolTip('Discreet QA');
  nextTray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Open Settings',
        click: () => settingsWindow?.show()
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit',
        click: () => {
          app.removeAllListeners('window-all-closed');
          app.quit();
        }
      }
    ])
  );

  nextTray.on('click', () => {
    if (!settingsWindow) {
      return;
    }

    if (settingsWindow.isVisible()) {
      settingsWindow.hide();
      return;
    }

    settingsWindow.show();
  });

  return nextTray;
}

function getSettingsStore(): SettingsStore | null {
  if (!settingsStore) {
    logger.warn('Settings store not initialized yet.');
    return null;
  }
  return settingsStore;
}

function getInferenceCoordinator(): InferenceCoordinator | null {
  if (!inferenceCoordinator) {
    logger.warn('Inference coordinator not initialized yet.');
    return null;
  }
  return inferenceCoordinator;
}

function handleHotkeyStart(actionId: HotkeyActionId): void {
  if (actionId === 'capture_region') {
    startCapture();
    return;
  }

  if (actionId === 'show_latest_response') {
    startIndicatorPreview();
  }
}

function handleHotkeyEnd(actionId: HotkeyActionId): void {
  if (actionId === 'capture_region') {
    void finishCapture();
    return;
  }

  if (actionId === 'show_latest_response') {
    stopIndicatorPreview();
  }
}

function startCapture(): void {
  if (captureSession) {
    return;
  }

  const store = getSettingsStore();
  if (!store) {
    return;
  }

  const startPoint = getCaptureAnchorPoint(screen.getCursorScreenPoint());
  const display = screen.getDisplayNearestPoint(startPoint);
  const { showSelectionBox } = store.get().general;

  captureSession = {
    startPoint,
    display,
    displayBounds: display.bounds
  };

  if (!showSelectionBox) {
    return;
  }

  void selectionOverlay.show(display.bounds);
  captureSession.poll = setInterval(() => {
    if (!captureSession) {
      return;
    }

    const current = getCaptureAnchorPoint(screen.getCursorScreenPoint());
    const normalized = normalizeRect(captureSession.startPoint, current);
    const clamped = clampRectToBounds(normalized, captureSession.displayBounds);
    selectionOverlay.updateRect(clamped ? toRelativeRect(clamped, captureSession.displayBounds) : null);
  }, 16);
}

async function finishCapture(): Promise<void> {
  const session = captureSession;
  captureSession = null;

  if (!session) {
    return;
  }

  if (session.poll) {
    clearInterval(session.poll);
  }
  selectionOverlay.hide();

  const coordinator = getInferenceCoordinator();
  const store = getSettingsStore();
  if (!coordinator || !store || !captureService) {
    return;
  }

  const endPoint = getCaptureAnchorPoint(screen.getCursorScreenPoint());
  const normalized = normalizeRect(session.startPoint, endPoint);
  const clamped = clampRectToBounds(normalized, session.displayBounds);

  if (!clamped) {
    logger.warn('Capture ignored due to tiny region.');
    return;
  }

  try {
    const image = await captureService.captureRegion(session.display, clamped);
    await coordinator.runCaptureQuery(image, store.get().general);
  } catch (error) {
    logger.error('Failed to capture region or run inference.', {
      reason: error instanceof Error ? error.message : 'unknown'
    });
  }
}

function startIndicatorPreview(): void {
  if (indicatorPoll) {
    return;
  }

  const coordinator = getInferenceCoordinator();
  if (!coordinator) {
    return;
  }

  const tick = () => {
    const point = screen.getCursorScreenPoint();
    const latest = coordinator.getLatestState();
    void renderIndicatorAt(point, latest);
  };

  tick();
  indicatorPoll = setInterval(tick, 33);
}

function stopIndicatorPreview(): void {
  if (indicatorPoll) {
    clearInterval(indicatorPoll);
    indicatorPoll = null;
  }

  indicatorOverlay.hide();
}

async function renderIndicatorAt(point: Point, latest: LatestResponse): Promise<void> {
  if (latest.status === 'idle') {
    indicatorOverlay.hide();
    return;
  }

  const coordinator = getInferenceCoordinator();
  if (!coordinator) {
    return;
  }

  if (latest.status === 'pending') {
    await indicatorOverlay.showAt(point, {
      state: 'pending'
    });
    return;
  }

  if (latest.status === 'complete') {
    coordinator.copyLatestForDisplay((text) => clipboard.writeText(text));
    await indicatorOverlay.showAt(point, {
      state: 'complete',
      text: latest.text
    });
    return;
  }

  if (latest.status === 'error') {
    coordinator.copyLatestForDisplay((text) => clipboard.writeText(text));
    await indicatorOverlay.showAt(point, {
      state: 'error',
      text: latest.text
    });
  }
}

function applyLaunchAtLoginSetting(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled
  });
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  keyStore = new KeyStore();
  settingsStore = new SettingsStore();
  permissionService = new PermissionService();
  captureService = new CaptureService();

  const latestResponseStore = new LatestResponseStore();
  inferenceCoordinator = new InferenceCoordinator(
    new OpenRouterClient(),
    latestResponseStore,
    () => keyStore!.getOpenRouterKey()
  );

  hotkeyManager = new HotkeyManager(
    new UiohookHotkeyService(),
    settingsStore.get().hotkeys,
    handleHotkeyStart,
    handleHotkeyEnd
  );

  settingsWindow = createSettingsWindow();
  tray = createTray();

  applyLaunchAtLoginSetting(settingsStore.get().general.launchAtLogin);
  hotkeyManager.start();

  registerIpcHandlers({
    settingsStore,
    keyStore,
    hotkeyManager,
    inferenceCoordinator,
    permissionService
  });

  logger.info('Application initialized', {
    hotkeys: HOTKEY_ACTION_DEFINITIONS.map((action) => action.id).join(', ')
  });
});

app.on('activate', () => {
  settingsWindow?.show();
});

app.on('window-all-closed', (event) => {
  if (!isQuitting) {
    event.preventDefault();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  hotkeyManager?.stop();
  selectionOverlay.destroy();
  indicatorOverlay.destroy();
  tray?.destroy();
  tray = null;
});
