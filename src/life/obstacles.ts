// 2D (XZ-plane) footprints of the world's static colliders, used by cat steering and by leaf
// spawning. Pure: no Three.js, no Rapier, so it is cheap to unit test.
import type { ColliderSpec } from "../core/types.ts";

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type Obstacle =
  | {
      kind: "box";
      x: number;
      z: number;
      hx: number;
      hz: number;
      /** cos/sin of the rotation around Y. */
      cos: number;
      sin: number;
      bottom: number;
      top: number;
    }
  | { kind: "circle"; x: number; z: number; r: number; bottom: number; top: number };

export function obstacleFromSpec(c: ColliderSpec): Obstacle {
  const [x, y, z] = c.position;
  if (c.shape === "box") {
    const r = c.rotationY ?? 0;
    return {
      kind: "box",
      x,
      z,
      hx: c.half[0],
      hz: c.half[2],
      cos: Math.cos(r),
      sin: Math.sin(r),
      bottom: y - c.half[1],
      top: y + c.half[1],
    };
  }
  return { kind: "circle", x, z, r: c.radius, bottom: y - c.halfHeight, top: y + c.halfHeight };
}

/**
 * Obstacles a small animal walking on the ground bumps into: anything that rises above
 * `minTop` and starts below `maxBottom` (so overhangs like balconies or a pergola roof don't count).
 */
export function groundObstacles(specs: readonly ColliderSpec[], minTop = 0.12, maxBottom = 0.35): Obstacle[] {
  return specs.map(obstacleFromSpec).filter((o) => o.top > minTop && o.bottom < maxBottom);
}

/**
 * Signed distance from (px, pz) to the obstacle's footprint: negative inside.
 * Rotation convention matches Three/Rapier: a local point (lx, lz) rotated by +θ around Y
 * lands at (lx·cos + lz·sin, −lx·sin + lz·cos).
 */
export function signedDistance(o: Obstacle, px: number, pz: number): number {
  const dx = px - o.x;
  const dz = pz - o.z;
  if (o.kind === "circle") return Math.hypot(dx, dz) - o.r;
  // World → local is the inverse rotation.
  const lx = dx * o.cos - dz * o.sin;
  const lz = dx * o.sin + dz * o.cos;
  const qx = Math.abs(lx) - o.hx;
  const qz = Math.abs(lz) - o.hz;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
  return outside + Math.min(Math.max(qx, qz), 0);
}

/** Distance to the nearest wall of the bounds, negative outside. */
export function boundsDistance(b: Bounds, px: number, pz: number): number {
  return Math.min(px - b.minX, b.maxX - px, pz - b.minZ, b.maxZ - pz);
}

/** Clearance at a point: distance to the nearest obstacle footprint or yard wall. */
export function clearance(obstacles: readonly Obstacle[], bounds: Bounds, px: number, pz: number): number {
  let d = boundsDistance(bounds, px, pz);
  for (const o of obstacles) {
    const s = signedDistance(o, px, pz);
    if (s < d) d = s;
  }
  return d;
}

/** Index of the obstacle whose footprint contains the point, or -1. */
export function obstacleAt(obstacles: readonly Obstacle[], px: number, pz: number, margin = 0): number {
  for (let i = 0; i < obstacles.length; i++) if (signedDistance(obstacles[i], px, pz) < margin) return i;
  return -1;
}

/**
 * Push a circle of `radius` at (px, pz) out of every obstacle and back inside the bounds.
 * Returns the corrected position (a fresh object).
 */
export function resolvePenetration(
  obstacles: readonly Obstacle[],
  bounds: Bounds,
  px: number,
  pz: number,
  radius: number,
  ignore = -1,
): { x: number; z: number } {
  let x = px;
  let z = pz;
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (let i = 0; i < obstacles.length; i++) {
      if (i === ignore) continue;
      const o = obstacles[i];
      const d = signedDistance(o, x, z);
      if (d >= radius) continue;
      const [gx, gz] = gradient(o, x, z);
      const push = radius - d + 1e-3;
      x += gx * push;
      z += gz * push;
      moved = true;
    }
    if (!moved) break;
  }
  x = Math.min(bounds.maxX - radius, Math.max(bounds.minX + radius, x));
  z = Math.min(bounds.maxZ - radius, Math.max(bounds.minZ + radius, z));
  return { x, z };
}

/** Unit gradient of the signed distance (points away from the obstacle). */
export function gradient(o: Obstacle, px: number, pz: number): [number, number] {
  const e = 1e-3;
  const gx = signedDistance(o, px + e, pz) - signedDistance(o, px - e, pz);
  const gz = signedDistance(o, px, pz + e) - signedDistance(o, px, pz - e);
  const len = Math.hypot(gx, gz);
  if (len < 1e-9) {
    // Dead centre: push away along any direction.
    return [1, 0];
  }
  return [gx / len, gz / len];
}
