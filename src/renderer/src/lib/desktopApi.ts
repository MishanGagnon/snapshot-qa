import { DesktopApi } from '@shared/contracts';

export function getDesktopApi(): DesktopApi | null {
  return window.desktopApi ?? null;
}
