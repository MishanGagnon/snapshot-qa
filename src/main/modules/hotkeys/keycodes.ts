import { HotkeyBinding, HotkeyModifier } from '@shared/contracts';

const letterKeycodes: Record<string, number> = {
  A: 30,
  B: 48,
  C: 46,
  D: 32,
  E: 18,
  F: 33,
  G: 34,
  H: 35,
  I: 23,
  J: 36,
  K: 37,
  L: 38,
  M: 50,
  N: 49,
  O: 24,
  P: 25,
  Q: 16,
  R: 19,
  S: 31,
  T: 20,
  U: 22,
  V: 47,
  W: 17,
  X: 45,
  Y: 21,
  Z: 44
};

const numberKeycodes: Record<string, number> = {
  '0': 11,
  '1': 2,
  '2': 3,
  '3': 4,
  '4': 5,
  '5': 6,
  '6': 7,
  '7': 8,
  '8': 9,
  '9': 10
};

export const keyToCode: Record<string, number> = {
  FN: 63,
  ...letterKeycodes,
  ...numberKeycodes,
  CAPSLOCK: 58
};

const modifierCodes: Record<HotkeyModifier, number[]> = {
  shift: [42, 54],
  ctrl: [29, 3613],
  alt: [56, 3640],
  cmd: [3675, 3676],
  fn: []
};

export function bindingToCanonical(binding: HotkeyBinding): string {
  const orderedModifiers: HotkeyModifier[] = ['fn', 'cmd', 'shift', 'ctrl', 'alt'];
  const modifierPart = orderedModifiers.filter((modifier) => binding.modifiers.includes(modifier));
  return [...modifierPart, binding.key.toLowerCase()].join('+');
}

export function getModifierCodes(modifier: HotkeyModifier): number[] {
  return modifierCodes[modifier];
}

export function getPrimaryKeyCode(key: string): number | undefined {
  return keyToCode[key.toUpperCase()];
}
