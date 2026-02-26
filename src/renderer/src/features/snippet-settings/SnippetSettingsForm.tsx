import React, { useEffect, useRef, useState } from 'react';
import {
  GeneralSettings,
  HotkeyBinding,
  HotkeyMap,
  HotkeyModifier,
  SnippetHotkeyActionId,
  TEXT_SNIPPET_DEFINITIONS,
  TextSnippetId
} from '@shared/contracts';
import { useDebouncedEffect } from '@renderer/lib/useDebouncedEffect';

interface SnippetSettingsFormProps {
  initialValue: GeneralSettings;
  hotkeys: HotkeyMap;
  onSave: (patch: Partial<GeneralSettings>) => Promise<void>;
}

type SnippetDraft = Pick<GeneralSettings, TextSnippetId>;

const modifierOrder: HotkeyModifier[] = ['cmd', 'shift', 'ctrl', 'alt'];
const modifierGlyph: Record<HotkeyModifier, string> = {
  cmd: '⌘',
  shift: '⇧',
  ctrl: '⌃',
  alt: '⌥'
};

const SNIPPET_TO_HOTKEY_ACTION: Record<TextSnippetId, SnippetHotkeyActionId> = {
  snippet_1: 'type_snippet_1',
  snippet_2: 'type_snippet_2',
  snippet_3: 'type_snippet_3'
};

export function SnippetSettingsForm({ initialValue, hotkeys, onSave }: SnippetSettingsFormProps): JSX.Element {
  const [draft, setDraft] = useState<SnippetDraft>(extractSnippetDraft(initialValue));
  const [status, setStatus] = useState('Autosaves on input.');
  const skipAutosave = useRef(true);

  useEffect(() => {
    setDraft(extractSnippetDraft(initialValue));
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
      <div className="snippet-settings__header">
        <p className="helper-text">
          These snippets are typed as keyboard events, not clipboard paste. Latest answer typing hotkey:{' '}
          <strong>{formatBinding(hotkeys.type_latest_response)}</strong>
        </p>
      </div>

      <div className="snippet-settings__grid">
        {TEXT_SNIPPET_DEFINITIONS.map((snippet) => {
          const actionId = SNIPPET_TO_HOTKEY_ACTION[snippet.id];
          return (
            <label className="field" key={snippet.id}>
              <span className="snippet-settings__label-row">
                <span className="field__label">{snippet.label}</span>
                <span className="snippet-settings__hotkey">{formatBinding(hotkeys[actionId])}</span>
              </span>
              <textarea
                className="field__textarea snippet-settings__textarea"
                value={draft[snippet.id]}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    [snippet.id]: event.target.value
                  }))
                }
                rows={7}
                placeholder={snippet.placeholder}
              />
            </label>
          );
        })}
      </div>

      <p className="helper-text">{status}</p>
    </section>
  );
}

function extractSnippetDraft(settings: GeneralSettings): SnippetDraft {
  return {
    snippet_1: settings.snippet_1,
    snippet_2: settings.snippet_2,
    snippet_3: settings.snippet_3
  };
}

function formatBinding(binding: HotkeyBinding): string {
  const modifierPart = modifierOrder
    .filter((modifier) => binding.modifiers.includes(modifier))
    .map((modifier) => modifierGlyph[modifier])
    .join('');

  return `${modifierPart}${binding.key}`;
}
