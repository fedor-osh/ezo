// Ground steering for cats: pick a heading close to the one we want that doesn't run into
// furniture or the yard walls. Pure 2D maths on obstacle footprints (see obstacles.ts).
import { clearance, type Bounds, type Obstacle } from "./obstacles.ts";

export interface Vec2 {
  x: number;
  z: number;
}

export interface SteerOptions {
  /** Body radius of the walker. */
  radius: number;
  /** How far ahead to look, in metres. */
  lookahead: number;
  /** Number of candidate headings sampled around the circle. */
  samples?: number;
}

const STEPS = 6;

/**
 * Distance we can travel along (dx, dz) before the walker's circle touches something,
 * capped at `lookahead`.
 */
export function freeDistance(
  obstacles: readonly Obstacle[],
  bounds: Bounds,
  pos: Vec2,
  dx: number,
  dz: number,
  radius: number,
  lookahead: number,
): number {
  for (let i = 1; i <= STEPS; i++) {
    const d = (lookahead * i) / STEPS;
    if (clearance(obstacles, bounds, pos.x + dx * d, pos.z + dz * d) < radius) return (lookahead * (i - 1)) / STEPS;
  }
  return lookahead;
}

/**
 * Return a unit heading near `desired` that keeps clear of obstacles. Samples headings around
 * the circle and scores alignment with the desired direction against how soon each one is blocked.
 */
export function steer(
  pos: Vec2,
  desired: Vec2,
  obstacles: readonly Obstacle[],
  bounds: Bounds,
  opts: SteerOptions,
): Vec2 {
  const len = Math.hypot(desired.x, desired.z);
  if (len < 1e-6) return { x: 0, z: 0 };
  const ux = desired.x / len;
  const uz = desired.z / len;

  // Fast path: the straight line is free.
  if (freeDistance(obstacles, bounds, pos, ux, uz, opts.radius, opts.lookahead) >= opts.lookahead) {
    return { x: ux, z: uz };
  }

  const n = opts.samples ?? 24;
  const base = Math.atan2(uz, ux);
  let best = { x: ux, z: uz };
  let bestScore = -Infinity;
  for (let i = 0; i < n; i++) {
    // Alternate around the desired heading so ties favour small turns.
    const k = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? 1 : -1);
    const a = base + (k * 2 * Math.PI) / n;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const free = freeDistance(obstacles, bounds, pos, dx, dz, opts.radius, opts.lookahead) / opts.lookahead;
    const align = dx * ux + dz * uz;
    const score = align + free * 2.2;
    if (score > bestScore) {
      bestScore = score;
      best = { x: dx, z: dz };
    }
  }
  return best;
}

/**
 * Desired (unsteered) direction away from threats, weighted by closeness, with a push away from
 * yard walls so a cornered cat runs along the wall rather than into it.
 */
export function fleeDesire(pos: Vec2, threats: readonly Vec2[], bounds: Bounds, wallRange = 1.5): Vec2 {
  let x = 0;
  let z = 0;
  for (const t of threats) {
    const dx = pos.x - t.x;
    const dz = pos.z - t.z;
    const d2 = Math.max(0.04, dx * dx + dz * dz);
    x += dx / d2;
    z += dz / d2;
  }
  const mag = Math.hypot(x, z);
  if (mag < 1e-9) {
    x = 1;
    z = 0;
  } else {
    x /= mag;
    z /= mag;
  }
  const wall = (d: number) => Math.max(0, 1 - d / wallRange);
  x += wall(pos.x - bounds.minX) - wall(bounds.maxX - pos.x);
  z += wall(pos.z - bounds.minZ) - wall(bounds.maxZ - pos.z);
  const m2 = Math.hypot(x, z);
  return m2 < 1e-9 ? { x: 1, z: 0 } : { x: x / m2, z: z / m2 };
}

/** Steered flee heading: away from the threats and around obstacles. */
export function fleeDirection(
  pos: Vec2,
  threats: readonly Vec2[],
  obstacles: readonly Obstacle[],
  bounds: Bounds,
  opts: SteerOptions,
): Vec2 {
  return steer(pos, fleeDesire(pos, threats, bounds), obstacles, bounds, opts);
}
