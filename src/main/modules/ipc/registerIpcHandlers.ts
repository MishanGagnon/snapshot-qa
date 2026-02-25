import { app, ipcMain } from 'electron';
import {
  HotkeyMap,
  HotkeyUpdateResponse,
  HotkeyValidationResult,
  IPC_CHANNELS,
  KeyStatusResponse
} from '@shared/contracts';
import { HotkeyManager } from '@main/modules/hotkeys/hotkeyManager';
import { validateHotkeyMap } from '@main/modules/hotkeys/validation';
import { PermissionService } from '@main/modules/permissions/permissionService';
import { InferenceCoordinator } from '@main/modules/inference/inferenceCoordinator';
import { KeyStore } from '@main/modules/security/keyStore';
import { SettingsStore } from '@main/modules/settings/settingsStore';

interface IpcDependencies {
  settingsStore: SettingsStore;
  keyStore: KeyStore;
  hotkeyManager: HotkeyManager;
  inferenceCoordinator: InferenceCoordinator;
  permissionService: PermissionService;
}

export function registerIpcHandlers(deps: IpcDependencies): void {
  ipcMain.handle(IPC_CHANNELS.settingsGet, async () => deps.settingsStore.get());

  ipcMain.handle(IPC_CHANNELS.settingsUpdate, async (_event, generalPatch: Record<string, unknown>) => {
    const updated = deps.settingsStore.updateGeneral(generalPatch as never);
    app.setLoginItemSettings({
      openAtLogin: updated.general.launchAtLogin
    });
    return updated;
  });

  ipcMain.handle(IPC_CHANNELS.hotkeysGet, async () => deps.hotkeyManager.getBindings());

  ipcMain.handle(IPC_CHANNELS.hotkeysValidate, async (_event, map: HotkeyMap): Promise<HotkeyValidationResult> =>
    validateHotkeyMap(map)
  );

  ipcMain.handle(IPC_CHANNELS.hotkeysUpdate, async (_event, map: HotkeyMap): Promise<HotkeyUpdateResponse> => {
    const result = deps.hotkeyManager.applyBindings(map);

    if (!result.ok) {
      return {
        ok: false,
        validation: result.errors
      };
    }

    deps.settingsStore.updateHotkeys(map);

    return {
      ok: true,
      validation: {
        valid: true,
        errors: {},
        globalErrors: []
      }
    };
  });

  ipcMain.handle(IPC_CHANNELS.keyGetStatus, async (): Promise<KeyStatusResponse> => ({
    hasOpenRouterKey: await deps.keyStore.hasOpenRouterKey()
  }));

  ipcMain.handle(IPC_CHANNELS.keySetOpenRouter, async (_event, value: string): Promise<KeyStatusResponse> => {
    await deps.keyStore.setOpenRouterKey(value);
    return {
      hasOpenRouterKey: await deps.keyStore.hasOpenRouterKey()
    };
  });

  ipcMain.handle(IPC_CHANNELS.runtimeGetLatestInferenceState, async () => deps.inferenceCoordinator.getLatestState());

  ipcMain.handle(IPC_CHANNELS.permissionsGetStatus, async () => deps.permissionService.getStatus());
}
