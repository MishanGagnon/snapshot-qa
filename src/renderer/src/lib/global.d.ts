import { DesktopApi } from '@shared/contracts';

declare global {
  interface Window {
    desktopApi?: DesktopApi;
  }
}

export {};
