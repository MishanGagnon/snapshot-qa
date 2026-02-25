import { HotkeyActionId, HotkeyMap } from '@shared/contracts';

export interface HotkeyService {
  start(bindings: HotkeyMap, onStart: (actionId: HotkeyActionId) => void, onEnd: (actionId: HotkeyActionId) => void): void;
  updateBindings(bindings: HotkeyMap): void;
  stop(): void;
}
