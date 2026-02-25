import React, { useEffect, useRef, useState } from 'react';
import { useDebouncedEffect } from '@renderer/lib/useDebouncedEffect';

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
  const [modelStatus, setModelStatus] = useState('Autosaves on input.');
  const [keyStatus, setKeyStatus] = useState('Autosaves on input.');
  const skipModelAutosave = useRef(true);
  const skipKeyAutosave = useRef(true);
  const lastSavedModel = useRef(defaultModel.trim());
  const lastSavedKey = useRef(value.trim());

  useEffect(() => {
    setModelDraft(defaultModel);
    lastSavedModel.current = defaultModel.trim();
    skipModelAutosave.current = true;
  }, [defaultModel]);

  useDebouncedEffect(
    () => {
      if (skipModelAutosave.current) {
        skipModelAutosave.current = false;
        return;
      }

      const nextModel = modelDraft.trim();
      if (!nextModel || nextModel === lastSavedModel.current) {
        return;
      }

      const apply = async () => {
        setModelStatus('Saving...');
        try {
          await onSaveModel(nextModel);
          lastSavedModel.current = nextModel;
          setModelStatus('Saved');
        } catch {
          setModelStatus('Failed to save');
        }
      };

      void apply();
    },
    350,
    [modelDraft, onSaveModel]
  );

  useDebouncedEffect(
    () => {
      if (skipKeyAutosave.current) {
        skipKeyAutosave.current = false;
        return;
      }

      const candidate = value.trim();
      if (!candidate || candidate === lastSavedKey.current) {
        return;
      }

      const apply = async () => {
        setKeyStatus('Saving key...');
        try {
          await onSaveKey(candidate);
          lastSavedKey.current = candidate;
          setKeyStatus('Key saved');
        } catch {
          setKeyStatus('Failed to save key');
        }
      };

      void apply();
    },
    550,
    [value, onSaveKey]
  );

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
      <p className="helper-text">{modelStatus}</p>

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
      <p className="helper-text">{keyStatus}</p>
    </section>
  );
}
