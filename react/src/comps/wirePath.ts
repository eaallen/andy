import type { Point } from "./terminals";

/** Spline tension for wire polylines (0 = sharp corners, higher = curvier). */
export const WIRE_TENSION = 0.4;

/** Semicircle radius (world px) drawn where one wire crosses over another. */
export const WIRE_JUMP_RADIUS = 10;

/** Approximate spacing between samples along a tensioned wire. */
const SAMPLE_SPACING = 4;

/** Ignore crossings this close to either wire's terminals. */
const ENDPOINT_PAD = 14;

/** Merge jump sites closer than this along the over wire. */
const JUMP_MERGE_PAD = WIRE_JUMP_RADIUS * 2.2;

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
 * Builds tension control handles for every interior vertex.
 */
function interiorControls(verts: Point[], tension: number) {
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
  return { incoming, outgoing };
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

  const { incoming, outgoing } = interiorControls(verts, tension);
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

/**
 * Appends evenly spaced samples of a parametric curve (excluding the start).
 */
function appendCurveSamples(
  at: (t: number) => Point,
  approxLen: number,
  spacing: number,
  out: Point[],
) {
  const steps = Math.max(1, Math.ceil(approxLen / spacing));
  for (let i = 1; i <= steps; i += 1) {
    out.push(at(i / steps));
  }
}

/**
 * Samples a tensioned wire into a dense polyline matching Konva.Line.
 */
export function sampleTensionedWire(
  verts: Point[],
  tension: number,
  spacing: number = SAMPLE_SPACING,
): Point[] {
  if (verts.length < 2) return verts.map((p) => ({ x: p.x, y: p.y }));
  if (tension === 0 || verts.length === 2) {
    const out: Point[] = [{ x: verts[0].x, y: verts[0].y }];
    for (let i = 0; i < verts.length - 1; i += 1) {
      const a = verts[i];
      const b = verts[i + 1];
      appendCurveSamples(
        (t) => ({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
        }),
        Math.hypot(b.x - a.x, b.y - a.y),
        spacing,
        out,
      );
    }
    return out;
  }

  const { incoming, outgoing } = interiorControls(verts, tension);
  const out: Point[] = [{ x: verts[0].x, y: verts[0].y }];

  appendCurveSamples(
    (t) => quadBezierPoint(verts[0], incoming[0], verts[1], t),
    Math.hypot(verts[1].x - verts[0].x, verts[1].y - verts[0].y),
    spacing,
    out,
  );

  for (let i = 1; i < verts.length - 2; i += 1) {
    const a = verts[i];
    const b = verts[i + 1];
    appendCurveSamples(
      (t) => cubicBezierPoint(a, outgoing[i - 1], incoming[i], b, t),
      Math.hypot(b.x - a.x, b.y - a.y),
      spacing,
      out,
    );
  }

  const last = verts.length - 1;
  appendCurveSamples(
    (t) =>
      quadBezierPoint(
        verts[last - 1],
        outgoing[outgoing.length - 1],
        verts[last],
        t,
      ),
    Math.hypot(
      verts[last].x - verts[last - 1].x,
      verts[last].y - verts[last - 1].y,
    ),
    spacing,
    out,
  );
  return out;
}

/**
 * Cumulative distances along a polyline (same length as points).
 */
function cumulativeLengths(points: Point[]): number[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    lengths.push(
      lengths[i - 1] + Math.hypot(curr.x - prev.x, curr.y - prev.y),
    );
  }
  return lengths;
}

/**
 * Point and unit tangent at a distance along a polyline.
 */
function pointAndTangentAt(
  points: Point[],
  lengths: number[],
  dist: number,
): { point: Point; tx: number; ty: number } {
  const total = lengths[lengths.length - 1] ?? 0;
  const clamped = Math.max(0, Math.min(total, dist));
  if (points.length < 2 || total === 0) {
    const p = points[0] ?? { x: 0, y: 0 };
    return { point: { x: p.x, y: p.y }, tx: 1, ty: 0 };
  }

  let i = 0;
  while (i < lengths.length - 2 && lengths[i + 1] < clamped) {
    i += 1;
  }
  const a = points[i];
  const b = points[i + 1];
  const segLen = lengths[i + 1] - lengths[i];
  const t = segLen === 0 ? 0 : (clamped - lengths[i]) / segLen;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  return {
    point: { x: a.x + dx * t, y: a.y + dy * t },
    tx: len === 0 ? 1 : dx / len,
    ty: len === 0 ? 0 : dy / len,
  };
}

/**
 * Intersection of segments AB and CD, or null if they do not cross.
 */
export function segmentIntersection(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): Point | null {
  const ax = b.x - a.x;
  const ay = b.y - a.y;
  const bx = d.x - c.x;
  const by = d.y - c.y;
  const denom = ax * by - ay * bx;
  if (Math.abs(denom) < 1e-9) return null;

  const cx = c.x - a.x;
  const cy = c.y - a.y;
  const t = (cx * by - cy * bx) / denom;
  const u = (cx * ay - cy * ax) / denom;
  // Strict interior — endpoint touches are junctions / shared samples, not jumps.
  if (t <= 0.02 || t >= 0.98 || u <= 0.02 || u >= 0.98) return null;
  return { x: a.x + t * ax, y: a.y + t * ay };
}

/**
 * Distance along a polyline to the sample nearest a world point.
 */
