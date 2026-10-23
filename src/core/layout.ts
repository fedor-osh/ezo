// Single source of truth for where things are in the yard. Units are metres, ground is y = 0.
// The yard is open toward +Z (the street gate, where the "home" camera stands).
//
//            z = -8   back house (3 floors, shushabandi glazed balconies)
//   x = -10 ┌──────────────────────────────┐ x = 10
//   left    │ gallery  tone  ─clothesline─ bench nardi │  right house
//   house   │ stairs     pergola+table              │
//           │  fig tree         scooter   Zhiguli  │
//            z = +8   gate / street
//
// Owned by the world builder, read by everyone else. Keep export names stable.

export type V3 = [number, number, number];

export const YARD = {
  minX: -10,
  maxX: 10,
  minZ: -8,
  maxZ: 8,
} as const;

/** House facades stand exactly on the yard bounds; bodies extend outward. */
export const HOUSES = {
  /** Floor-to-floor height. */
  floor: 2.9,
  /** Top of the stone plinth = ground-floor level. */
  plinth: 0.35,
  /** Height of the wooden gallery on the left house (second-floor level). */
  gallery: { y: 3.25, depth: 1.3, fromZ: -7.7, toZ: -2.6 },
  /** External wooden staircase up to the gallery, along the left house. */
  stairs: { x: -9.5, width: 1.0, bottomZ: 0.7, topZ: -2.6 },
  /** Front wall with the gate opening in the middle. */
  gate: { z: 8, halfWidth: 2.3, wallHeight: 1.15 },
} as const;

export const SPOTS = {
  /** Supra table under the grape pergola. `top` is the y of the tabletop surface. */
  table: { center: [-2.9, 0, 1.3] as V3, size: [2.4, 1.1] as [number, number], top: 0.78, rotationY: 0.12 },
  pergola: { center: [-2.9, 0, 1.3] as V3, size: [4.8, 3.4] as [number, number], height: 2.6 },
  /** Clay bread oven where puri is baked. */
  tone: { center: [-6.9, 0, -5.4] as V3, radius: 0.75, height: 0.95 },
  /** Bench where the grandmothers sit (facing +Z, its back to the pink house). */
  bench: { center: [4.4, 0, -6.7] as V3, length: 2.4, rotationY: 0 },
  /** Little folding table where grandpa plays nardi with his neighbour. */
  nardi: { center: [7.5, 0, -5.2] as V3, rotationY: -0.35 },
  /** Old VAZ-2101 Zhiguli; its nose (local +X) points roughly toward the gate. */
  car: { center: [6.5, 0, 3.3] as V3, rotationY: -2.42 },
  /** Delivery scooter, the modern era. */
  scooter: { center: [-2.7, 0, 6.5] as V3, rotationY: 0.3 },
  figTree: { center: [-7.4, 0, 4.4] as V3 },
  /** Old ZIL fridge pushed against the right house, used as a cupboard. */
  fridge: { center: [9.45, 0, 6.6] as V3, rotationY: -Math.PI / 2 },
  /** Courtyard drain grate. */
  drain: { center: [0.9, 0, -2.6] as V3 },
} as const;

/**
 * Clotheslines. Cloth buttons hang from the main line, decorative laundry from the others.
 * Lines sag; `sag` is the drop at the middle in metres. The world provides poles/hooks at the endpoints.
 */
export const CLOTHESLINES = {
  main: { from: [-6.5, 4.3, -1.6] as V3, to: [6.5, 4.3, -0.9] as V3, sag: 0.4 },
  decor: [
    { from: [-9.6, 4.6, -6.2] as V3, to: [-3.4, 5.2, -7.6] as V3, sag: 0.3 },
    { from: [9.6, 3.8, 1.5] as V3, to: [9.6, 3.9, -5.5] as V3, sag: 0.3 },
  ],
} as const;
