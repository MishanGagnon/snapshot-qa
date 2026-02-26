import { uIOhook } from 'uiohook-napi';
import { HOTKEY_ACTION_DEFINITIONS, HotkeyActionId, HotkeyMap } from '@shared/contracts';
import { getModifierCodes, getPrimaryKeyCode } from './keycodes';
import { HotkeyService } from './hotkeyService';

export class UiohookHotkeyService implements HotkeyService {
  private bindings: HotkeyMap | null = null;
  private onStart: ((actionId: HotkeyActionId) => void) | null = null;
  private onEnd: ((actionId: HotkeyActionId) => void) | null = null;
  private pressed = new Set<number>();
  private activeStates: Record<HotkeyActionId, boolean> = createInactiveStates();
  private running = false;

  start(bindings: HotkeyMap, onStart: (actionId: HotkeyActionId) => void, onEnd: (actionId: HotkeyActionId) => void): void {
    this.bindings = bindings;
    this.onStart = onStart;
    this.onEnd = onEnd;

    uIOhook.on('keydown', this.handleKeyDown);
    uIOhook.on('keyup', this.handleKeyUp);
    uIOhook.start();
    this.running = true;
  }

  updateBindings(bindings: HotkeyMap): void {
    this.bindings = bindings;
    this.activeStates = createInactiveStates();
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    uIOhook.off('keydown', this.handleKeyDown);
    uIOhook.off('keyup', this.handleKeyUp);
    uIOhook.stop();
    this.running = false;
    this.pressed.clear();
    this.activeStates = createInactiveStates();
  }

  private readonly handleKeyDown = (event: { keycode: number }) => {
    this.pressed.add(event.keycode);
    this.evaluateTransitions();
  };

  private readonly handleKeyUp = (event: { keycode: number }) => {
    this.pressed.delete(event.keycode);
    this.evaluateTransitions();
  };

  private evaluateTransitions(): void {
    if (!this.bindings) {
      return;
    }

    (Object.keys(this.bindings) as HotkeyActionId[]).forEach((actionId) => {
      const isActiveNow = this.isBindingActive(this.bindings![actionId]);
      const wasActive = this.activeStates[actionId];

      if (isActiveNow && !wasActive) {
        this.activeStates[actionId] = true;
        this.onStart?.(actionId);
      }

      if (!isActiveNow && wasActive) {
        this.activeStates[actionId] = false;
        this.onEnd?.(actionId);
      }
    });
  }

  private isBindingActive(binding: HotkeyMap[HotkeyActionId]): boolean {
    const keyCode = getPrimaryKeyCode(binding.key);
    if (!keyCode || !this.pressed.has(keyCode)) {
      return false;
    }

    return binding.modifiers.every((modifier) => {
      const codes = getModifierCodes(modifier);
      return codes.some((code) => this.pressed.has(code));
    });
  }
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
