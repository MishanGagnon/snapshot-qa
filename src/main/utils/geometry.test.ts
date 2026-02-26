import { describe, expect, it } from 'vitest';
import { clampRectToBounds, normalizeRect, toDisplayPixelSize, toScaledRelativeRect } from './geometry';

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

  it('computes display pixel size from bounds and scale factor', () => {
    const displayPx = toDisplayPixelSize({ x: 0, y: 0, width: 1512, height: 982 }, 2);
    expect(displayPx).toEqual({ width: 3024, height: 1964 });
  });

  it('snaps draw rect to display pixel grid using scale factor', () => {
    const drawRect = toScaledRelativeRect(
      { x: 10.1, y: 20.2, width: 30.3, height: 40.4 },
      { x: 0, y: 0, width: 100, height: 100 },
      1.25,
      { width: 125, height: 125 }
    );

    expect(drawRect.x).toBeCloseTo(10.4);
    expect(drawRect.y).toBeCloseTo(20);
    expect(drawRect.width).toBeCloseTo(30.4);
    expect(drawRect.height).toBeCloseTo(40.8);
  });
});
