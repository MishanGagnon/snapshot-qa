import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import {
  GlobalKeyboardListener,
  IConfig,
  IGlobalKey,
  IGlobalKeyDownMap,
  IGlobalKeyEvent,
  IGlobalKeyListener
} from 'keyspy';
import { HOTKEY_ACTION_DEFINITIONS, HotkeyActionId, HotkeyBinding, HotkeyMap, HotkeyModifier } from '@shared/contracts';
import { logger } from '@main/utils/logger';
import { HotkeyService } from './hotkeyService';

const modifierKeyNames: Record<HotkeyModifier, IGlobalKey[]> = {
  shift: ['LEFT SHIFT', 'RIGHT SHIFT'],
  ctrl: ['LEFT CTRL', 'RIGHT CTRL'],
  alt: ['LEFT ALT', 'RIGHT ALT'],
  cmd: ['LEFT META', 'RIGHT META'],
  fn: ['FN']
};
const FN_CHORD_GRACE_MS = 160;

export class KeyspyHotkeyService implements HotkeyService {
  private readonly keyListener = new GlobalKeyboardListener(buildKeyspyConfig());
  private readonly onKeyEvent: IGlobalKeyListener = (event, downMap) => {
    this.sawAnyEvent = true;

    if (!this.loggedEventStreamActive) {
      this.loggedEventStreamActive = true;
      logger.info('Keyspy event stream is active.', {
        firstEventName: event.name ?? 'UNKNOWN',
        firstVKey: event.vKey,
        firstScanCode: event.scanCode
      });
    }

    const fnDown = Boolean(downMap.FN);
    if (fnDown !== this.fnDown) {
      logger.info('Fn modifier state changed.', {
        from: this.fnDown,
        to: fnDown,
        triggerName: event.name ?? 'UNKNOWN',
        triggerRawName: event.rawKey?._nameRaw ?? 'n/a',
        triggerVKey: event.vKey,
        triggerScanCode: event.scanCode
      });
      this.fnDown = fnDown;
    }

    if (isFnLikeEvent(event)) {
      logger.info('Fn key event detected.', {
        state: event.state,
        name: event.name ?? 'UNKNOWN',
        rawName: event.rawKey?._nameRaw ?? 'n/a',
        rawMappedName: event.rawKey?.name ?? 'n/a',
        vKey: event.vKey,
        scanCode: event.scanCode,
        fnDown: Boolean(downMap.FN)
      });
    }

    if (isFunctionKeycodeEvent(event) && !isFnLikeEvent(event)) {
      logger.info('Fn keycode event detected (vKey/scanCode 63).', {
        state: event.state,
        name: event.name ?? 'UNKNOWN',
        rawName: event.rawKey?._nameRaw ?? 'n/a',
        rawMappedName: event.rawKey?.name ?? 'n/a',
        vKey: event.vKey,
        scanCode: event.scanCode,
        fnDown
      });
    }

    this.downMap = downMap;
    this.evaluateTransitions();
    return false;
  };
  private bindings: HotkeyMap | null = null;
  private onStart: ((actionId: HotkeyActionId) => void) | null = null;
  private onEnd: ((actionId: HotkeyActionId) => void) | null = null;
  private downMap: IGlobalKeyDownMap = {};
  private activeStates: Record<HotkeyActionId, boolean> = createInactiveStates();
  private pendingStarts = new Map<HotkeyActionId, NodeJS.Timeout>();
  private running = false;
  private fnDown = false;
  private sawAnyEvent = false;
  private loggedEventStreamActive = false;
  private startupProbeTimeout: NodeJS.Timeout | null = null;

  start(bindings: HotkeyMap, onStart: (actionId: HotkeyActionId) => void, onEnd: (actionId: HotkeyActionId) => void): void {
    this.bindings = bindings;
    this.onStart = onStart;
    this.onEnd = onEnd;
    this.downMap = {};
    this.clearPendingStarts();
    this.activeStates = createInactiveStates();
    this.running = true;
    this.fnDown = false;
    this.sawAnyEvent = false;
    this.loggedEventStreamActive = false;

    if (this.startupProbeTimeout) {
      clearTimeout(this.startupProbeTimeout);
    }

    this.startupProbeTimeout = setTimeout(() => {
      if (this.running && !this.sawAnyEvent) {
        logger.warn('Keyspy listener started but no key events have been seen yet.', {
          hint: 'Input Monitoring/Accessibility permissions may be missing or blocked.'
        });
      }
      this.startupProbeTimeout = null;
    }, 5000);

    void this.keyListener
      .addListener(this.onKeyEvent)
      .then(() => {
        logger.info('Keyspy listener registered.');
      })
      .catch((error) => {
        this.keyListener.removeListener(this.onKeyEvent);
        this.running = false;
        if (this.startupProbeTimeout) {
          clearTimeout(this.startupProbeTimeout);
          this.startupProbeTimeout = null;
        }
        logger.error('Failed to initialize keyspy listener.', {
          reason: error instanceof Error ? error.message : 'unknown'
        });
      });
  }

  updateBindings(bindings: HotkeyMap): void {
    this.bindings = bindings;
    this.clearPendingStarts();
    this.activeStates = createInactiveStates();
    this.evaluateTransitions();
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.keyListener.removeListener(this.onKeyEvent);
    this.running = false;
    this.clearPendingStarts();
    this.downMap = {};
    this.fnDown = false;
    this.sawAnyEvent = false;
    this.loggedEventStreamActive = false;
    if (this.startupProbeTimeout) {
      clearTimeout(this.startupProbeTimeout);
      this.startupProbeTimeout = null;
    }
    this.activeStates = createInactiveStates();
  }

