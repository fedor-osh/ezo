// Small math helpers shared by the creature modules. No scene dependencies.

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Frame-rate independent exponential approach factor. */
export const damp = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

/** Shortest signed difference between two angles. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Stable 32-bit string hash (FNV-1a). */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic 0..1 value from an integer seed and a channel. */
export const seeded = (seed: number, channel: number): number => {
  const x = Math.sin(seed * 0.0001 + channel * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

/** Smooth 1D noise in roughly [-1, 1]: incommensurate sines with a per-creature phase. */
export const noise1 = (t: number, phase: number): number =>
  Math.sin(t * 0.83 + phase) * 0.5 + Math.sin(t * 1.71 + phase * 2.3) * 0.3 + Math.sin(t * 3.13 + phase * 3.7) * 0.2;
