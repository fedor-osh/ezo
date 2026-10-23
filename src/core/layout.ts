// Single source of truth for where things are in the yard. Units are metres, ground is y = 0.
// The yard is open toward +Z (the street gate, where the "home" camera stands).
//
//            z = -8   back house (3 floors, shushabandi glazed balconies)
//   x = -10 ┌──────────────────────────────┐ x = 10
//   left    │  tone        clothesline     │  right house
//   house   │        pergola+table   bench │
//           │  fig tree           Zhiguli  │
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

export const SPOTS = {
  /** Supra table under the grape pergola. `top` is the y of the tabletop surface. */
  table: { center: [-2.6, 0, 0.4] as V3, size: [2.4, 1.1] as [number, number], top: 0.78, rotationY: 0.12 },
  pergola: { center: [-2.6, 0, 0.4] as V3, size: [4.6, 3.6] as [number, number], height: 2.7 },
  /** Clay bread oven where puri is baked. */
  tone: { center: [-7, 0, -5] as V3, radius: 0.75, height: 0.95 },
  /** Bench where the grandmothers sit, grandpa plays nardi next to them. */
  bench: { center: [4.6, 0, -5.6] as V3, length: 2.4, rotationY: 0 },
  /** Old VAZ-2101 Zhiguli. */
  car: { center: [6.3, 0, 3.6] as V3, rotationY: -0.55 },
  /** Delivery scooter, the modern era. */
  scooter: { center: [3.2, 0, 5.6] as V3, rotationY: 1.9 },
  figTree: { center: [-7.4, 0, 4.2] as V3 },
} as const;

/**
 * Clotheslines. Cloth buttons hang from the main line, decorative laundry from the others.
 * Lines sag; `sag` is the drop at the middle in metres.
 */
export const CLOTHESLINES = {
  main: { from: [-6.5, 3.5, -2.2] as V3, to: [6.5, 3.5, -0.8] as V3, sag: 0.35 },
  decor: [
    { from: [-9.6, 4.6, -6.2] as V3, to: [-2, 5.2, -7.6] as V3, sag: 0.3 },
    { from: [9.6, 3.8, 1.5] as V3, to: [9.6, 3.9, -5.5] as V3, sag: 0.3 },
  ],
} as const;
