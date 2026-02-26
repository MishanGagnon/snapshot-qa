import React, { useEffect, useMemo, useState } from 'react';
import {
  AppSettings,
  HotkeyMap,
  HotkeyUpdateResponse,
  HotkeyValidationResult,
  KeyStatusResponse,
  PermissionStatus
} from '@shared/contracts';
import { TabId, TabNav } from '@renderer/components/TabNav';
import { ApiKeysSettingsForm } from '@renderer/features/api-keys-settings/ApiKeysSettingsForm';
import { GeneralSettingsForm } from '@renderer/features/general-settings/GeneralSettingsForm';
import { HotkeySettingsForm } from '@renderer/features/hotkey-settings/HotkeySettingsForm';
import { SnippetSettingsForm } from '@renderer/features/snippet-settings/SnippetSettingsForm';
import { getDesktopApi } from '@renderer/lib/desktopApi';

const TAB_COPY: Record<TabId, { title: string; subtitle: string }> = {
  general: {
    title: 'General',
    subtitle: 'Context and runtime behavior.'
  },
  snippets: {
    title: 'Snippets',
    subtitle: 'Store reusable text blocks typed as keyboard input.'
  },
  hotkeys: {
    title: 'Hotkeys',
    subtitle: 'Remap actions with instant validation and apply.'
  },
  models: {
    title: 'Models',
    subtitle: 'Choose default OpenRouter model and manage credentials.'
  }
};

export function App(): JSX.Element {
  const api = useMemo(() => getDesktopApi(), []);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [hotkeys, setHotkeys] = useState<HotkeyMap | null>(null);
  const [keyStatus, setKeyStatus] = useState<KeyStatusResponse | null>(null);
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [feedback, setFeedback] = useState<string>('');

  useEffect(() => {
    if (!api) {
      return;
    }

    void (async () => {
      const [loadedSettings, loadedHotkeys, loadedKeyStatus, loadedPermissions] = await Promise.all([
        api.settings.get(),
        api.hotkeys.get(),
        api.keys.getStatus(),
        api.permissions.getStatus()
      ]);

      setSettings(loadedSettings);
      setHotkeys(loadedHotkeys);
      setKeyStatus(loadedKeyStatus);
      setPermissions(loadedPermissions);
    })();
  }, [api]);

  if (!api) {
    return (
      <main className="app-shell app-shell--center">
        <section className="panel">
          <h2>Renderer Bridge Not Available</h2>
          <p className="helper-text">
            The preload bridge failed to load. Restart the app and check main-process logs.
          </p>
        </section>
      </main>
    );
  }

  if (!settings || !hotkeys || !keyStatus) {
    return <main className="app-shell app-shell--center">Loading settings...</main>;
  }

  const saveGeneral = async (general: AppSettings['general']) => {
    const updated = await api.settings.update(general);
    setSettings(updated);
    setFeedback('General settings saved.');
  };

  const saveDefaultModel = async (defaultModel: string) => {
    const updated = await api.settings.update({ defaultModel });
    setSettings(updated);
    setFeedback('Default model updated.');
  };

  const saveSnippetPatch = async (patch: Partial<AppSettings['general']>) => {
    const updated = await api.settings.update(patch);
    setSettings(updated);
    setFeedback('Snippet settings saved.');
  };

  const saveHotkeys = async (map: HotkeyMap): Promise<HotkeyUpdateResponse> => {
    const result = await api.hotkeys.update(map);
    if (result.ok) {
      setHotkeys(map);
      setFeedback('Hotkeys applied immediately.');
    } else {
      setFeedback('Hotkey update blocked by validation errors.');
    }
    return result;
  };

  const validateHotkeys = async (map: HotkeyMap): Promise<HotkeyValidationResult> => api.hotkeys.validate(map);

  const saveOpenRouterKey = async (value: string): Promise<void> => {
    const status = await api.keys.setOpenRouter(value);
    setKeyStatus(status);
    setFeedback('OpenRouter key saved to Keychain.');
  };

  const tabCopy = TAB_COPY[activeTab];

  return (
    <main className="app-shell">
      <TabNav activeTab={activeTab} onChange={setActiveTab} />

      <section className="content-frame">
        <header className="content-frame__header">
          <h2>{tabCopy.title}</h2>
          <p>{tabCopy.subtitle}</p>
        </header>

        {activeTab === 'general' ? (
          <GeneralSettingsForm initialValue={settings.general} permissions={permissions} onSave={saveGeneral} />
        ) : null}

        {activeTab === 'snippets' ? (
          <SnippetSettingsForm initialValue={settings.general} hotkeys={hotkeys} onSave={saveSnippetPatch} />
        ) : null}

        {activeTab === 'hotkeys' ? (
          <HotkeySettingsForm initialValue={hotkeys} onSave={saveHotkeys} onValidate={validateHotkeys} />
        ) : null}

        {activeTab === 'models' ? (
          <ApiKeysSettingsForm
            hasOpenRouterKey={keyStatus.hasOpenRouterKey}
            defaultModel={settings.general.defaultModel}
            onSaveKey={saveOpenRouterKey}
            onSaveModel={saveDefaultModel}
          />
        ) : null}
      </section>

      <footer className="footer-status">{feedback}</footer>
    </main>
  );
}
