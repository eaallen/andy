import type { Point } from "./terminals";

/** Spline tension for wire polylines (0 = sharp corners, higher = curvier). */
export const WIRE_TENSION = 0.4;

/**
 * Konva tension control points for an interior vertex (matches Konva.Line).
 */
export function tensionControlPoints(
  prev: Point,
  curr: Point,
  next: Point,
  tension: number,
): [Point, Point] {
  const d01 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
  const d12 = Math.hypot(next.x - curr.x, next.y - curr.y);
  const denom = d01 + d12;
  if (denom === 0) return [curr, curr];
  const fa = (tension * d01) / denom;
  const fb = (tension * d12) / denom;
  return [
    {
      x: curr.x - fa * (next.x - prev.x),
      y: curr.y - fa * (next.y - prev.y),
    },
    {
      x: curr.x + fb * (next.x - prev.x),
      y: curr.y + fb * (next.y - prev.y),
    },
  ];
}

/**
 * Point on a quadratic bezier at t ∈ [0, 1].
 */
export function quadBezierPoint(p0: Point, p1: Point, p2: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

/**
 * Point on a cubic bezier at t ∈ [0, 1].
 */
export function cubicBezierPoint(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x:
      mt2 * mt * p0.x +
      3 * mt2 * t * p1.x +
      3 * mt * t2 * p2.x +
      t2 * t * p3.x,
    y:
      mt2 * mt * p0.y +
      3 * mt2 * t * p1.y +
      3 * mt * t2 * p2.y +
      t2 * t * p3.y,
  };
}

/**
 * Midpoint handle positions along the same tensioned path Konva draws.
 */
export function wireSegmentMidpoints(verts: Point[], tension: number): Point[] {
  if (verts.length < 2) return [];

  if (tension === 0 || verts.length === 2) {
    return verts.slice(0, -1).map((start, i) => ({
      x: (start.x + verts[i + 1].x) / 2,
      y: (start.y + verts[i + 1].y) / 2,
    }));
  }

  const incoming: Point[] = [];
  const outgoing: Point[] = [];
  for (let i = 1; i < verts.length - 1; i += 1) {
    const [into, outOf] = tensionControlPoints(
      verts[i - 1],
      verts[i],
      verts[i + 1],
      tension,
    );
    incoming.push(into);
    outgoing.push(outOf);
  }

  const mids: Point[] = [];
  mids.push(quadBezierPoint(verts[0], incoming[0], verts[1], 0.5));

  for (let i = 1; i < verts.length - 2; i += 1) {
    mids.push(
      cubicBezierPoint(
        verts[i],
        outgoing[i - 1],
        incoming[i],
        verts[i + 1],
        0.5,
      ),
    );
  }

  const last = verts.length - 1;
  mids.push(
    quadBezierPoint(
      verts[last - 1],
      outgoing[outgoing.length - 1],
      verts[last],
      0.5,
    ),
  );
  return mids;
}
