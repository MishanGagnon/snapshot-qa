import {
  HotkeyActionId,
  HotkeyMap,
  HotkeyValidationResult,
  SUPPORTED_HOTKEY_KEYS
} from '@shared/contracts';
import { bindingToCanonical } from './keycodes';

const reservedCombos = new Set<string>([
  'cmd+q',
  'cmd+w',
  'cmd+tab',
  'cmd+space',
  'cmd+shift+3',
  'cmd+shift+4'
]);

export function validateHotkeyMap(hotkeys: HotkeyMap): HotkeyValidationResult {
  const errors: Partial<Record<HotkeyActionId, string>> = {};
  const globalErrors: string[] = [];
  const seen = new Map<string, HotkeyActionId>();

  (Object.keys(hotkeys) as HotkeyActionId[]).forEach((actionId) => {
    const binding = hotkeys[actionId];

    if (binding.actionId !== actionId) {
      errors[actionId] = 'Action mismatch in hotkey payload.';
      return;
    }

    if (binding.modifiers.length === 0) {
      errors[actionId] = 'At least one modifier is required.';
      return;
    }

    if (!SUPPORTED_HOTKEY_KEYS.includes(binding.key)) {
      errors[actionId] = 'Unsupported key selected.';
      return;
    }

    const canonical = bindingToCanonical(binding);

    if (reservedCombos.has(canonical)) {
      errors[actionId] = 'This shortcut is reserved by the OS or app safety policy.';
      return;
    }

    if (seen.has(canonical)) {
      errors[actionId] = `Conflicts with ${seen.get(canonical)}.`;
      return;
    }

    seen.set(canonical, actionId);
  });

  if (Object.keys(errors).length > 0) {
    globalErrors.push('Resolve hotkey conflicts and validation errors before saving.');
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    globalErrors
  };
}
