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

export interface Size {
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

export function toDisplayPixelSize(bounds: Rectangle, scaleFactor: number): Size {
  const safeScaleFactor = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;

  return {
    width: Math.max(1, Math.round(bounds.width * safeScaleFactor)),
    height: Math.max(1, Math.round(bounds.height * safeScaleFactor))
  };
}

export function toScaledRelativeRect(
  rect: NormalizedRect,
  bounds: Rectangle,
  scaleFactor: number,
  displaySizePx: Size
): NormalizedRect {
  const safeScaleFactor = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
  const fallbackDisplaySizePx = toDisplayPixelSize(bounds, safeScaleFactor);
  const widthPx = Math.max(1, Math.round(displaySizePx.width || fallbackDisplaySizePx.width));
  const heightPx = Math.max(1, Math.round(displaySizePx.height || fallbackDisplaySizePx.height));

  const localLeftDip = rect.x - bounds.x;
  const localTopDip = rect.y - bounds.y;
  const localRightDip = localLeftDip + rect.width;
  const localBottomDip = localTopDip + rect.height;

  const leftPx = clamp(Math.round(localLeftDip * safeScaleFactor), 0, widthPx);
  const topPx = clamp(Math.round(localTopDip * safeScaleFactor), 0, heightPx);
  const rightPx = clamp(Math.round(localRightDip * safeScaleFactor), 0, widthPx);
  const bottomPx = clamp(Math.round(localBottomDip * safeScaleFactor), 0, heightPx);

  const pxToDipX = bounds.width / widthPx;
  const pxToDipY = bounds.height / heightPx;

  return {
    x: leftPx * pxToDipX,
    y: topPx * pxToDipY,
    width: Math.max(0, (rightPx - leftPx) * pxToDipX),
    height: Math.max(0, (bottomPx - topPx) * pxToDipY)
  };
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}
