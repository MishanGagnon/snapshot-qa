import { app, BrowserWindow, Menu, Tray, clipboard, nativeImage, screen } from 'electron';
import { join } from 'node:path';
import { HOTKEY_ACTION_DEFINITIONS, HotkeyActionId, LatestResponse, SnippetHotkeyActionId, TextSnippetId } from '@shared/contracts';
import { CaptureService } from '@main/modules/capture/captureService';
import { CursorPositionService } from '@main/modules/cursor/cursorPositionService';
import { HotkeyManager } from '@main/modules/hotkeys/hotkeyManager';
import { KeyspyHotkeyService } from '@main/modules/hotkeys/keyspyHotkeyService';
import { InferenceCoordinator } from '@main/modules/inference/inferenceCoordinator';
import { OpenRouterClient } from '@main/modules/inference/openRouterClient';
import { registerIpcHandlers } from '@main/modules/ipc/registerIpcHandlers';
import { CursorDebugOverlay } from '@main/modules/overlay/cursorDebugOverlay';
import { IndicatorOverlay } from '@main/modules/overlay/indicatorOverlay';
import { SelectionOverlay } from '@main/modules/overlay/selectionOverlay';
import { PermissionService } from '@main/modules/permissions/permissionService';
import { LatestResponseStore } from '@main/modules/runtime/latestResponseStore';
import { KeyStore } from '@main/modules/security/keyStore';
import { SettingsStore } from '@main/modules/settings/settingsStore';
import { TypedTextService } from '@main/modules/text-input/typedTextService';
import {
  clampRectToBounds,
  NormalizedRect,
  normalizeRect,
  Point
} from '@main/utils/geometry';
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
let typedTextService: TypedTextService | null = null;

const selectionOverlay = new SelectionOverlay();
const indicatorOverlay = new IndicatorOverlay();
const cursorDebugOverlay = new CursorDebugOverlay();
const boxStartDebugOverlay = new CursorDebugOverlay({
  dotColor: 'rgba(46, 214, 255, 0.95)'
});
const cursorPositionService = new CursorPositionService();

let captureSession: {
  startPoint: Point;
  displayBounds: Electron.Rectangle;
  display: Electron.Display;
  showSelectionBox: boolean;
  showCursorDebugDot: boolean;
  lastDrawnRect: NormalizedRect | null;
  poll?: NodeJS.Timeout;
} | null = null;

let indicatorPoll: NodeJS.Timeout | null = null;
let cursorDebugPoll: NodeJS.Timeout | null = null;

const SNIPPET_ACTION_TO_ID: Record<SnippetHotkeyActionId, TextSnippetId> = {
  type_snippet_1: 'snippet_1',
  type_snippet_2: 'snippet_2',
  type_snippet_3: 'snippet_3'
};
const TYPED_TEXT_START_DELAY_MS = 45;

