import { DesktopApi } from '@shared/contracts';

export function getDesktopApi(): DesktopApi {
  if (!window.desktopApi) {
    throw new Error('Desktop API bridge not available.');
  }

  return window.desktopApi;
}
