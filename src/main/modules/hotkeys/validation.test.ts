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

  it('accepts bindings with no modifiers', () => {
    const candidate = {
      ...DEFAULT_HOTKEY_MAP,
      capture_region: {
        ...DEFAULT_HOTKEY_MAP.capture_region,
        modifiers: []
      }
    };

    const result = validateHotkeyMap(candidate);
    expect(result.valid).toBe(true);
  });

  it('accepts CapsLock as a hotkey key', () => {
    const candidate = {
      ...DEFAULT_HOTKEY_MAP,
      capture_region: {
        ...DEFAULT_HOTKEY_MAP.capture_region,
        key: 'CAPSLOCK' as const,
        modifiers: []
      }
    };

    const result = validateHotkeyMap(candidate);
    expect(result.valid).toBe(true);
  });

  it('accepts Fn as a modifier', () => {
    const candidate = {
      ...DEFAULT_HOTKEY_MAP,
      capture_region: {
        ...DEFAULT_HOTKEY_MAP.capture_region,
        modifiers: ['fn'] as const
      }
    };

    const result = validateHotkeyMap(candidate);
    expect(result.valid).toBe(true);
  });

  it('accepts Fn as a standalone primary key', () => {
    const candidate = {
      ...DEFAULT_HOTKEY_MAP,
      capture_region: {
        ...DEFAULT_HOTKEY_MAP.capture_region,
        key: 'FN' as const,
        modifiers: []
      }
    };

    const result = validateHotkeyMap(candidate);
    expect(result.valid).toBe(true);
  });

  it('accepts Fn + Opt as a hotkey combo', () => {
    const candidate = {
      ...DEFAULT_HOTKEY_MAP,
      show_latest_response: {
        ...DEFAULT_HOTKEY_MAP.show_latest_response,
        actionId: 'show_latest_response' as const,
        key: 'E' as const,
        modifiers: ['cmd', 'shift'] as const
      },
      type_latest_response: {
        ...DEFAULT_HOTKEY_MAP.type_latest_response,
        actionId: 'type_latest_response' as const,
        key: 'FN' as const,
        modifiers: ['alt'] as const
      }
    };

    const result = validateHotkeyMap(candidate);
    expect(result.valid).toBe(true);
  });
});
