import { describe, expect, it } from 'vitest';
import { clampRectToBounds, normalizeRect } from './geometry';

describe('geometry helpers', () => {
  it('normalizes mixed direction drags', () => {
    const rect = normalizeRect({ x: 300, y: 200 }, { x: 100, y: 50 });
    expect(rect).toEqual({ x: 100, y: 50, width: 200, height: 150 });
  });

  it('clamps to display bounds', () => {
    const clamped = clampRectToBounds(
      { x: -10, y: -10, width: 100, height: 100 },
      { x: 0, y: 0, width: 50, height: 50 }
    );

    expect(clamped).toEqual({ x: 0, y: 0, width: 50, height: 50 });
  });

  it('returns null for tiny capture regions', () => {
    const clamped = clampRectToBounds(
      { x: 0, y: 0, width: 1, height: 1 },
      { x: 0, y: 0, width: 100, height: 100 }
    );

    expect(clamped).toBeNull();
  });
});
