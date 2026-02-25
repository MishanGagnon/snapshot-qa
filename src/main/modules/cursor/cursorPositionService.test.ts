import { describe, expect, it } from 'vitest';
import { toCursorTargetAnchor, toGlobalCursorAnchor } from './cursorPositionService';

describe('CursorPositionService helpers', () => {
  it('maps raw point to global top-right anchor', () => {
    const anchored = toGlobalCursorAnchor({ x: 100, y: 100 });
    expect(anchored).toEqual({ x: 114, y: 80 });
  });

  it('nudges capture anchor above-left of indicator anchor', () => {
    const raw = { x: 220, y: 310 };
    expect(toCursorTargetAnchor(raw, 'capture')).toEqual({ x: 218, y: 286 });
    expect(toCursorTargetAnchor(raw, 'indicator')).toEqual({ x: 234, y: 290 });
  });
});
