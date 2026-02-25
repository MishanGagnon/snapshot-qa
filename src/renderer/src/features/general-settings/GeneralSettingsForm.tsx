import React, { useEffect, useState } from 'react';
import { GeneralSettings, PermissionStatus } from '@shared/contracts';

interface GeneralSettingsFormProps {
  initialValue: GeneralSettings;
  permissions: PermissionStatus | null;
  onSave: (next: GeneralSettings) => Promise<void>;
}

export function GeneralSettingsForm({ initialValue, permissions, onSave }: GeneralSettingsFormProps): JSX.Element {
  const [draft, setDraft] = useState<GeneralSettings>(initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(initialValue);
  }, [initialValue]);

  return (
    <form
      className="panel"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await onSave(draft);
        } finally {
          setSaving(false);
        }
      }}
    >
      <label className="field">
        <span className="field__label">Corpus</span>
        <textarea
          className="field__textarea"
          value={draft.corpus}
          onChange={(event) => setDraft((prev) => ({ ...prev, corpus: event.target.value }))}
          rows={10}
          placeholder="Paste internal glossary/context corpus..."
        />
      </label>

      <label className="field">
        <span className="field__label">Custom Info</span>
        <textarea
          className="field__textarea field__textarea--small"
          value={draft.customInfo}
          onChange={(event) => setDraft((prev) => ({ ...prev, customInfo: event.target.value }))}
          rows={4}
          placeholder="Persistent instruction appended to each request"
        />
      </label>

      <label className="field">
        <span className="field__label">Default OpenRouter Model</span>
        <input
          className="field__input"
          value={draft.defaultModel}
          onChange={(event) => setDraft((prev) => ({ ...prev, defaultModel: event.target.value }))}
          placeholder="google/gemini-3-flash-preview"
        />
      </label>

      <div className="toggle-grid">
        <label className="toggle">
          <input
            type="checkbox"
            checked={draft.showSelectionBox}
            onChange={(event) => setDraft((prev) => ({ ...prev, showSelectionBox: event.target.checked }))}
          />
          <span>Show subtle selection box during capture</span>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={draft.launchAtLogin}
            onChange={(event) => setDraft((prev) => ({ ...prev, launchAtLogin: event.target.checked }))}
          />
          <span>Launch at login</span>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={draft.imageCompressionEnabled}
            onChange={(event) => setDraft((prev) => ({ ...prev, imageCompressionEnabled: event.target.checked }))}
          />
          <span>Compress large captures before upload (lower cost, slightly less detail)</span>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={draft.contextCachingEnabled}
            onChange={(event) => setDraft((prev) => ({ ...prev, contextCachingEnabled: event.target.checked }))}
          />
          <span>Enable context prompt caching for repeated corpus (provider support required)</span>
        </label>
      </div>

      <div className="status-strip">
        <div className={`pill ${permissions?.screenRecording === 'granted' ? 'is-ok' : 'is-warn'}`}>
          Screen: {permissions?.screenRecording ?? 'unknown'}
        </div>
        <div className={`pill ${permissions?.accessibilityTrusted ? 'is-ok' : 'is-warn'}`}>
          Accessibility: {permissions?.accessibilityTrusted ? 'granted' : 'not granted'}
        </div>
      </div>

      <button type="submit" className="button button--primary" disabled={saving}>
        {saving ? 'Saving...' : 'Save General Settings'}
      </button>
    </form>
  );
}
