// Procedural fallen-leaf geometry: fig, grape and plane-tree outlines as radial functions,
// fanned into a slightly cupped, curled, low-poly mesh lying in the XZ plane (tip toward +Z).
import * as THREE from "three";

export interface LeafShape {
  name: "fig" | "grape" | "plane";
  lobes: Array<[angle: number, length: number]>;
  /** Angular half-width of each lobe, radians. */
  width: number;
  /** Radius between lobes (how deep the sinuses are), 0..1. */
  core: number;
  /** < 1 rounds lobes, > 1 makes them pointy. */
  sharp: number;
  teeth: number;
  teethFreq: number;
  /** Colour palette weights for this species. */
  palette: string[];
}

export const LEAF_SHAPES: LeafShape[] = [
  {
    name: "fig",
    lobes: [
      [0, 1],
      [0.95, 0.82],
      [-0.95, 0.82],
      [1.95, 0.52],
      [-1.95, 0.52],
    ],
    width: 0.52,
    core: 0.34,
    sharp: 0.55,
    teeth: 0,
    teethFreq: 0,
    palette: ["#7a7d32", "#9a8f2e", "#e8c547", "#c8862a", "#6b6a2a"],
  },
  {
    name: "grape",
    lobes: [
      [0, 1],
      [1.15, 0.88],
      [-1.15, 0.88],
      [2.2, 0.62],
      [-2.2, 0.62],
    ],
    width: 0.78,
    core: 0.62,
    sharp: 0.9,
    teeth: 0.07,
    teethFreq: 26,
    palette: ["#7d2333", "#9b2f3a", "#b4492a", "#e8c547", "#d96c2c"],
  },
  {
    name: "plane",
    lobes: [
      [0, 1],
      [1.05, 0.95],
      [-1.05, 0.95],
      [2.15, 0.5],
      [-2.15, 0.5],
    ],
    width: 0.46,
    core: 0.42,
    sharp: 1.5,
    teeth: 0.035,
    teethFreq: 15,
    palette: ["#c8862a", "#b4492a", "#d96c2c", "#8a5a2b", "#e0a33a"],
  },
];

/** Leaf radius (m) at instance scale 1. */
export const LEAF_RADIUS = 0.095;

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Outline radius (0..1) at angle θ measured from the tip (+Z), positive toward +X. */
export function outlineRadius(s: LeafShape, theta: number): number {
  // Smaller near the stem so there's a little notch where the petiole attaches.
  const stem = Math.abs(angleDiff(theta, Math.PI));
  let r = s.core * (0.45 + 0.55 * Math.min(1, stem / 0.9));
  for (const [a, len] of s.lobes) {
    const u = angleDiff(theta, a) / s.width;
    if (Math.abs(u) >= 1) continue;
    const bump = Math.pow(1 - u * u, s.sharp);
    r = Math.max(r, s.core + (len - s.core) * bump);
  }
  if (s.teeth > 0) r *= 1 - s.teeth * (0.5 + 0.5 * Math.sin(theta * s.teethFreq));
  return r;
}

/**
 * Build a leaf mesh. `segments` outline points (fewer on low quality).
 * Vertex colours: pale near the midrib, darker toward the edges, multiplied by the instance colour.
 */
export function buildLeafGeometry(s: LeafShape, segments: number, seed = 1): THREE.BufferGeometry {
  const R = LEAF_RADIUS;
  const cup = 0.09 + (seed % 3) * 0.03;
  const curlTip = 0.05 + ((seed * 7) % 5) * 0.012;
  const lift = (x: number, z: number) => {
    const rr = (x * x + z * z) / (R * R);
    // Edges curl up (cup), the midrib makes a shallow V fold, the tip curls up a little more.
    return R * (cup * rr * 0.35 + 0.06 * Math.abs(x) / R + curlTip * Math.max(0, z / R) ** 2) - R * 0.07;
  };

  const outer: THREE.Vector3[] = [];
  const inner: THREE.Vector3[] = [];
  // Palm centre sits a bit toward the stem, so the leaf body extends more toward the tip.
  const oz = -0.12 * R;
  for (let i = 0; i < segments; i++) {
    const th = (i / segments) * Math.PI * 2;
    const r = outlineRadius(s, th) * R;
    const x = Math.sin(th) * r;
    const z = Math.cos(th) * r + oz;
    outer.push(new THREE.Vector3(x, lift(x, z), z));
    const xi = x * 0.45;
    const zi = (z - oz) * 0.45 + oz;
    inner.push(new THREE.Vector3(xi, lift(xi, zi), zi));
  }
  const centre = new THREE.Vector3(0, lift(0, oz), oz);

  const pos: number[] = [];
  const col: number[] = [];
  const push = (v: THREE.Vector3, shade: number) => {
    pos.push(v.x, v.y, v.z);
    col.push(shade, shade, shade * 0.96);
  };
  const tri = (a: THREE.Vector3, sa: number, b: THREE.Vector3, sb: number, c: THREE.Vector3, sc: number) => {
    // Counter-clockwise seen from above (+Y), so the top face is the front face.
    push(a, sa);
    push(b, sb);
    push(c, sc);
  };
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    tri(centre, 1.08, inner[i], 0.98, inner[j], 0.98);
    tri(inner[i], 0.98, outer[i], 0.78, outer[j], 0.78);
    tri(inner[i], 0.98, outer[j], 0.78, inner[j], 0.98);
  }
  // Petiole: a thin sliver from the palm toward −Z.
  const st0 = new THREE.Vector3(-0.004, centre.y + 0.002, oz);
  const st1 = new THREE.Vector3(0.004, centre.y + 0.002, oz);
  const st2 = new THREE.Vector3(0.0015, centre.y + 0.012, oz - R * 0.85);
  const st3 = new THREE.Vector3(-0.0015, centre.y + 0.012, oz - R * 0.85);
  tri(st0, 0.7, st1, 0.7, st2, 0.6);
  tri(st0, 0.7, st2, 0.6, st3, 0.6);

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
