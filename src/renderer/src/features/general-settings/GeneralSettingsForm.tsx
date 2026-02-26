import React, { useEffect, useRef, useState } from 'react';
import { GeneralSettings, PermissionStatus } from '@shared/contracts';
import { useDebouncedEffect } from '@renderer/lib/useDebouncedEffect';

interface GeneralSettingsFormProps {
  initialValue: GeneralSettings;
  permissions: PermissionStatus | null;
  onSave: (next: GeneralSettings) => Promise<void>;
}

export function GeneralSettingsForm({ initialValue, permissions, onSave }: GeneralSettingsFormProps): JSX.Element {
  const [draft, setDraft] = useState<GeneralSettings>(initialValue);
  const [status, setStatus] = useState('Autosaves on input.');
  const skipAutosave = useRef(true);
  const responseChromeLocked = draft.ultraDiscreteMode;

  useEffect(() => {
    setDraft(initialValue);
    skipAutosave.current = true;
  }, [initialValue]);

  useDebouncedEffect(
    () => {
      if (skipAutosave.current) {
        skipAutosave.current = false;
        return;
      }

      const apply = async () => {
        setStatus('Saving...');
        try {
          await onSave(draft);
          setStatus('Saved');
        } catch {
          setStatus('Failed to save');
        }
      };

      void apply();
    },
    250,
    [draft, onSave]
  );

  return (
    <section className="panel">
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
            checked={draft.showCursorDebugDot}
            onChange={(event) => setDraft((prev) => ({ ...prev, showCursorDebugDot: event.target.checked }))}
          />
          <span>Show cursor debug dot overlay (alignment troubleshooting)</span>
        </label>

        <label className={`toggle ${responseChromeLocked ? 'toggle--disabled' : ''}`}>
          <input
            type="checkbox"
            checked={draft.showResponseChrome}
            disabled={responseChromeLocked}
            onChange={(event) => setDraft((prev) => ({ ...prev, showResponseChrome: event.target.checked }))}
          />
          <span>
            Show response bubble background and border
            {responseChromeLocked ? ' (disabled in ultra discrete mode)' : ''}
          </span>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={draft.ultraDiscreteMode}
            onChange={(event) => setDraft((prev) => ({ ...prev, ultraDiscreteMode: event.target.checked }))}
          />
          <span>Ultra discrete mode (text-only, no response background)</span>
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

      <p className="helper-text">{status}</p>
    </section>
  );
}
