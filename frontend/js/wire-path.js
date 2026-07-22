/** Spline tension for wire polylines (0 = sharp corners, higher = curvier). */
export const WIRE_TENSION = 0.4;

/**
 * Konva tension control points for an interior vertex (matches Konva.Line).
 * @param {{ x: number; y: number }} prev - Previous vertex.
 * @param {{ x: number; y: number }} curr - Current vertex.
 * @param {{ x: number; y: number }} next - Next vertex.
 * @param {number} tension - Spline tension.
 */
export function tensionControlPoints(prev, curr, next, tension) {
  const d01 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
  const d12 = Math.hypot(next.x - curr.x, next.y - curr.y);
  const denom = d01 + d12;
  if (denom === 0) {
    return [curr, curr];
  }
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
 * @param {{ x: number; y: number }} p0 - Start point.
 * @param {{ x: number; y: number }} p1 - Control point.
 * @param {{ x: number; y: number }} p2 - End point.
 * @param {number} t - Parameter in [0, 1].
 */
export function quadBezierPoint(p0, p1, p2, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

/**
 * Point on a cubic bezier at t ∈ [0, 1].
 * @param {{ x: number; y: number }} p0 - Start point.
 * @param {{ x: number; y: number }} p1 - First control point.
 * @param {{ x: number; y: number }} p2 - Second control point.
 * @param {{ x: number; y: number }} p3 - End point.
 * @param {number} t - Parameter in [0, 1].
 */
export function cubicBezierPoint(p0, p1, p2, p3, t) {
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
 * @param {Array<{ x: number; y: number }>} verts - Ordered wire vertices.
 * @param {number} tension - Spline tension.
 */
export function wireSegmentMidpoints(verts, tension) {
  if (verts.length < 2) {
    return [];
  }

  if (tension === 0 || verts.length === 2) {
    const mids = [];
    for (let i = 0; i < verts.length - 1; i += 1) {
      mids.push({
        x: (verts[i].x + verts[i + 1].x) / 2,
        y: (verts[i].y + verts[i + 1].y) / 2,
      });
    }
    return mids;
  }

  const incoming = [];
  const outgoing = [];
  for (let i = 1; i < verts.length - 1; i += 1) {
    const controls = tensionControlPoints(
      verts[i - 1],
      verts[i],
      verts[i + 1],
      tension
    );
    incoming.push(controls[0]);
    outgoing.push(controls[1]);
  }

  const mids = [];
  mids.push(quadBezierPoint(verts[0], incoming[0], verts[1], 0.5));

  for (let i = 1; i < verts.length - 2; i += 1) {
    mids.push(
      cubicBezierPoint(
        verts[i],
        outgoing[i - 1],
        incoming[i],
        verts[i + 1],
        0.5
      )
    );
  }

  const last = verts.length - 1;
  mids.push(
    quadBezierPoint(
      verts[last - 1],
      outgoing[outgoing.length - 1],
      verts[last],
      0.5
    )
  );
  return mids;
}

/**
 * Squared distance from a point to a line segment.
 * @param {number} px - Point x.
 * @param {number} py - Point y.
 * @param {number} x1 - Segment start x.
 * @param {number} y1 - Segment start y.
 * @param {number} x2 - Segment end x.
 * @param {number} y2 - Segment end y.
 */
export function distToSegmentSq(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    const ex = px - x1;
    const ey = py - y1;
    return ex * ex + ey * ey;
  }
  const t = Math.max(
    0,
    Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))
  );
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const ex = px - projX;
  const ey = py - projY;
  return ex * ex + ey * ey;
}

/**
 * Finds which polyline chord segment is closest to a world point (bend insert index).
 * @param {{ x: number; y: number }} from - Start terminal position.
 * @param {Array<{ x: number; y: number }>} bends - Bend points.
 * @param {{ x: number; y: number }} to - End terminal position.
 * @param {{ x: number; y: number }} point - World point to test.
 */
export function findClosestSegmentIndex(from, bends, to, point) {
  const verts = [from].concat(bends, [to]);
  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < verts.length - 1; i += 1) {
    const a = verts[i];
    const b = verts[i + 1];
    const dist = distToSegmentSq(point.x, point.y, a.x, a.y, b.x, b.y);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}
