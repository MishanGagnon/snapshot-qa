import { HOTKEY_ACTION_DEFINITIONS, HotkeyMap } from './hotkeys';

export interface GeneralSettings {
  corpus: string;
  customInfo: string;
  defaultModel: string;
  showSelectionBox: boolean;
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

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  corpus: '',
  customInfo: '',
  defaultModel: 'google/gemini-3-flash-preview',
  showSelectionBox: true,
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