function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 760,
    height: 620,
    show: false,
    movable: true,
    title: 'Snapshot QA Settings',
    backgroundColor: '#0e1318',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
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
  nextTray.setToolTip('Snapshot QA');
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
    return;
  }

  if (actionId === 'type_latest_response') {
    void typeLatestResponse();
    return;
  }

  if (isSnippetAction(actionId)) {
    void typeSnippet(actionId);
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

  const startPoint = cursorPositionService.getTargetPoint('capture');
  const display = screen.getDisplayNearestPoint(startPoint);
  const { ultraDiscreteMode, showSelectionBox, showCursorDebugDot } = store.get().general;
  const effectiveShowSelectionBox = ultraDiscreteMode ? false : showSelectionBox;

  captureSession = {
    startPoint,
    display,
    displayBounds: display.bounds,
    showSelectionBox: effectiveShowSelectionBox,
    showCursorDebugDot,
    lastDrawnRect: null
  };

  if (!effectiveShowSelectionBox) {
    return;
  }

  void selectionOverlay.show();
  captureSession.poll = setInterval(() => {
    if (!captureSession) {
      return;
    }

    const current = cursorPositionService.getTargetPoint('capture');
    const normalized = normalizeRect(captureSession.startPoint, current);
    const clamped = clampRectToBounds(normalized, captureSession.displayBounds);
    captureSession.lastDrawnRect = clamped;
    selectionOverlay.updateRect(clamped);

    if (!captureSession.showCursorDebugDot || !clamped) {
      boxStartDebugOverlay.hide();
      return;
    }

    void boxStartDebugOverlay.showAt({
      x: clamped.x,
      y: clamped.y
    });
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

  const coordinator = getInferenceCoordinator();
  const store = getSettingsStore();
  if (!coordinator || !store || !captureService) {
    return;
  }
  const generalSettings = store.get().general;

  const endPoint = cursorPositionService.getTargetPoint('capture');
  const normalized = normalizeRect(session.startPoint, endPoint);
  const clampedAtRelease = clampRectToBounds(normalized, session.displayBounds);
  const clamped = clampedAtRelease ?? session.lastDrawnRect;

  if (session.showSelectionBox) {
    selectionOverlay.updateRect(clamped);
  }

  selectionOverlay.hide();
  boxStartDebugOverlay.hide();

  if (!clamped) {
    logger.warn('Capture ignored due to tiny region.');
    return;
  }

  try {
    const capture = await captureService.captureRegion(session.display, clamped, {
      imageCompressionEnabled: generalSettings.imageCompressionEnabled
    });
    await coordinator.runCaptureQuery(capture, generalSettings);
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
    const point = cursorPositionService.getTargetPoint('indicator');
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

function applyCursorDebugDotSetting(enabled: boolean): void {
  if (enabled) {
    startCursorDebugDotPreview();
    return;
  }

  stopCursorDebugDotPreview();
}

function startCursorDebugDotPreview(): void {
  if (cursorDebugPoll) {
    return;
  }

  const tick = () => {
    const point = cursorPositionService.getTargetPoint('capture');
    void cursorDebugOverlay.showAt(point);
  };

  tick();
  cursorDebugPoll = setInterval(tick, 16);
}

function stopCursorDebugDotPreview(): void {
  if (cursorDebugPoll) {
    clearInterval(cursorDebugPoll);
    cursorDebugPoll = null;
  }

  cursorDebugOverlay.hide();
  boxStartDebugOverlay.hide();
}

async function typeLatestResponse(): Promise<void> {
  if (!typedTextService) {
    return;
  }

  if (!permissionService?.getStatus().accessibilityTrusted) {
    logger.warn('Typing latest response blocked: accessibility permission not granted.');
    return;
  }

  const coordinator = getInferenceCoordinator();
  if (!coordinator) {
    return;
  }

  const latest = coordinator.getLatestState();
  if (latest.status !== 'complete') {
    logger.warn('Typing latest response skipped: no completed answer available.', {
      status: latest.status
    });
    return;
  }

  await waitForTypingStartDelay();
  await typedTextService.typeText(latest.text, 'latest_response');
}

async function typeSnippet(actionId: SnippetHotkeyActionId): Promise<void> {
  if (!typedTextService) {
    return;
  }

  if (!permissionService?.getStatus().accessibilityTrusted) {
    logger.warn('Typing snippet blocked: accessibility permission not granted.', {
      actionId
    });
    return;
  }

  const store = getSettingsStore();
  if (!store) {
    return;
  }

  const snippetId = SNIPPET_ACTION_TO_ID[actionId];
  const text = store.get().general[snippetId];

  if (!text.trim()) {
    logger.warn('Typing snippet skipped: snippet is empty.', {
      actionId,
      snippetId
    });
    return;
  }

  await waitForTypingStartDelay();
  await typedTextService.typeText(text, snippetId);
}

function isSnippetAction(actionId: HotkeyActionId): actionId is SnippetHotkeyActionId {
  return actionId in SNIPPET_ACTION_TO_ID;
}

async function waitForTypingStartDelay(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, TYPED_TEXT_START_DELAY_MS));
}

async function renderIndicatorAt(point: Point, latest: LatestResponse): Promise<void> {
  if (latest.status === 'idle') {
    indicatorOverlay.hide();
    return;
  }

  const coordinator = getInferenceCoordinator();
  const store = getSettingsStore();
  if (!coordinator || !store) {
    return;
  }
  const { ultraDiscreteMode, showResponseChrome } = store.get().general;
  const effectiveShowResponseChrome = ultraDiscreteMode ? false : showResponseChrome;

  if (latest.status === 'pending') {
    await indicatorOverlay.showAt(point, {
      state: 'pending',
      ultraDiscreteMode,
      showResponseChrome: effectiveShowResponseChrome
    });
    return;
  }

  if (latest.status === 'complete') {
    coordinator.copyLatestForDisplay((text) => clipboard.writeText(text));
    await indicatorOverlay.showAt(point, {
      state: 'complete',
      text: latest.text,
      ultraDiscreteMode,
      showResponseChrome: effectiveShowResponseChrome
    });
    return;
  }

  if (latest.status === 'error') {
    coordinator.copyLatestForDisplay((text) => clipboard.writeText(text));
    await indicatorOverlay.showAt(point, {
      state: 'error',
      text: latest.text,
      ultraDiscreteMode,
      showResponseChrome: effectiveShowResponseChrome
    });
  }
}

function applyLaunchAtLoginSetting(enabled: boolean): void {
  if (!app.isPackaged) {
    return;
  }

  try {
    app.setLoginItemSettings({
      openAtLogin: enabled
    });
  } catch (error) {
    logger.warn('Failed to update launch-at-login setting.', {
      reason: error instanceof Error ? error.message : 'unknown'
    });
  }
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  keyStore = new KeyStore();
  settingsStore = new SettingsStore();
  permissionService = new PermissionService();
  captureService = new CaptureService();
  typedTextService = new TypedTextService();

  const latestResponseStore = new LatestResponseStore();
  inferenceCoordinator = new InferenceCoordinator(
    new OpenRouterClient(),
    latestResponseStore,
    () => keyStore!.getOpenRouterKey()
  );

  hotkeyManager = new HotkeyManager(
    new KeyspyHotkeyService(),
    settingsStore.get().hotkeys,
    handleHotkeyStart,
    handleHotkeyEnd
  );

  settingsWindow = createSettingsWindow();
  tray = createTray();

  applyLaunchAtLoginSetting(settingsStore.get().general.launchAtLogin);
  applyCursorDebugDotSetting(settingsStore.get().general.showCursorDebugDot);
  hotkeyManager.start();

  registerIpcHandlers({
    settingsStore,
    keyStore,
    hotkeyManager,
    inferenceCoordinator,
    permissionService,
    onSettingsUpdated: (updatedSettings) => {
      applyCursorDebugDotSetting(updatedSettings.general.showCursorDebugDot);
      if (captureSession) {
        captureSession.showCursorDebugDot = updatedSettings.general.showCursorDebugDot;
      }
    }
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
  stopCursorDebugDotPreview();
  selectionOverlay.destroy();
  indicatorOverlay.destroy();
  cursorDebugOverlay.destroy();
  boxStartDebugOverlay.destroy();
  tray?.destroy();
  tray = null;
});
