import { HotkeyMap, HotkeyValidationResult } from './hotkeys';
import { PermissionStatus } from './runtime';
import { AppSettings, GeneralSettings } from './settings';

export interface HotkeyUpdateResponse {
  ok: boolean;
  validation: HotkeyValidationResult;
}

export interface KeyStatusResponse {
  hasOpenRouterKey: boolean;
}

export interface DesktopApi {
  settings: {
    get: () => Promise<AppSettings>;
    update: (general: Partial<GeneralSettings>) => Promise<AppSettings>;
  };
  hotkeys: {
    get: () => Promise<HotkeyMap>;
    validate: (map: HotkeyMap) => Promise<HotkeyValidationResult>;
    update: (map: HotkeyMap) => Promise<HotkeyUpdateResponse>;
  };
  keys: {
    getStatus: () => Promise<KeyStatusResponse>;
    setOpenRouter: (value: string) => Promise<KeyStatusResponse>;
  };
  runtime: {
    getLatestInferenceState: () => Promise<import('./runtime').LatestResponse>;
  };
  permissions: {
    getStatus: () => Promise<PermissionStatus>;
  };
}

