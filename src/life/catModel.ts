// Low-poly cat rig built from primitives. Each rigid part is one merged, vertex-coloured mesh so a
// cat costs ~15 draw calls. Local frame: forward +Z, up +Y, origin on the ground under the hips.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface Coat {
  name: string;
  base: string;
  light: string;
  dark: string;
  eye: string;
  /** Where the light colour goes. */
  pattern: "tabby" | "tuxedo";
}

export const COATS: Coat[] = [
  { name: "ginger", base: "#e8893a", light: "#f7d6a8", dark: "#c4621f", eye: "#8fc23a", pattern: "tabby" },
  { name: "tuxedo", base: "#26262b", light: "#f4f1ea", dark: "#141417", eye: "#e8c13a", pattern: "tuxedo" },
  { name: "tabby", base: "#8f8d92", light: "#dad6cf", dark: "#5a5960", eye: "#d9a640", pattern: "tabby" },
];

/** Everything the controller animates, blended toward targets each frame. */
export interface CatPose {
  /** Height of the hip pivot. */
  bodyY: number;
  /** Nose-up body pitch (sitting). */
  pitch: number;
  /** 0 = legs out, 1 = tucked under the body (loaf/curl). */
  tuck: number;
  /** 0 = rear legs standing, 1 = folded under the haunches (sitting). */
  sit: number;
  /** Raised front paw (grooming), 0..1. */
  paw: number;
  headPitch: number;
  headYaw: number;
  /** 0..1 ears flattened back. */
  ears: number;
  /** Tail base lift (rad). */
  tailLift: number;
  /** Extra curl per segment (rad). */
  tailCurl: number;
  /** Sideways wrap per segment (rad), for curled-up sleeping. */
  tailWrap: number;
  /** 0..1 bottle-brush tail. */
  puff: number;
  /** 0 = eyes closed, 1 = open. */
  eyes: number;
  /** Leg swing amplitude (rad). */
  stride: number;
}

export function restingPose(): CatPose {
  return {
    bodyY: 0.17,
    pitch: 0,
    tuck: 0,
    sit: 0,
    paw: 0,
    headPitch: 0,
    headYaw: 0,
    ears: 0,
    tailLift: 0.5,
    tailCurl: 0.15,
    tailWrap: 0,
    puff: 0,
    eyes: 1,
    stride: 0,
  };
}

export interface CatRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  ears: [THREE.Object3D, THREE.Object3D];
  eyes: THREE.Object3D;
  /** Front-left, front-right, rear-left, rear-right. */
  legs: THREE.Object3D[];
  tail: THREE.Object3D[];
}

const LEG_LEN = 0.17;
const FRONT_Z = 0.25;
const TAIL_SEG = 0.055;

function colored(g: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.deleteAttribute("uv");
  const c = new THREE.Color(color);
  const n = ng.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  ng.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return ng;
}

function blob(r: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return g;
}

function merged(parts: Array<[THREE.BufferGeometry, string]>): THREE.BufferGeometry {
  const g = mergeGeometries(parts.map(([geo, c]) => colored(geo, c)));
  if (!g) throw new Error("cat: merge failed");
  g.computeVertexNormals();
  return g;
}

