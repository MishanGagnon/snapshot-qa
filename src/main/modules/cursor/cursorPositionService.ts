import { screen } from 'electron';
import { Point } from '@main/utils/geometry';

export type CursorAnchorTarget = 'capture' | 'indicator';

export const GLOBAL_CURSOR_ANCHOR_OFFSET = {
  x: 14,
  y: -20
} as const;

export function applyCursorOffset(point: Point, offset: { x: number; y: number }): Point {
  return {
    x: point.x + offset.x,
    y: point.y + offset.y
  };
}

export function toGlobalCursorAnchor(point: Point): Point {
  return applyCursorOffset(point, GLOBAL_CURSOR_ANCHOR_OFFSET);
}

export function toCursorTargetAnchor(point: Point, target: CursorAnchorTarget): Point {
  if (target === 'capture') {
    // Capture should use raw cursor hotspot coordinates.
    return point;
  }

  return toGlobalCursorAnchor(point);
}

export class CursorPositionService {
  getRawPoint(): Point {
    return screen.getCursorScreenPoint();
  }

  getGlobalAnchorPoint(rawPoint = this.getRawPoint()): Point {
    return toGlobalCursorAnchor(rawPoint);
  }

  getTargetPoint(target: CursorAnchorTarget, rawPoint = this.getRawPoint()): Point {
    return toCursorTargetAnchor(rawPoint, target);
  }
}
