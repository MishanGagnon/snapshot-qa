export type HotkeyActionId = 'capture_region' | 'show_latest_response';

export type HotkeyModifier = 'cmd' | 'shift' | 'ctrl' | 'alt';

export type HotkeyKey =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z'
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9';

export interface HotkeyBinding {
  actionId: HotkeyActionId;
  key: HotkeyKey;
  modifiers: HotkeyModifier[];
}

export type HotkeyMap = Record<HotkeyActionId, HotkeyBinding>;

export interface HotkeyActionDefinition {
  id: HotkeyActionId;
  label: string;
  description: string;
  defaultBinding: HotkeyBinding;
  handlerId: HotkeyActionId;
}

export interface HotkeyValidationResult {
  valid: boolean;
  errors: Partial<Record<HotkeyActionId, string>>;
  globalErrors: string[];
}

export const SUPPORTED_HOTKEY_KEYS: readonly HotkeyKey[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9'
] as const;

export const HOTKEY_ACTION_DEFINITIONS: HotkeyActionDefinition[] = [
  {
    id: 'capture_region',
    label: 'Capture Region',
    description: 'Hold shortcut to define screenshot region from key-down to key-up.',
    defaultBinding: {
      actionId: 'capture_region',
      key: 'W',
      modifiers: ['cmd', 'shift']
    },
    handlerId: 'capture_region'
  },
  {
    id: 'show_latest_response',
    label: 'Show Latest Response',
    description: 'Hold shortcut to show pending/result indicator near cursor.',
    defaultBinding: {
      actionId: 'show_latest_response',
      key: 'E',
      modifiers: ['cmd', 'shift']
    },
    handlerId: 'show_latest_response'
  }
];
