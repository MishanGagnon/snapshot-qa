import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_HOTKEY_MAP, HotkeyMap } from '@shared/contracts';
import { HotkeyManager } from './hotkeyManager';
import { HotkeyService } from './hotkeyService';

class FakeHotkeyService implements HotkeyService {
  public bindings: HotkeyMap = DEFAULT_HOTKEY_MAP;
  public failOnUpdate = false;

  start(): void {}
  stop(): void {}

  updateBindings(bindings: HotkeyMap): void {
    if (this.failOnUpdate) {
      throw new Error('failed-update');
    }
    this.bindings = bindings;
  }
}

describe('HotkeyManager', () => {
  it('applies valid bindings', () => {
    const service = new FakeHotkeyService();
    const manager = new HotkeyManager(service, DEFAULT_HOTKEY_MAP, vi.fn(), vi.fn());

    const next = {
      ...DEFAULT_HOTKEY_MAP,
      capture_region: {
        ...DEFAULT_HOTKEY_MAP.capture_region,
        key: 'R' as const
      }
    };

    const result = manager.applyBindings(next);

    expect(result.ok).toBe(true);
    expect(manager.getBindings().capture_region.key).toBe('R');
  });

  it('reverts when service update fails', () => {
    const service = new FakeHotkeyService();
    const manager = new HotkeyManager(service, DEFAULT_HOTKEY_MAP, vi.fn(), vi.fn());

    service.failOnUpdate = true;
    const next = {
      ...DEFAULT_HOTKEY_MAP,
      capture_region: {
        ...DEFAULT_HOTKEY_MAP.capture_region,
        key: 'R' as const
      }
    };

    const result = manager.applyBindings(next);

    expect(result.ok).toBe(false);
    expect(manager.getBindings().capture_region.key).toBe(DEFAULT_HOTKEY_MAP.capture_region.key);
  });
});
