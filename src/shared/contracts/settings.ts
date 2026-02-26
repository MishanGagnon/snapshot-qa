import { HOTKEY_ACTION_DEFINITIONS, HotkeyMap } from './hotkeys';

export type TextSnippetId = 'snippet_1' | 'snippet_2' | 'snippet_3';

export interface TextSnippetDefinition {
  id: TextSnippetId;
  label: string;
  placeholder: string;
}

export interface GeneralSettings {
  corpus: string;
  customInfo: string;
  snippet_1: string;
  snippet_2: string;
  snippet_3: string;
  defaultModel: string;
  showSelectionBox: boolean;
  showCursorDebugDot: boolean;
  showResponseChrome: boolean;
  ultraDiscreteMode: boolean;
  launchAtLogin: boolean;
  imageCompressionEnabled: boolean;
  contextCachingEnabled: boolean;
}

export interface AppSettings {
  general: GeneralSettings;
  hotkeys: HotkeyMap;
}

export const TEXT_SNIPPET_DEFINITIONS: TextSnippetDefinition[] = [
  {
    id: 'snippet_1',
    label: 'Snippet 1',
    placeholder: 'Add text typed by Snippet 1 hotkey.'
  },
  {
    id: 'snippet_2',
    label: 'Snippet 2',
    placeholder: 'Add text typed by Snippet 2 hotkey.'
  },
  {
    id: 'snippet_3',
    label: 'Snippet 3',
    placeholder: 'Add text typed by Snippet 3 hotkey.'
  }
];

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  corpus: '',
  customInfo: '',
  snippet_1: '',
  snippet_2: '',
  snippet_3: '',
  defaultModel: 'google/gemini-3-flash-preview',
  showSelectionBox: true,
  showCursorDebugDot: false,
  showResponseChrome: true,
  ultraDiscreteMode: false,
  launchAtLogin: false,
  imageCompressionEnabled: true,
  contextCachingEnabled: true
};

export const DEFAULT_HOTKEY_MAP: HotkeyMap = HOTKEY_ACTION_DEFINITIONS.reduce(
  (acc, action) => {
    acc[action.id] = action.defaultBinding;
    return acc;
  },
  {} as HotkeyMap
);

export const DEFAULT_APP_SETTINGS: AppSettings = {
  general: DEFAULT_GENERAL_SETTINGS,
  hotkeys: DEFAULT_HOTKEY_MAP
};