  private evaluateTransitions(): void {
    if (!this.bindings) {
      return;
    }

    (Object.keys(this.bindings) as HotkeyActionId[]).forEach((actionId) => {
      const binding = this.bindings![actionId];
      const isActiveNow = this.isBindingActive(binding);
      const wasActive = this.activeStates[actionId];
      const hasPendingStart = this.pendingStarts.has(actionId);

      if (!isActiveNow && hasPendingStart) {
        this.cancelPendingStart(actionId);
      }

      if (isActiveNow && !wasActive && !hasPendingStart) {
        if (shouldDebounceStart(binding)) {
          const timeout = setTimeout(() => {
            this.pendingStarts.delete(actionId);

            if (!this.running || !this.bindings) {
              return;
            }

            const latestBinding = this.bindings[actionId];
            if (!this.isBindingActive(latestBinding) || this.activeStates[actionId]) {
              return;
            }

            this.activeStates[actionId] = true;
            this.onStart?.(actionId);
          }, FN_CHORD_GRACE_MS);

          this.pendingStarts.set(actionId, timeout);
          return;
        }

        this.activeStates[actionId] = true;
        this.onStart?.(actionId);
      }

      if (!isActiveNow && wasActive) {
        this.activeStates[actionId] = false;
        this.onEnd?.(actionId);
      }
    });
  }

  private isBindingActive(binding: HotkeyBinding): boolean {
    const primaryKeyName = getKeyspyName(binding.key);
    if (!this.downMap[primaryKeyName]) {
      return false;
    }

    if (
      !binding.modifiers.every((modifier) =>
        modifierKeyNames[modifier].some((keyName) => Boolean(this.downMap[keyName]))
      )
    ) {
      return false;
    }

    if (isFnStandaloneBinding(binding) && hasNonFnModifierDown(this.downMap)) {
      return false;
    }

    return true;
  }

  private cancelPendingStart(actionId: HotkeyActionId): void {
    const timeout = this.pendingStarts.get(actionId);
    if (!timeout) {
      return;
    }
    clearTimeout(timeout);
    this.pendingStarts.delete(actionId);
  }

  private clearPendingStarts(): void {
    this.pendingStarts.forEach((timeout) => clearTimeout(timeout));
    this.pendingStarts.clear();
  }
}

function getKeyspyName(key: HotkeyBinding['key']): IGlobalKey {
  if (key === 'CAPSLOCK') {
    return 'CAPS LOCK';
  }

  return key as IGlobalKey;
}

function createInactiveStates(): Record<HotkeyActionId, boolean> {
  return HOTKEY_ACTION_DEFINITIONS.reduce(
    (acc, action) => {
      acc[action.id] = false;
      return acc;
    },
    {} as Record<HotkeyActionId, boolean>
  );
}

function isFnLikeEvent(event: IGlobalKeyEvent): boolean {
  if (event.name === 'FN') {
    return true;
  }

  const raw = `${event.rawKey?._nameRaw ?? ''} ${event.rawKey?.name ?? ''}`.toUpperCase();
  return raw.includes('FN') || raw.includes('FUNCTION');
}

function isFunctionKeycodeEvent(event: IGlobalKeyEvent): boolean {
  return event.vKey === 63 || event.scanCode === 63;
}

function shouldDebounceStart(binding: HotkeyBinding): boolean {
  return isFnStandaloneBinding(binding);
}

function isFnStandaloneBinding(binding: HotkeyBinding): boolean {
  return binding.key === 'FN' && binding.modifiers.length === 0;
}

function hasNonFnModifierDown(downMap: IGlobalKeyDownMap): boolean {
  return (
    Boolean(downMap['LEFT SHIFT']) ||
    Boolean(downMap['RIGHT SHIFT']) ||
    Boolean(downMap['LEFT CTRL']) ||
    Boolean(downMap['RIGHT CTRL']) ||
    Boolean(downMap['LEFT ALT']) ||
    Boolean(downMap['RIGHT ALT']) ||
    Boolean(downMap['LEFT META']) ||
    Boolean(downMap['RIGHT META'])
  );
}

function buildKeyspyConfig(): IConfig {
  const config: IConfig = {
    appName: 'Discreet QA'
  };

  try {
    const require = createRequire(import.meta.url);
    const keyspyRoot = dirname(require.resolve('keyspy/package.json'));
    const macServerPath = join(keyspyRoot, 'runtime', 'MacKeyServer');
    const windowsServerPath = join(keyspyRoot, 'runtime', 'WinKeyServer.exe');
    const x11ServerPath = join(keyspyRoot, 'runtime', 'X11KeyServer');

    config.mac = {
      serverPath: macServerPath,
      appName: 'Discreet QA'
    };
    config.windows = {
      serverPath: windowsServerPath
    };
    config.x11 = {
      serverPath: x11ServerPath,
      appName: 'Discreet QA'
    };

    if (process.platform === 'darwin' && !existsSync(macServerPath)) {
      logger.warn('Keyspy macOS runtime binary not found.', {
        expectedPath: macServerPath
      });
    }
  } catch (error) {
    logger.warn('Failed to resolve keyspy runtime paths from node_modules.', {
      reason: error instanceof Error ? error.message : 'unknown'
    });
  }

  return config;
}
