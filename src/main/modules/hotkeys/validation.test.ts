import { describe, expect, it } from 'vitest';
import { DEFAULT_HOTKEY_MAP } from '@shared/contracts';
import { validateHotkeyMap } from './validation';

describe('validateHotkeyMap', () => {
  it('accepts default bindings', () => {
    const result = validateHotkeyMap(DEFAULT_HOTKEY_MAP);
    expect(result.valid).toBe(true);
  });

  it('rejects duplicate combos', () => {
    const candidate = {
      ...DEFAULT_HOTKEY_MAP,
      show_latest_response: {
        ...DEFAULT_HOTKEY_MAP.capture_region,
        actionId: 'show_latest_response' as const
      }
    };

    const result = validateHotkeyMap(candidate);
    expect(result.valid).toBe(false);
    expect(result.errors.show_latest_response).toContain('Conflicts');
  });

  it('rejects bindings with no modifiers', () => {
    const candidate = {
      ...DEFAULT_HOTKEY_MAP,
      capture_region: {
        ...DEFAULT_HOTKEY_MAP.capture_region,
        modifiers: []
      }
    };

    const result = validateHotkeyMap(candidate);
    expect(result.valid).toBe(false);
    expect(result.errors.capture_region).toContain('modifier');
  });
});