function nearestAlong(
  points: Point[],
  lengths: number[],
  target: Point,
): number {
  let bestDist = Infinity;
  let bestAlong = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLenSq = dx * dx + dy * dy;
    let t = 0;
    if (segLenSq > 0) {
      t = Math.max(
        0,
        Math.min(1, ((target.x - a.x) * dx + (target.y - a.y) * dy) / segLenSq),
      );
    }
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const dist = Math.hypot(target.x - px, target.y - py);
    if (dist < bestDist) {
      bestDist = dist;
      bestAlong = lengths[i] + Math.sqrt(segLenSq) * t;
    }
  }
  return bestAlong;
}

export type WireJumpSite = {
  x: number;
  y: number;
  /** Unit tangent along the over wire at the crossing. */
  tx: number;
  ty: number;
  /** Distance along the over wire from its start. */
  along: number;
};

type SampledPath = {
  id: string;
  points: Point[];
  lengths: number[];
};

/**
 * Finds jump sites where later wires cross over earlier ones.
 * @param {Array<{ id: string; verts: Point[] }>} wires - Wires in draw order (later = over).
 */
export function findWireJumpSites(
  wires: Array<{ id: string; verts: Point[] }>,
  tension: number,
  jumpRadius: number = WIRE_JUMP_RADIUS,
): Map<string, WireJumpSite[]> {
  const sampled: SampledPath[] = wires.map((wire) => {
    const points = sampleTensionedWire(wire.verts, tension);
    return { id: wire.id, points, lengths: cumulativeLengths(points) };
  });

  const jumpsByWire = new Map<string, WireJumpSite[]>();

  for (let overIdx = 1; overIdx < sampled.length; overIdx += 1) {
    const over = sampled[overIdx];
    const overTotal = over.lengths[over.lengths.length - 1] ?? 0;
    if (overTotal < jumpRadius * 2 + ENDPOINT_PAD) continue;

    for (let underIdx = 0; underIdx < overIdx; underIdx += 1) {
      const under = sampled[underIdx];
      const underTotal = under.lengths[under.lengths.length - 1] ?? 0;
      if (underTotal < ENDPOINT_PAD) continue;

      for (let i = 0; i < over.points.length - 1; i += 1) {
        const a = over.points[i];
        const b = over.points[i + 1];
        for (let j = 0; j < under.points.length - 1; j += 1) {
          const hit = segmentIntersection(
            a,
            b,
            under.points[j],
            under.points[j + 1],
          );
          if (!hit) continue;

          const along = nearestAlong(over.points, over.lengths, hit);
          if (along < ENDPOINT_PAD || along > overTotal - ENDPOINT_PAD) {
            continue;
          }
          const underAlong = nearestAlong(under.points, under.lengths, hit);
          if (
            underAlong < ENDPOINT_PAD ||
            underAlong > underTotal - ENDPOINT_PAD
          ) {
            continue;
          }

          const { tx, ty } = pointAndTangentAt(over.points, over.lengths, along);
          const list = jumpsByWire.get(over.id) ?? [];
          list.push({ x: hit.x, y: hit.y, tx, ty, along });
          jumpsByWire.set(over.id, list);
        }
      }
    }
  }

  for (const [id, sites] of jumpsByWire) {
    sites.sort((a, b) => a.along - b.along);
    const merged: WireJumpSite[] = [];
    for (const site of sites) {
      const prev = merged[merged.length - 1];
      if (prev && site.along - prev.along < JUMP_MERGE_PAD) continue;
      merged.push(site);
    }
    jumpsByWire.set(id, merged);
  }

  return jumpsByWire;
}

/**
 * Builds flat Konva points for a tensioned wire, with semicircle jumps at crossings.
 */
export function wirePointsWithJumps(
  verts: Point[],
  tension: number,
  jumps: WireJumpSite[],
  jumpRadius: number = WIRE_JUMP_RADIUS,
): number[] {
  const samples = sampleTensionedWire(verts, tension);
  if (samples.length === 0) return [];
  if (jumps.length === 0) {
    return samples.flatMap((p) => [p.x, p.y]);
  }

  const lengths = cumulativeLengths(samples);
  const total = lengths[lengths.length - 1] ?? 0;
  const usable = jumps
    .filter(
      (j) =>
        j.along >= jumpRadius + 1 && j.along <= total - jumpRadius - 1,
    )
    .sort((a, b) => a.along - b.along);

  if (usable.length === 0) {
    return samples.flatMap((p) => [p.x, p.y]);
  }

  const out: number[] = [];
  let sampleIdx = 0;

  const emitSampleRange = (untilAlong: number) => {
    while (
      sampleIdx < samples.length - 1 &&
      lengths[sampleIdx + 1] <= untilAlong + 1e-6
    ) {
      sampleIdx += 1;
      out.push(samples[sampleIdx].x, samples[sampleIdx].y);
    }
  };

  out.push(samples[0].x, samples[0].y);

  for (const jump of usable) {
    const gapStart = jump.along - jumpRadius;
    const gapEnd = jump.along + jumpRadius;

    emitSampleRange(gapStart);
    const start = pointAndTangentAt(samples, lengths, gapStart).point;
    out.push(start.x, start.y);

    const nx = -jump.ty;
    const ny = jump.tx;
    const arcSteps = 10;
    for (let s = 1; s < arcSteps; s += 1) {
      const angle = Math.PI * (1 - s / arcSteps);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      out.push(
        jump.x + jumpRadius * (cos * jump.tx + sin * nx),
        jump.y + jumpRadius * (cos * jump.ty + sin * ny),
      );
    }

    const end = pointAndTangentAt(samples, lengths, gapEnd).point;
    out.push(end.x, end.y);

    while (sampleIdx < samples.length - 1 && lengths[sampleIdx] < gapEnd) {
      sampleIdx += 1;
    }
  }

  for (let i = sampleIdx + 1; i < samples.length; i += 1) {
    out.push(samples[i].x, samples[i].y);
  }
  return out;
}
