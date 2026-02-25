# Discreet QA (macOS)

A menu bar Electron app for low-visibility screenshot Q&A with OpenRouter.

## Features

- Global hotkeys with hold semantics:
  - `Cmd+Shift+W` (default): hold to define a capture rectangle from key-down cursor position to key-up position.
  - `Cmd+Shift+E` (default): hold to show latest response near cursor.
- Configurable hotkeys in Settings -> Hotkeys.
- Settings tabs:
  - General (corpus, custom info, default model, selection-box toggle, launch-at-login).
  - Hotkeys (remappable actions with validation/conflict checks).
  - API Keys (OpenRouter key in macOS Keychain).
- OpenRouter multimodal inference pipeline with streaming and 20s timeout.
- Cursor-attached indicator states:
  - Pending: tiny gold square.
  - Complete: subtle text bubble + copy result to clipboard.
  - Error: tiny red indicator + copy concise error token.
- Minimal local logs and no persisted response history.

## Architecture

- `src/main`: system/runtime logic (hotkeys, capture, overlays, inference, IPC, persistence).
- `src/preload`: secure typed bridge for renderer.
- `src/renderer`: settings UI split by feature.
- `src/shared/contracts`: typed cross-process contracts.

## Setup

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Tests

```bash
npm test
```

## Notes

- macOS permissions are required for practical use:
  - Screen Recording
  - Accessibility/Input monitoring for global hooks
- Provider scope is OpenRouter-only in v1.
- Default model is `google/gemini-3-flash-preview` and can be changed in Settings.
