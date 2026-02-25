import { contextBridge, ipcRenderer } from 'electron';
import { DesktopApi, IPC_CHANNELS } from '@shared/contracts';

const api: DesktopApi = {
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
    update: (general) => ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, general)
  },
  hotkeys: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.hotkeysGet),
    validate: (map) => ipcRenderer.invoke(IPC_CHANNELS.hotkeysValidate, map),
    update: (map) => ipcRenderer.invoke(IPC_CHANNELS.hotkeysUpdate, map)
  },
  keys: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.keyGetStatus),
    setOpenRouter: (value) => ipcRenderer.invoke(IPC_CHANNELS.keySetOpenRouter, value)
  },
  runtime: {
    getLatestInferenceState: () => ipcRenderer.invoke(IPC_CHANNELS.runtimeGetLatestInferenceState)
  },
  permissions: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.permissionsGetStatus)
  }
};

contextBridge.exposeInMainWorld('desktopApi', api);
