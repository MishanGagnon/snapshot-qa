import React, { useState } from 'react';

interface ApiKeysSettingsFormProps {
  hasOpenRouterKey: boolean;
  onSave: (key: string) => Promise<void>;
}

export function ApiKeysSettingsForm({ hasOpenRouterKey, onSave }: ApiKeysSettingsFormProps): JSX.Element {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="panel"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!value.trim()) {
          return;
        }

        setSaving(true);
        try {
          await onSave(value.trim());
          setValue('');
        } finally {
          setSaving(false);
        }
      }}
    >
      <p className="helper-text">
        Store your OpenRouter API key in macOS Keychain. This is the only provider key required in v1.
      </p>

      <label className="field">
        <span className="field__label">OpenRouter API Key</span>
        <input
          className="field__input"
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="sk-or-v1-..."
        />
      </label>

      <div className={`pill ${hasOpenRouterKey ? 'is-ok' : 'is-warn'}`}>
        Key status: {hasOpenRouterKey ? 'configured' : 'missing'}
      </div>

      <button type="submit" className="button button--primary" disabled={saving}>
        {saving ? 'Saving...' : 'Save API Key'}
      </button>
    </form>
  );
}
