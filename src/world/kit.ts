// Procedural modelling kit: a Batch collects primitives (with baked vertex colours and transforms)
// and merges them into a single mesh, so a whole category of static props costs one draw call.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type Col = THREE.ColorRepresentation;
export type Vec = [number, number, number];

export interface Place {
  p?: Vec;
  /** Euler XYZ, radians. */
  r?: Vec;
  s?: Vec | number;
}

/** Small deterministic PRNG so the yard looks the same on every visit. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export function placeMatrix(place: Place | undefined, out = new THREE.Matrix4()): THREE.Matrix4 {
  if (!place) return out.identity();
  const p = place.p ?? [0, 0, 0];
  const r = place.r ?? [0, 0, 0];
  const s = place.s ?? 1;
  _q.setFromEuler(_e.set(r[0], r[1], r[2]));
  if (typeof s === "number") _s.set(s, s, s);
  else _s.set(s[0], s[1], s[2]);
  return out.compose(_v.set(p[0], p[1], p[2]), _q, _s);
}

/** Ensure non-indexed position/normal/color only, so everything merges. */
function normalise(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) {
    if (name !== "position" && name !== "normal" && name !== "color") g.deleteAttribute(name);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

/** Fill (or tint) per-vertex colours with a per-triangle brightness jitter: the low-poly "hand-painted" look. */
function paint(g: THREE.BufferGeometry, color: Col | null, jitter: number, rand: () => number): void {
  const n = g.attributes.position.count;
  let col = g.attributes.color as THREE.BufferAttribute | undefined;
  if (!col) {
    col = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    g.setAttribute("color", col);
    _c.set(color ?? 0xffffff);
    for (let i = 0; i < n; i++) col.setXYZ(i, _c.r, _c.g, _c.b);
  } else if (color != null) {
    _c.set(color);
    for (let i = 0; i < n; i++) col.setXYZ(i, col.getX(i) * _c.r, col.getY(i) * _c.g, col.getZ(i) * _c.b);
  }
  if (jitter > 0) {
    for (let i = 0; i < n; i += 3) {
      const k = 1 + (rand() - 0.5) * 2 * jitter;
      for (let j = i; j < i + 3 && j < n; j++) col.setXYZ(j, col.getX(j) * k, col.getY(j) * k, col.getZ(j) * k);
    }
  }
}

/** A stack of local frames. Batches can share one so props in several materials are placed together. */
export class Frames {
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()];

  get top(): THREE.Matrix4 {
    return this.stack[this.stack.length - 1];
  }

  push(place: Place): this {
    this.stack.push(this.top.clone().multiply(placeMatrix(place, _m)));
    return this;
  }

  pop(): this {
    if (this.stack.length > 1) this.stack.pop();
    return this;
  }

  /** Run `fn` inside a local frame. */
  at(place: Place, fn: () => void): this {
    this.push(place);
    try {
      fn();
    } finally {
      this.pop();
    }
    return this;
  }

  /** Transform a local point into the current frame's parent space (world, for shared frames). */
  point(p: Vec): Vec {
    _v.set(p[0], p[1], p[2]).applyMatrix4(this.top);
    return [_v.x, _v.y, _v.z];
  }
}

export class Batch {
  readonly parts: THREE.BufferGeometry[] = [];
  readonly frames: Frames;
  private rand: () => number;
  jitter: number;

  constructor(seed = 1, jitter = 0.035, frames = new Frames()) {
    this.rand = rng(seed);
    this.jitter = jitter;
    this.frames = frames;
  }

  get frame(): THREE.Matrix4 {
    return this.frames.top;
  }

  push(place: Place): this {
    this.frames.push(place);
    return this;
  }

  pop(): this {
    this.frames.pop();
    return this;
  }

  at(place: Place, fn: () => void): this {
    this.frames.at(place, fn);
    return this;
  }

  add(geo: THREE.BufferGeometry, color: Col | null, place?: Place, jitter = this.jitter): this {
    const g = normalise(geo);
    paint(g, color, jitter, this.rand);
    g.applyMatrix4(this.frame.clone().multiply(placeMatrix(place, _m)));
    this.parts.push(g);
    return this;
  }

  box(w: number, h: number, d: number, color: Col, place?: Place, jitter?: number): this {
    return this.add(new THREE.BoxGeometry(w, h, d), color, place, jitter);
  }

  /** Box whose bottom sits at place.p (handy for anything standing on the ground). */
  boxUp(w: number, h: number, d: number, color: Col, place: Place = {}, jitter?: number): this {
    const g = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
    return this.add(g, color, place, jitter);
  }

  cyl(rTop: number, rBot: number, h: number, seg: number, color: Col, place?: Place, jitter?: number): this {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, place, jitter);
  }

  sphere(r: number, color: Col, place?: Place, detail = 1, jitter?: number): this {
    return this.add(new THREE.IcosahedronGeometry(r, detail), color, place, jitter);
  }

  /** A cylinder from point a to point b (pipes, cables, rails, legs). */
  rod(a: Vec, b: Vec, r: number, color: Col, seg = 6, jitter?: number): this {
    const g = rodGeometry(a, b, r, seg);
    return this.add(g, color, undefined, jitter);
  }

  get empty(): boolean {
    return this.parts.length === 0;
  }

  geometry(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts.length = 0;
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  build(material: THREE.Material, opts: { cast?: boolean; receive?: boolean; name?: string } = {}): THREE.Mesh {
    const mesh = new THREE.Mesh(this.empty ? new THREE.BufferGeometry() : this.geometry(), material);
    mesh.castShadow = opts.cast ?? true;
    mesh.receiveShadow = opts.receive ?? true;
    mesh.name = opts.name ?? "batch";
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
  }
}

export function rodGeometry(a: Vec, b: Vec, r: number, seg = 6): THREE.BufferGeometry {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  const dir = vb.clone().sub(va).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyQuaternion(q);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}

/** Points along a sagging line (a catenary-ish parabola), for cables and vines. */
export function sagPoints(a: Vec, b: Vec, sag: number, n: number): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t),
      a[2] + (b[2] - a[2]) * t,
    ]);
  }
  return out;
}

/** Thin tube through points: cheap cables. */
export function tube(points: Vec[], r: number, seg = 4): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, Math.max(4, points.length * 2), r, seg, false);
}

/** Lathe from a [radius, y] profile. */
export function lathe(profile: Array<[number, number]>, seg = 10): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)),
    seg,
  );
}

/** Extrude a 2D outline (in the XY plane) by `depth` along Z, centred on Z. */
export function extrude(outline: Array<[number, number]>, depth: number, bevel = 0): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 6,
  });
  g.translate(0, 0, -(depth - bevel * 2) / 2);
  return g;
}

/** Bake a whole colour gradient over a geometry by a function of its local position. */
export function vertexPaint(geo: THREE.BufferGeometry, fn: (p: THREE.Vector3, out: THREE.Color) => void): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const col = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    fn(p, c);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  g.setAttribute("color", col);
  return g;
}

/** Displace vertices by a function of their position (shared vertices move together on indexed input). */
export function deform(geo: THREE.BufferGeometry, fn: (p: THREE.Vector3) => void): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    fn(p);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}
