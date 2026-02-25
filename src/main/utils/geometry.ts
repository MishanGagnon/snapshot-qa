import { Rectangle } from 'electron';

export interface Point {
  x: number;
  y: number;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function normalizeRect(start: Point, end: Point): NormalizedRect {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return { x, y, width, height };
}

export function clampRectToBounds(rect: NormalizedRect, bounds: Rectangle): NormalizedRect | null {
  const left = Math.max(rect.x, bounds.x);
  const top = Math.max(rect.y, bounds.y);
  const right = Math.min(rect.x + rect.width, bounds.x + bounds.width);
  const bottom = Math.min(rect.y + rect.height, bounds.y + bounds.height);

  const width = right - left;
  const height = bottom - top;

  if (width <= 1 || height <= 1) {
    return null;
  }

  return {
    x: left,
    y: top,
    width,
    height
  };
}

export function toRelativeRect(rect: NormalizedRect, bounds: Rectangle): NormalizedRect {
  return {
    x: rect.x - bounds.x,
    y: rect.y - bounds.y,
    width: rect.width,
    height: rect.height
  };
}