export function buildCat(coat: Coat, material: THREE.Material, shadows: boolean): CatRig {
  const mesh = (g: THREE.BufferGeometry) => {
    const m = new THREE.Mesh(g, material);
    m.castShadow = shadows;
    return m;
  };
  const tux = coat.pattern === "tuxedo";

  const root = new THREE.Group();
  root.name = `cat-${coat.name}`;

  // Body: pivot at the hips, ellipsoid extends forward.
  const body = new THREE.Group();
  root.add(body);
  const bodyParts: Array<[THREE.BufferGeometry, string]> = [[blob(0.12, 1, 0.92, 2.05, 0, 0.0, 0.12), coat.base]];
  if (tux) {
    bodyParts.push([blob(0.085, 1.05, 1, 1.4, 0, -0.035, 0.2), coat.light]);
  } else {
    // Tabby bands: thin rings slightly larger than the body cross-section.
    for (const dz of [-0.06, 0.01, 0.08, 0.15]) {
      const k = Math.sqrt(Math.max(0, 1 - (dz / 0.246) ** 2));
      bodyParts.push([blob(0.12, 1.04 * k, 0.96 * k, 0.12, 0, 0.004, 0.12 + dz, 1), coat.dark]);
    }
    bodyParts.push([blob(0.08, 1, 0.8, 1.6, 0, -0.045, 0.14), coat.light]);
  }
  body.add(mesh(merged(bodyParts)));

  // Head on a neck pivot at the front of the body.
  const head = new THREE.Group();
  head.position.set(0, 0.09, FRONT_Z + 0.07);
  body.add(head);
  const headParts: Array<[THREE.BufferGeometry, string]> = [
    [blob(0.095, 1.1, 0.92, 0.95, 0, 0, 0), coat.base],
    [blob(0.045, 1.25, 0.8, 0.9, 0, -0.03, 0.07), tux ? coat.light : coat.light],
    [blob(0.014, 1.2, 0.8, 0.8, 0, -0.012, 0.11, 0), "#e58c9b"],
  ];
  if (!tux) {
    headParts.push([blob(0.03, 1.6, 0.35, 1, 0, 0.075, 0.02, 0), coat.dark]);
  } else {
    headParts.push([blob(0.04, 0.8, 1.4, 0.7, 0, 0.0, 0.075, 0), coat.light]);
  }
  head.add(mesh(merged(headParts)));

  const ear = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.055, 0.06, -0.005);
    pivot.rotation.z = -side * 0.28;
    const outer = new THREE.ConeGeometry(0.036, 0.075, 4);
    outer.translate(0, 0.035, 0);
    const inner = new THREE.ConeGeometry(0.022, 0.05, 4);
    inner.translate(0, 0.028, 0.012);
    pivot.add(mesh(merged([
      [outer, coat.base],
      [inner, "#e8a3ad"],
    ])));
    head.add(pivot);
    return pivot;
  };
  const ears: [THREE.Object3D, THREE.Object3D] = [ear(-1), ear(1)];

  const eyes = new THREE.Group();
  eyes.position.set(0, 0.012, 0.072);
  const eyeParts: Array<[THREE.BufferGeometry, string]> = [];
  for (const s of [-1, 1]) {
    eyeParts.push([blob(0.021, 1, 1.1, 0.6, s * 0.04, 0, 0, 1), coat.eye]);
    eyeParts.push([blob(0.011, 0.6, 1.2, 0.6, s * 0.04, 0, 0.011, 0), "#111114"]);
    eyeParts.push([blob(0.004, 1, 1, 1, s * 0.044, 0.007, 0.016, 0), "#ffffff"]);
  }
  eyes.add(mesh(merged(eyeParts)));
  head.add(eyes);

  // Legs: pivots at shoulders/hips, cylinders hanging down to a paw.
  const legs: THREE.Object3D[] = [];
  for (const [z, x] of [
    [FRONT_Z - 0.02, -1],
    [FRONT_Z - 0.02, 1],
    [0.02, -1],
    [0.02, 1],
  ] as const) {
    const pivot = new THREE.Group();
    pivot.position.set(x * 0.062, -0.02, z);
    const leg = new THREE.CylinderGeometry(0.028, 0.022, LEG_LEN, 6);
    leg.translate(0, -LEG_LEN / 2, 0);
    const paw = blob(0.027, 1, 0.65, 1.25, 0, -LEG_LEN + 0.004, 0.008, 0);
    pivot.add(mesh(merged([
      [leg, coat.base],
      [paw, tux ? coat.light : coat.base],
    ])));
    body.add(pivot);
    legs.push(pivot);
  }

  // Tail: a chain of segments, each parented to the previous, pointing back (−Z).
  const tail: THREE.Object3D[] = [];
  let parent: THREE.Object3D = body;
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i === 0 ? 0.04 : 0, i === 0 ? -0.1 : -TAIL_SEG);
    const r = 0.024 - i * 0.0018;
    const g = new THREE.CylinderGeometry(r, r * 1.05, TAIL_SEG * 1.15, 5);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, -TAIL_SEG / 2);
    const tip = i === segs - 1;
    const color = tip && tux ? coat.light : !tux && i % 2 === 1 ? coat.dark : coat.base;
    const parts: Array<[THREE.BufferGeometry, string]> = [[g, color]];
    if (tip) parts.push([blob(r * 1.1, 1, 1, 1.3, 0, 0, -TAIL_SEG, 0), color]);
    seg.add(mesh(merged(parts)));
    parent.add(seg);
    tail.push(seg);
    parent = seg;
  }

  return { root, body, head, ears, eyes, legs, tail };
}

/** Write a pose into the rig. `phase` is the gait phase (rad), `t` time for idle wiggles. */
export function applyPose(rig: CatRig, p: CatPose, phase: number, t: number, running: boolean): void {
  rig.body.position.y = p.bodyY;
  rig.body.rotation.x = -p.pitch;

  // Head counters part of the body pitch so it stays level-ish.
  rig.head.rotation.set(p.headPitch + p.pitch * 0.8, p.headYaw, 0, "YXZ");

  for (let s = 0; s < 2; s++) {
    const e = rig.ears[s];
    const side = s === 0 ? -1 : 1;
    e.rotation.x = -p.ears * 0.9;
    e.rotation.z = -side * (0.28 + p.ears * 0.9);
  }
  rig.eyes.scale.y = Math.max(0.08, p.eyes);

  // Gait: trot (diagonal pairs) when walking, bound (front pair, rear pair) when running.
  const sw = (off: number) => Math.sin(phase + off) * p.stride;
  const offs = running ? [0, 0.35, Math.PI, Math.PI + 0.35] : [0, Math.PI, Math.PI, 0];
  const shoulderY = p.bodyY + Math.sin(p.pitch) * (FRONT_Z - 0.02) - 0.02;
  const frontScale = THREE.MathUtils.clamp(shoulderY / LEG_LEN, 0.3, 1.25);
  for (let i = 0; i < 4; i++) {
    const leg = rig.legs[i];
    const front = i < 2;
    let rx = p.pitch + sw(offs[i]);
    let sy = front ? frontScale : 1;
    if (!front) {
      // Sitting folds the rear legs forward under the haunches.
      rx += -p.sit * 1.25;
      sy *= 1 - p.sit * 0.35;
    } else if (i === 1 && p.paw > 0) {
      rx -= p.paw * (1.7 + Math.sin(t * 9) * 0.2);
    }
    sy *= 1 - p.tuck * 0.75;
    leg.rotation.x = rx;
    leg.scale.y = Math.max(0.15, sy);
  }

  const n = rig.tail.length;
  for (let i = 0; i < n; i++) {
    const seg = rig.tail[i];
    const k = i / (n - 1);
    const sway = Math.sin(t * (running ? 9 : 1.6) - i * 0.7) * (0.12 + k * 0.18) * (1 - p.tailWrap * 0.8);
    seg.rotation.set(i === 0 ? p.tailLift : p.tailCurl, sway + (i === 0 ? 0 : p.tailWrap), 0);
    const puff = 1 + p.puff * (0.9 + k * 0.4);
    seg.scale.set(puff, puff, 1);
  }
}
