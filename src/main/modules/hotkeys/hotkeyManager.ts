import { HotkeyActionId, HotkeyMap } from '@shared/contracts';
import { validateHotkeyMap } from './validation';
import { HotkeyService } from './hotkeyService';

export class HotkeyManager {
  private bindings: HotkeyMap;

  constructor(
    private readonly service: HotkeyService,
    initialBindings: HotkeyMap,
    private readonly onStart: (actionId: HotkeyActionId) => void,
    private readonly onEnd: (actionId: HotkeyActionId) => void
  ) {
    this.bindings = initialBindings;
  }

  start(): void {
    this.service.start(this.bindings, this.onStart, this.onEnd);
  }

  stop(): void {
    this.service.stop();
  }

  getBindings(): HotkeyMap {
    return structuredClone(this.bindings);
  }

  applyBindings(nextBindings: HotkeyMap): { ok: true } | { ok: false; errors: ReturnType<typeof validateHotkeyMap> } {
    const validation = validateHotkeyMap(nextBindings);
    if (!validation.valid) {
      return { ok: false, errors: validation };
    }

    const previous = structuredClone(this.bindings);
    try {
      this.service.updateBindings(nextBindings);
      this.bindings = structuredClone(nextBindings);
      return { ok: true };
    } catch (error) {
      try {
        this.service.updateBindings(previous);
      } catch {
        // Ignore rollback failures; current state remains previous in-memory snapshot.
      }
      this.bindings = previous;
      return {
        ok: false,
        errors: {
          valid: false,
          errors: {},
          globalErrors: [error instanceof Error ? error.message : 'Failed to apply new hotkeys.']
        }
      };
    }
  }
}
