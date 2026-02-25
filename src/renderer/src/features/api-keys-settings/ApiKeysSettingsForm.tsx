import React, { useEffect, useState } from 'react';

interface ApiKeysSettingsFormProps {
  hasOpenRouterKey: boolean;
  defaultModel: string;
  onSaveKey: (key: string) => Promise<void>;
  onSaveModel: (model: string) => Promise<void>;
}

export function ApiKeysSettingsForm({
  hasOpenRouterKey,
  defaultModel,
  onSaveKey,
  onSaveModel
}: ApiKeysSettingsFormProps): JSX.Element {
  const [modelDraft, setModelDraft] = useState(defaultModel);
  const [value, setValue] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [savingModel, setSavingModel] = useState(false);

  useEffect(() => {
    setModelDraft(defaultModel);
  }, [defaultModel]);

  return (
    <section className="panel">
      <p className="helper-text">
        Configure the default OpenRouter model and key used for screenshot inference.
      </p>

      <label className="field">
        <span className="field__label">Default OpenRouter Model</span>
        <input
          className="field__input"
          value={modelDraft}
          onChange={(event) => setModelDraft(event.target.value)}
          placeholder="google/gemini-3-flash-preview"
        />
      </label>

      <div className="button-row">
        <span />
        <button
          type="button"
          className="button button--primary"
          disabled={savingModel}
          onClick={async () => {
            const nextModel = modelDraft.trim();
            if (!nextModel) {
              return;
            }

            setSavingModel(true);
            try {
              await onSaveModel(nextModel);
            } finally {
              setSavingModel(false);
            }
          }}
        >
          {savingModel ? 'Saving Model...' : 'Save Model'}
        </button>
      </div>

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

      <div className="button-row">
        <span />
        <button
          type="button"
          className="button button--primary"
          disabled={savingKey}
          onClick={async () => {
            if (!value.trim()) {
              return;
            }

            setSavingKey(true);
            try {
              await onSaveKey(value.trim());
              setValue('');
            } finally {
              setSavingKey(false);
            }
          }}
        >
          {savingKey ? 'Saving Key...' : 'Save API Key'}
        </button>
      </div>
    </section>
  );
}
