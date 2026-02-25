export const IPC_CHANNELS = {
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  hotkeysGet: 'hotkeys:get',
  hotkeysValidate: 'hotkeys:validate',
  hotkeysUpdate: 'hotkeys:update',
  keySetOpenRouter: 'keys:setOpenRouter',
  keyGetStatus: 'keys:getStatus',
  runtimeGetLatestInferenceState: 'runtime:getLatestInferenceState',
  permissionsGetStatus: 'permissions:getStatus'
} as const;
