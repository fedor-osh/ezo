// The cat's mind: a small state machine with no Three.js/Rapier in it, so it is unit-testable.
// The controller in cats.ts reads `mode` / `spot` / `threat` and turns them into motion and poses.

export type CatMode =
  /** Curled up or loafing on a spot. */
  | "rest"
  | "groom"
  /** Sitting upright, watching the yard. */
  | "sit"
  /** Strolling to `spot`. */
  | "walk"
  /** A split second of fright: ears back, tail puffed, crouch. */
  | "flinch"
  /** Sprinting away from `threat` toward the safe `spot`. */
  | "flee"
  /** Sitting in the safe spot, slowly calming down. */
  | "recover";

export interface Spot {
  x: number;
  z: number;
  /** Height of the surface the cat rests on (0 = ground). */
  y: number;
  elevated: boolean;
  /** Nice for a nap (sun patch, warm oven, car roof). */
  cosy: boolean;
}

export interface ThreatPoint {
  x: number;
  y: number;
  z: number;
}

export interface CatBrain {
  mode: CatMode;
  /** Seconds left in the current mode (for timed modes). */
  timer: number;
  /** Seconds since entering the current mode. */
  elapsed: number;
  /** Target spot while walking/fleeing, current spot while resting. -1 = none. */
  spot: number;
  /** Last seen scary thing (XZ). */
  threat: { x: number; z: number } | null;
  /** 0 = calm, 1 = terrified. Drives ears/tail puff in the controller. */
  fear: number;
  /** Which resting pose: curled into a ball, or a tucked-paws loaf. */
  restPose: "curl" | "loaf";
}

export interface CatSense {
  x: number;
  z: number;
  flyers: readonly ThreatPoint[];
  spots: readonly Spot[];
  /** Spots other cats are using or heading to. */
  occupied?: readonly number[];
  /** Has the controller reached `spot`? */
  atTarget: boolean;
  reducedMotion: boolean;
  rng: () => number;
}

/** A flyer this close (horizontally) and this low scares a cat. */
export const SCARE_RADIUS = 2.2;
export const SCARE_HEIGHT = 2;
/** The cat only relaxes once threats are further than this. */
export const SAFE_RADIUS = 3.6;

export function createBrain(spot = -1, rng: () => number = Math.random): CatBrain {
  return {
    mode: "rest",
    timer: 4 + rng() * 10,
    elapsed: 0,
    spot,
    threat: null,
    fear: 0,
    restPose: rng() < 0.5 ? "curl" : "loaf",
  };
}

/** Nearest flyer within `radius` horizontally and below SCARE_HEIGHT, or null. */
export function nearestThreat(
  x: number,
  z: number,
  flyers: readonly ThreatPoint[],
  radius = SCARE_RADIUS,
): { x: number; z: number; d: number } | null {
  let best: { x: number; z: number; d: number } | null = null;
  for (const f of flyers) {
    if (f.y > SCARE_HEIGHT) continue;
    const d = Math.hypot(f.x - x, f.z - z);
    if (d < radius && (!best || d < best.d)) best = { x: f.x, z: f.z, d };
  }
  return best;
}

/**
 * Where to run: far from the threat, not too far from us, not crossing the threat,
 * and preferably up somewhere (car roof, bench).
 */
