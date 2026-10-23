// Sagging clotheslines and wooden clothespins.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { V3 } from "../core/layout.ts";

export interface Sag {
  readonly from: V3;
  readonly to: V3;
  readonly sag: number;
}

/**
 * Point on the line at t ∈ [0, 1]. A parabola is indistinguishable from a catenary at these
 * sag/span ratios and is cheap and exact at the ends.
 */
export function sagPoint(line: Sag, t: number, out = new THREE.Vector3()): THREE.Vector3 {
  const [ax, ay, az] = line.from;
  const [bx, by, bz] = line.to;
  return out.set(ax + (bx - ax) * t, ay + (by - ay) * t - 4 * line.sag * t * (1 - t), az + (bz - az) * t);
}

export function lineLength(line: Sag): number {
  const a = new THREE.Vector3(...line.from);
  const b = new THREE.Vector3(...line.to);
  return a.distanceTo(b);
}

/** Horizontal unit direction from `from` to `to`. */
export function lineDir(line: Sag, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(line.to[0] - line.from[0], 0, line.to[2] - line.from[2]).normalize();
}

const ROPE_RADIUS = 0.011;

/** All lines merged into one cotton-rope mesh, one draw call. */
export function buildLines(lines: readonly Sag[]): THREE.Mesh {
  const geos = lines.map((line) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) pts.push(sagPoint(line, i / 24));
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, 48, ROPE_RADIUS, 5, false);
  });
  const geo = mergeGeometries(geos);
  geos.forEach((g) => g.dispose());
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#f3ead6", roughness: 0.95 }));
  mesh.name = "clotheslines";
  mesh.castShadow = true;
  return mesh;
}

export const PIN_WOOD = new THREE.Color("#d9a46a");

export interface PinPlacement {
  position: THREE.Vector3;
  /** Horizontal direction of the line at the pin. */
  along: THREE.Vector3;
}

/** One instanced mesh with every clothespin; colours are per instance. */
export function buildPins(placements: PinPlacement[]): THREE.InstancedMesh {
  // Two wooden jaws and a little steel spring, merged, with vertex colours so the spring stays grey.
  const jaw = new THREE.BoxGeometry(0.022, 0.085, 0.009);
  const a = jaw.clone().translate(0, -0.012, 0.0075);
  const b = jaw.clone().translate(0, -0.012, -0.0075);
  const spring = new THREE.BoxGeometry(0.026, 0.012, 0.026).translate(0, -0.004, 0);
  const paint = (g: THREE.BufferGeometry, c: THREE.Color) => {
    const n = g.getAttribute("position").count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.toArray(arr, i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    return g;
  };
  const white = new THREE.Color(1, 1, 1);
  const steel = new THREE.Color(0.55, 0.55, 0.6);
  const geo = mergeGeometries([paint(a, white), paint(b, white), paint(spring, steel)]);
  [jaw, a, b, spring].forEach((g) => g.dispose());

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, placements.length));
  mesh.name = "clothespins";
  mesh.castShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const basis = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  placements.forEach((p, i) => {
    side.crossVectors(p.along, up).normalize();
    basis.makeBasis(p.along, up, side);
    q.setFromRotationMatrix(basis);
    // A tiny random tilt: pins are never perfectly straight.
    q.multiply(new THREE.Quaternion().setFromAxisAngle(side.set(0, 0, 1), Math.sin(i * 12.9898) * 0.12));
    m.compose(p.position, q, one);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, PIN_WOOD);
  });
  mesh.count = placements.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}
