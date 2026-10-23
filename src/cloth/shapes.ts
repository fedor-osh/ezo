// Laundry silhouettes. Each shape is a polygon in surface coords (u right, v down, both 0..1)
// snapped to the particle grid, so the simulated cells, the painted stitching and the label
// all agree on where the fabric is.

export type ShapeKind = "towel" | "pillow" | "shirt" | "trousers" | "sock" | "carpet";

export interface ShapeSpec {
  kind: ShapeKind;
  cols: number;
  rows: number;
  width: number;
  height: number;
  /** Outline polygon in uv (v down). */
  outline: Array<[number, number]>;
  /** Pinned top-row columns. */
  pins: number[];
  /** Where a label patch fits: centre and max width, in uv. */
  label: { cx: number; cy: number; w: number };
}

type Raw = Omit<ShapeSpec, "cols" | "rows" | "pins" | "outline"> & {
  outline: Array<[number, number]>;
  pins: number[];
};

const RECT: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

function raw(kind: ShapeKind, width: number, height: number): Raw {
  switch (kind) {
    case "towel":
      return { kind, width, height, outline: RECT, pins: [0, 0.5, 1], label: { cx: 0.5, cy: 0.5, w: 0.8 } };
    case "pillow":
      return { kind, width, height, outline: RECT, pins: [0, 0.5, 1], label: { cx: 0.5, cy: 0.52, w: 0.74 } };
    case "carpet":
      return { kind, width, height, outline: RECT, pins: [0, 0.33, 0.67, 1], label: { cx: 0.5, cy: 0.5, w: 0.6 } };
    case "shirt":
      return {
        kind,
        width,
        height,
        // Sleeves out, body below. Hung by the shoulders.
        outline: [
          [0, 0],
          [1, 0],
          [1, 0.36],
          [0.79, 0.36],
          [0.79, 1],
          [0.21, 1],
          [0.21, 0.36],
          [0, 0.36],
        ],
        pins: [0.08, 0.92],
        label: { cx: 0.5, cy: 0.62, w: 0.52 },
      };
    case "trousers":
      return {
        kind,
        width,
        height,
        outline: [
          [0, 0],
          [1, 0],
          [1, 1],
          [0.56, 1],
          [0.56, 0.34],
          [0.44, 0.34],
          [0.44, 1],
          [0, 1],
        ],
        pins: [0, 1],
        label: { cx: 0.5, cy: 0.18, w: 0.6 },
      };
    case "sock":
      return {
        kind,
        width,
        height,
        outline: [
          [0, 0],
          [0.5, 0],
          [0.5, 0.64],
          [1, 0.64],
          [1, 1],
          [0, 1],
        ],
        pins: [0, 0.5],
        label: { cx: 0.25, cy: 0.4, w: 0.4 },
      };
  }
}

/** Build a shape on a cols × rows particle grid. */
export function makeShape(kind: ShapeKind, width: number, height: number, cols: number, rows: number): ShapeSpec {
  const r = raw(kind, width, height);
  const sx = (u: number) => Math.round(u * (cols - 1)) / (cols - 1);
  const sy = (v: number) => Math.round(v * (rows - 1)) / (rows - 1);
  return {
    ...r,
    cols,
    rows,
    outline: r.outline.map(([u, v]) => [sx(u), sy(v)] as [number, number]),
    pins: r.pins.map((u) => Math.round(u * (cols - 1))),
  };
}

/** Even-odd point-in-polygon. */
export function insidePolygon(poly: Array<[number, number]>, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Offset a simple polygon inward by `d` (same units as the points), mitred corners. */
export function insetPolygon(poly: Array<[number, number]>, d: number): Array<[number, number]> {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    area += x1 * y2 - x2 * y1;
  }
  const sign = area > 0 ? 1 : -1;
  const n = poly.length;
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const p0 = poly[(i + n - 1) % n];
    const p1 = poly[i];
    const p2 = poly[(i + 1) % n];
    const n1 = inward(p0, p1, sign);
    const n2 = inward(p1, p2, sign);
    const bx = n1[0] + n2[0];
    const by = n1[1] + n2[1];
    const dot = n1[0] * n2[0] + n1[1] * n2[1];
    // Miter: offset = d (n1 + n2) / (1 + n1·n2); clamped so sharp spikes stay finite.
    const s = d / Math.max(0.3, 1 + dot);
    out.push([p1[0] + bx * s, p1[1] + by * s]);
  }
  return out;
}

function inward(a: [number, number], b: [number, number], sign: number): [number, number] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  // Left normal of each edge, flipped by the winding so it always points inside.
  return [(-dy / l) * sign, (dx / l) * sign];
}
