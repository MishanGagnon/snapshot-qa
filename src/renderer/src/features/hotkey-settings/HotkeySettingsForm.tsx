import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  HotkeyActionId,
  HotkeyBinding,
  HOTKEY_ACTION_DEFINITIONS,
  HotkeyKey,
  HotkeyMap,
  HotkeyModifier,
  HotkeyUpdateResponse,
  HotkeyValidationResult,
  SUPPORTED_HOTKEY_KEYS
} from '@shared/contracts';
import { useDebouncedEffect } from '@renderer/lib/useDebouncedEffect';

interface HotkeySettingsFormProps {
  initialValue: HotkeyMap;
  onValidate: (map: HotkeyMap) => Promise<HotkeyValidationResult>;
  onSave: (map: HotkeyMap) => Promise<HotkeyUpdateResponse>;
}

const modifierOrder: HotkeyModifier[] = ['cmd', 'shift', 'ctrl', 'alt'];
const modifierGlyph: Record<HotkeyModifier, string> = {
  cmd: '⌘',
  shift: '⇧',
  ctrl: '⌃',
  alt: '⌥'
};

export function HotkeySettingsForm({ initialValue, onValidate, onSave }: HotkeySettingsFormProps): JSX.Element {
  const [draft, setDraft] = useState<HotkeyMap>(initialValue);
  const [validation, setValidation] = useState<HotkeyValidationResult | null>(null);
  const [recordingActionId, setRecordingActionId] = useState<HotkeyActionId | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState('Autosaves on input.');
  const skipAutosave = useRef(true);
  const lastAppliedSignature = useRef(signatureFromMap(initialValue));
  const applySequence = useRef(0);

  useEffect(() => {
    setDraft(initialValue);
    skipAutosave.current = true;
    lastAppliedSignature.current = signatureFromMap(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (!recordingActionId) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.repeat) {
        return;
      }

      if (event.key === 'Escape') {
        setRecordingActionId(null);
        setRecordingError(null);
        return;
      }

      const key = parseSupportedKey(event);
      if (!key) {
        if (!isModifierOnlyKey(event.key)) {
          setRecordingError('Use A-Z or 0-9 as the primary key.');
        }
        return;
      }

      const modifiers = parseModifiers(event);
      if (modifiers.length === 0) {
        setRecordingError('Include at least one modifier key (Cmd, Shift, Ctrl, or Alt).');
        return;
      }

      const nextBinding: HotkeyBinding = {
        actionId: recordingActionId,
        key,
        modifiers
      };

      setDraft((prev) => ({
        ...prev,
        [recordingActionId]: nextBinding
      }));
      setValidation(null);
      setRecordingError(null);
      setRecordingActionId(null);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [recordingActionId]);

  useDebouncedEffect(
    () => {
      if (recordingActionId) {
        return;
      }

      if (skipAutosave.current) {
        skipAutosave.current = false;
        return;
      }

      const signature = signatureFromMap(draft);
      if (signature === lastAppliedSignature.current) {
        return;
      }

      const sequence = ++applySequence.current;
      const apply = async () => {
        setApplyStatus('Validating...');
        const precheck = await onValidate(draft);
        if (sequence !== applySequence.current) {
          return;
        }

        setValidation(precheck);
        if (!precheck.valid) {
          setApplyStatus('Invalid shortcut combination.');
          return;
        }

        setApplyStatus('Applying...');
        const result = await onSave(draft);
        if (sequence !== applySequence.current) {
          return;
        }
        setValidation(result.validation);
        if (result.ok) {
          lastAppliedSignature.current = signature;
          setApplyStatus('Applied');
        } else {
          setApplyStatus('Blocked by validation');
        }
      };

      void apply();
    },
    300,
    [draft, recordingActionId, onValidate, onSave]
  );

  const hasErrors = useMemo(() => Boolean(validation && !validation.valid), [validation]);

  return (
    <section className="panel">
      {HOTKEY_ACTION_DEFINITIONS.map((action) => {
        const current = draft[action.id];
        const isRecording = recordingActionId === action.id;
        return (
          <section className="hotkey-row" key={action.id}>
            <div className="hotkey-row__meta">
              <h3>{action.label}</h3>
              <p>{action.description}</p>
              {isRecording ? <p className="helper-text">Press your shortcut now. Press Esc to cancel.</p> : null}
              {isRecording && recordingError ? <p className="error-text">{recordingError}</p> : null}
              {validation?.errors[action.id] ? <p className="error-text">{validation.errors[action.id]}</p> : null}
            </div>

            <div className="hotkey-row__controls hotkey-capture">
              <div className={`hotkey-capture__value ${isRecording ? 'is-recording' : ''}`}>
                {isRecording ? 'Press shortcut...' : formatBinding(current)}
              </div>

              <div className="hotkey-capture__actions">
                <button
                  type="button"
                  className={`button ${isRecording ? 'button--recording' : ''}`}
                  onClick={() => {
                    setRecordingActionId(action.id);
                    setRecordingError(null);
                  }}
                >
                  {isRecording ? 'Recording...' : 'Record Shortcut'}
                </button>

                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setDraft((prev) => ({
                      ...prev,
                      [action.id]: action.defaultBinding
                    }));
                    setValidation(null);
                  }}
                >
                  Use Default
                </button>
              </div>
            </div>
          </section>
        );
      })}

      {hasErrors ? <p className="error-text">Fix invalid combinations before they can be applied.</p> : null}

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
        <span className="helper-text">{applyStatus}</span>
      </div>
    </section>
  );
}

function parseSupportedKey(event: KeyboardEvent): HotkeyKey | null {
  const byCode = parseKeyFromCode(event.code);
  if (byCode) {
    return byCode;
  }

  const key = event.key?.toUpperCase();
  if (key && SUPPORTED_HOTKEY_KEYS.includes(key as HotkeyKey)) {
    return key as HotkeyKey;
  }

  return null;
}

function parseKeyFromCode(code: string): HotkeyKey | null {
  if (code.startsWith('Key') && code.length === 4) {
    const letter = code.slice(3).toUpperCase();
    if (SUPPORTED_HOTKEY_KEYS.includes(letter as HotkeyKey)) {
      return letter as HotkeyKey;
    }
  }

  if (code.startsWith('Digit') && code.length === 6) {
    const digit = code.slice(5);
    if (SUPPORTED_HOTKEY_KEYS.includes(digit as HotkeyKey)) {
      return digit as HotkeyKey;
    }
  }

  return null;
}

function parseModifiers(event: KeyboardEvent): HotkeyModifier[] {
  const modifiers: HotkeyModifier[] = [];
  if (event.metaKey) {
    modifiers.push('cmd');
  }
  if (event.shiftKey) {
    modifiers.push('shift');
  }
  if (event.ctrlKey) {
    modifiers.push('ctrl');
  }
  if (event.altKey) {
    modifiers.push('alt');
  }
  return modifierOrder.filter((modifier) => modifiers.includes(modifier));
}

function isModifierOnlyKey(key: string): boolean {
  return key === 'Meta' || key === 'Shift' || key === 'Control' || key === 'Alt';
}

function formatBinding(binding: HotkeyBinding): string {
  const modifierPart = modifierOrder
    .filter((modifier) => binding.modifiers.includes(modifier))
    .map((modifier) => modifierGlyph[modifier])
    .join('');

  return `${modifierPart}${binding.key}`;
}

function signatureFromMap(map: HotkeyMap): string {
  return HOTKEY_ACTION_DEFINITIONS.map((action) => formatBinding(map[action.id])).join('|');
}
