import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_HOTKEY_MAP,
  GeneralSettings,
  HotkeyActionId,
  HotkeyMap,
  SUPPORTED_HOTKEY_KEYS
} from '@shared/contracts';
import { logger } from '@main/utils/logger';

const modifierSchema = z.enum(['cmd', 'shift', 'ctrl', 'alt']);
const hotkeySchema = z.object({
  actionId: z.enum(['capture_region', 'show_latest_response']),
  key: z.enum(SUPPORTED_HOTKEY_KEYS as unknown as [string, ...string[]]),
  modifiers: z.array(modifierSchema)
});

const settingsSchema = z.object({
  general: z
    .object({
      corpus: z.string(),
      customInfo: z.string(),
      defaultModel: z.string(),
      showSelectionBox: z.boolean(),
      showResponseChrome: z.boolean(),
      ultraDiscreteMode: z.boolean(),
      launchAtLogin: z.boolean(),
      imageCompressionEnabled: z.boolean(),
      contextCachingEnabled: z.boolean()
    })
    .partial(),
  hotkeys: z.record(hotkeySchema).optional()
});

export class SettingsStore {
  private readonly filePath: string;
  private settings: AppSettings = structuredClone(DEFAULT_APP_SETTINGS);

  constructor(fileName = 'settings.enc.json') {
    this.filePath = join(app.getPath('userData'), fileName);
    this.load();
  }

  get(): AppSettings {
    return structuredClone(this.settings);
  }

  updateGeneral(nextGeneral: Partial<AppSettings['general']>): AppSettings {
    const patch = this.normalizeGeneralPatch(nextGeneral);
    this.settings = {
      ...this.settings,
      general: {
        ...this.settings.general,
        ...patch
      }
    };
    this.persist();
    return this.get();
  }

  updateHotkeys(nextHotkeys: HotkeyMap): AppSettings {
    this.settings = {
      ...this.settings,
      hotkeys: nextHotkeys
    };
    this.persist();
    return this.get();
  }

  setAll(nextSettings: AppSettings): AppSettings {
    this.settings = this.normalize(nextSettings);
    this.persist();
    return this.get();
  }

  private load(): void {
    if (!existsSync(this.filePath)) {
      this.persist();
      return;
    }

    try {
      const rawBuffer = readFileSync(this.filePath);
      const decoded = this.decode(rawBuffer);
      const parsed = JSON.parse(decoded);
      this.settings = this.normalize(parsed);
    } catch (error) {
      logger.warn('Failed to read encrypted settings. Reverting to defaults.', {
        reason: error instanceof Error ? error.message : 'unknown'
      });
      this.settings = structuredClone(DEFAULT_APP_SETTINGS);
      this.persist();
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const payload = JSON.stringify(this.settings);
    const encoded = this.encode(payload);
    writeFileSync(this.filePath, encoded);
  }

  private normalize(input: unknown): AppSettings {
    const parsed = settingsSchema.safeParse(input);

    if (!parsed.success) {
      return structuredClone(DEFAULT_APP_SETTINGS);
    }

    const general = {
      ...DEFAULT_GENERAL_SETTINGS,
      ...parsed.data.general
    };

    const hotkeys: HotkeyMap = { ...DEFAULT_HOTKEY_MAP };
    const source = parsed.data.hotkeys ?? {};

    (Object.keys(DEFAULT_HOTKEY_MAP) as HotkeyActionId[]).forEach((actionId) => {
      const candidate = source[actionId];
      if (!candidate) {
        return;
      }
      hotkeys[actionId] = {
        actionId,
        key: candidate.key as (typeof hotkeys)[HotkeyActionId]['key'],
        modifiers: [...candidate.modifiers]
      };
    });

    return {
      general,
      hotkeys
    };
  }

  private normalizeGeneralPatch(input: Partial<GeneralSettings>): Partial<GeneralSettings> {
    const patch: Partial<GeneralSettings> = {};

    if (typeof input.corpus === 'string') {
      patch.corpus = input.corpus;
    }

    if (typeof input.customInfo === 'string') {
      patch.customInfo = input.customInfo;
    }

    if (typeof input.defaultModel === 'string') {
      patch.defaultModel = input.defaultModel;
    }

    if (typeof input.showSelectionBox === 'boolean') {
      patch.showSelectionBox = input.showSelectionBox;
    }

    if (typeof input.showResponseChrome === 'boolean') {
      patch.showResponseChrome = input.showResponseChrome;
    }

    if (typeof input.ultraDiscreteMode === 'boolean') {
      patch.ultraDiscreteMode = input.ultraDiscreteMode;
    }

    if (typeof input.launchAtLogin === 'boolean') {
      patch.launchAtLogin = input.launchAtLogin;
    }

    if (typeof input.imageCompressionEnabled === 'boolean') {
      patch.imageCompressionEnabled = input.imageCompressionEnabled;
    }

    if (typeof input.contextCachingEnabled === 'boolean') {
      patch.contextCachingEnabled = input.contextCachingEnabled;
    }

    return patch;
  }

  private encode(value: string): Buffer {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(value);
    }
    return Buffer.from(value, 'utf8');
  }

  private decode(buffer: Buffer): string {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(buffer);
    }
    return buffer.toString('utf8');
  }
}
