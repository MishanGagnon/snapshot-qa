import updaterPkg from 'electron-updater';
import type { UpdateInfo } from 'electron-updater';
import { AppUpdateStatus, UpdateActionResponse } from '@shared/contracts';
import { logger } from '@main/utils/logger';

const { autoUpdater } = updaterPkg;

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

function initialStatus(packaged: boolean): AppUpdateStatus {
  if (!packaged) {
    return {
      state: 'disabled',
      available: false
    };
  }

  return {
    state: 'idle',
    available: false
  };
}

export class UpdateService {
  private status: AppUpdateStatus;
  private started = false;
  private checking = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(private readonly packaged: boolean) {
    this.status = initialStatus(packaged);
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    if (!this.packaged) {
      logger.info('App updates disabled in development builds.');
      return;
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('checking-for-update', this.handleCheckingForUpdate);
    autoUpdater.on('update-available', this.handleUpdateAvailable);
    autoUpdater.on('update-not-available', this.handleUpdateNotAvailable);
    autoUpdater.on('download-progress', this.handleDownloadProgress);
    autoUpdater.on('update-downloaded', this.handleUpdateDownloaded);
    autoUpdater.on('error', this.handleUpdateError);

    void this.checkNow();
    this.pollInterval = setInterval(() => {
      void this.checkNow();
    }, CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (!this.packaged) {
      return;
    }

    autoUpdater.off('checking-for-update', this.handleCheckingForUpdate);
    autoUpdater.off('update-available', this.handleUpdateAvailable);
    autoUpdater.off('update-not-available', this.handleUpdateNotAvailable);
    autoUpdater.off('download-progress', this.handleDownloadProgress);
    autoUpdater.off('update-downloaded', this.handleUpdateDownloaded);
    autoUpdater.off('error', this.handleUpdateError);
  }

  getStatus(): AppUpdateStatus {
    return { ...this.status };
  }

  async checkNow(): Promise<AppUpdateStatus> {
    if (!this.packaged) {
      return this.getStatus();
    }

    if (this.checking) {
      return this.getStatus();
    }

    this.checking = true;
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown';
      this.setStatus({
        state: 'error',
        available: false,
        error: reason
      });
      logger.warn('Update check failed', { reason });
    } finally {
      this.checking = false;
    }

    return this.getStatus();
  }

  async installNow(): Promise<UpdateActionResponse> {
    if (!this.packaged) {
      return {
        ok: false,
        message: 'Updates are only available in packaged builds.',
        status: this.getStatus()
      };
    }

    if (this.status.state === 'downloaded') {
      setTimeout(() => {
        autoUpdater.quitAndInstall(false, true);
      }, 50);
      return {
        ok: true,
        message: 'Installing update and restarting.',
        status: this.getStatus()
      };
    }

    if (this.status.state === 'available') {
      try {
        this.setStatus({
          state: 'downloading',
          available: true,
          error: undefined
        });
        await autoUpdater.downloadUpdate();
        setTimeout(() => {
          autoUpdater.quitAndInstall(false, true);
        }, 50);
        return {
          ok: true,
          message: 'Installing update and restarting.',
          status: this.getStatus()
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown';
        this.setStatus({
          state: 'error',
          available: true,
          error: reason
        });
        logger.warn('Update download failed', { reason });
        return {
          ok: false,
          message: 'Update download failed.',
          status: this.getStatus()
        };
      }
    }

    if (this.status.state === 'downloading') {
      return {
        ok: false,
        message: 'Update is still downloading.',
        status: this.getStatus()
      };
    }

    if (this.status.state === 'checking') {
      return {
        ok: false,
        message: 'Still checking for updates.',
        status: this.getStatus()
      };
    }

    const status = await this.checkNow();
    if (status.state === 'available' || status.state === 'downloaded') {
      return this.installNow();
    }

    return {
      ok: false,
      message: 'No update available right now.',
      status
    };
  }

  private setStatus(next: AppUpdateStatus): void {
    this.status = next;
  }

  private readonly handleCheckingForUpdate = (): void => {
    this.setStatus({
      state: 'checking',
      available: false
    });
    logger.info('Checking for app updates.');
  };

  private readonly handleUpdateAvailable = (info: UpdateInfo): void => {
    this.setStatus({
      state: 'available',
      available: true,
      version: info.version,
      error: undefined
    });
    logger.info('App update available', {
      version: info.version
    });
  };

  private readonly handleUpdateNotAvailable = (): void => {
    this.setStatus({
      state: 'not_available',
      available: false,
      error: undefined
    });
    logger.info('No app update available.');
  };

  private readonly handleDownloadProgress = (): void => {
    this.setStatus({
      state: 'downloading',
      available: true,
      version: this.status.version,
      error: undefined
    });
  };

  private readonly handleUpdateDownloaded = (info: UpdateInfo): void => {
    this.setStatus({
      state: 'downloaded',
      available: true,
      version: info.version,
      error: undefined
    });
    logger.info('App update downloaded', {
      version: info.version
    });
  };

  private readonly handleUpdateError = (error: Error): void => {
    this.setStatus({
      state: 'error',
      available: this.status.available,
      version: this.status.version,
      error: error.message
    });
    logger.warn('App update error', {
      reason: error.message
    });
  };
}