export function pickSafeSpot(
  x: number,
  z: number,
  threat: { x: number; z: number },
  spots: readonly Spot[],
  occupied: readonly number[] = [],
): number {
  let best = -1;
  let bestScore = -Infinity;
  const ax = x - threat.x;
  const az = z - threat.z;
  const alen = Math.hypot(ax, az) || 1;
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    const fromThreat = Math.hypot(s.x - threat.x, s.z - threat.z);
    if (fromThreat < SAFE_RADIUS) continue;
    const fromCat = Math.hypot(s.x - x, s.z - z);
    // Prefer spots on our side of the threat: running past it would be silly.
    const side = ((s.x - x) * ax + (s.z - z) * az) / (alen * (fromCat || 1));
    let score = fromThreat * 0.6 - fromCat * 0.35 + side * 2.5;
    if (s.elevated) score += 1.2;
    if (occupied.includes(i)) score -= 3;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function pickWanderSpot(b: CatBrain, s: CatSense): number {
  const n = s.spots.length;
  if (n === 0) return -1;
  const free: number[] = [];
  for (let i = 0; i < n; i++) if (i !== b.spot && !s.occupied?.includes(i)) free.push(i);
  if (free.length === 0) return b.spot;
  return free[Math.floor(s.rng() * free.length)];
}

function enter(b: CatBrain, mode: CatMode, timer: number): void {
  b.mode = mode;
  b.timer = timer;
  b.elapsed = 0;
}

/** Advance the state machine by dt seconds. Mutates `b`. */
export function updateBrain(b: CatBrain, s: CatSense, dt: number): void {
  b.timer -= dt;
  b.elapsed += dt;
  const threat = nearestThreat(s.x, s.z, s.flyers);
  const rm = s.reducedMotion;

  // Fear rises fast and fades slowly.
  const fearTarget = b.mode === "flinch" || b.mode === "flee" ? 1 : b.mode === "recover" ? 0.35 : 0;
  b.fear += (fearTarget - b.fear) * Math.min(1, dt * (fearTarget > b.fear ? 12 : 0.6));

  if (threat && b.mode !== "flinch" && b.mode !== "flee") {
    b.threat = { x: threat.x, z: threat.z };
    b.spot = pickSafeSpot(s.x, s.z, b.threat, s.spots, s.occupied);
    enter(b, "flinch", rm ? 0.15 : 0.32);
    return;
  }

  switch (b.mode) {
    case "flinch":
      if (b.timer <= 0) enter(b, "flee", 0);
      return;

    case "flee": {
      const near = nearestThreat(s.x, s.z, s.flyers, SAFE_RADIUS);
      if (near) {
        b.threat = { x: near.x, z: near.z };
        // The threat followed us: re-plan if our safe spot is no longer safe.
        const sp = s.spots[b.spot];
        if (!sp || Math.hypot(sp.x - near.x, sp.z - near.z) < SAFE_RADIUS) {
          b.spot = pickSafeSpot(s.x, s.z, b.threat, s.spots, s.occupied);
        }
      }
      const done = (s.atTarget && b.elapsed > 0.8) || b.elapsed > 4.5;
      if ((!near && done) || b.elapsed > 7) enter(b, "recover", (rm ? 2 : 3) + s.rng() * 2.5);
      return;
    }

    case "recover":
      if (b.timer <= 0) {
        b.threat = null;
        enter(b, "sit", 2 + s.rng() * 4);
      }
      return;

    case "rest":
      if (b.timer <= 0) {
        const r = s.rng();
        if (r < 0.4) enter(b, "groom", 3 + s.rng() * 4);
        else if (r < 0.7) enter(b, "sit", 3 + s.rng() * 5);
        else startWalk(b, s);
      }
      return;

    case "groom":
      if (b.timer <= 0) {
        const r = s.rng();
        if (r < 0.35) enterRest(b, s);
        else if (r < 0.65) enter(b, "sit", 3 + s.rng() * 4);
        else startWalk(b, s);
      }
      return;

    case "sit":
      if (b.timer <= 0) {
        const r = s.rng();
        if (r < 0.55) startWalk(b, s);
        else if (r < 0.8) enter(b, "groom", 3 + s.rng() * 3);
        else enterRest(b, s);
      }
      return;

    case "walk":
      if (s.atTarget) {
        const spot = s.spots[b.spot];
        if (spot?.cosy || s.rng() < 0.4) enterRest(b, s);
        else enter(b, "sit", 3 + s.rng() * 5);
      } else if (b.elapsed > 30) {
        enter(b, "sit", 3);
      }
      return;
  }
}

function enterRest(b: CatBrain, s: CatSense): void {
  b.restPose = s.rng() < 0.55 ? "curl" : "loaf";
  enter(b, "rest", 10 + s.rng() * 20);
}

function startWalk(b: CatBrain, s: CatSense): void {
  const next = pickWanderSpot(b, s);
  if (next < 0) {
    enter(b, "sit", 4);
    return;
  }
  b.spot = next;
  enter(b, "walk", 0);
}
