import React, { useEffect, useMemo, useState } from 'react';
import {
  HOTKEY_ACTION_DEFINITIONS,
  HotkeyMap,
  HotkeyModifier,
  HotkeyUpdateResponse,
  HotkeyValidationResult,
  SUPPORTED_HOTKEY_KEYS
} from '@shared/contracts';

interface HotkeySettingsFormProps {
  initialValue: HotkeyMap;
  onValidate: (map: HotkeyMap) => Promise<HotkeyValidationResult>;
  onSave: (map: HotkeyMap) => Promise<HotkeyUpdateResponse>;
}

const modifiers: HotkeyModifier[] = ['cmd', 'shift', 'ctrl', 'alt'];

export function HotkeySettingsForm({ initialValue, onValidate, onSave }: HotkeySettingsFormProps): JSX.Element {
  const [draft, setDraft] = useState<HotkeyMap>(initialValue);
  const [validation, setValidation] = useState<HotkeyValidationResult | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(initialValue);
  }, [initialValue]);

  const hasErrors = useMemo(() => Boolean(validation && !validation.valid), [validation]);

  return (
    <form
      className="panel"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          const precheck = await onValidate(draft);
          if (!precheck.valid) {
            setValidation(precheck);
            return;
          }

          const result = await onSave(draft);
          setValidation(result.validation);
        } finally {
          setSaving(false);
        }
      }}
    >
      {HOTKEY_ACTION_DEFINITIONS.map((action) => {
        const current = draft[action.id];
        return (
          <section className="hotkey-row" key={action.id}>
            <div className="hotkey-row__meta">
              <h3>{action.label}</h3>
              <p>{action.description}</p>
              {validation?.errors[action.id] ? <p className="error-text">{validation.errors[action.id]}</p> : null}
            </div>

            <div className="hotkey-row__controls">
              <select
                className="field__select"
                value={current.key}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    [action.id]: {
                      ...prev[action.id],
                      key: event.target.value as (typeof current)['key']
                    }
                  }))
                }
              >
                {SUPPORTED_HOTKEY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>

              <div className="modifier-list">
                {modifiers.map((modifier) => {
                  const checked = current.modifiers.includes(modifier);
                  return (
                    <label className="modifier" key={`${action.id}-${modifier}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setDraft((prev) => {
                            const existing = prev[action.id].modifiers;
                            const nextModifiers = event.target.checked
                              ? [...existing, modifier]
                              : existing.filter((item) => item !== modifier);

                            return {
                              ...prev,
                              [action.id]: {
                                ...prev[action.id],
                                modifiers: nextModifiers
                              }
                            };
                          });
                        }}
                      />
                      <span>{modifier}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}

      {hasErrors ? <p className="error-text">Fix invalid combinations before saving.</p> : null}

      <div className="button-row">
        <button
          type="button"
          className="button"
          onClick={() => {
            const defaults = HOTKEY_ACTION_DEFINITIONS.reduce((acc, action) => {
              acc[action.id] = action.defaultBinding;
              return acc;
            }, {} as HotkeyMap);
            setDraft(defaults);
            setValidation(null);
          }}
        >
          Reset Defaults
        </button>

        <button type="submit" className="button button--primary" disabled={saving}>
          {saving ? 'Applying...' : 'Apply Hotkeys'}
        </button>
      </div>
    </form>
  );
}
