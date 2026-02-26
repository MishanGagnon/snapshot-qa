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

export type AppUpdateState =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not_available'
  | 'error';

export interface AppUpdateStatus {
  state: AppUpdateState;
  available: boolean;
  version?: string;
  error?: string;
}

export interface UpdateActionResponse {
  ok: boolean;
  message: string;
  status: AppUpdateStatus;
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
  updates: {
    getStatus: () => Promise<AppUpdateStatus>;
    checkNow: () => Promise<AppUpdateStatus>;
    installNow: () => Promise<UpdateActionResponse>;
  };
}
