// One shared wind field so cloth, leaves and leaf-pointers all sway together.
import * as THREE from "three";

const BASE_DIR = new THREE.Vector3(1, 0, -0.35).normalize();

// Cheap smooth 1D noise: sum of incommensurate sines.
const n1 = (t: number) => Math.sin(t * 0.31) * 0.5 + Math.sin(t * 0.73 + 1.7) * 0.3 + Math.sin(t * 1.93 + 4.1) * 0.2;

let gustBoost = 0;

/** Trigger a stronger gust (e.g. a camera move or a click). Decays over ~2 s. */
export function gust(strength = 1): void {
  gustBoost = Math.min(3, gustBoost + strength);
}

export function updateWind(dt: number): void {
  gustBoost = Math.max(0, gustBoost - dt * 0.6);
}

/** Global gust intensity 0..~4 right now. */
export function gustiness(t: number): number {
  return Math.max(0, 0.55 + 0.45 * n1(t * 0.6)) + gustBoost;
}

/**
 * Wind velocity (m/s) at a world position and time. Spatially varying so neighbouring
 * objects do not move in lockstep; stronger higher up.
 */
export function windAt(p: THREE.Vector3, t: number, out = new THREE.Vector3()): THREE.Vector3 {
  const g = gustiness(t);
  const phase = p.x * 0.23 + p.z * 0.17;
  const swirl = n1(t * 1.3 + phase * 3.1);
  const height = 0.4 + Math.min(1.2, Math.max(0, p.y) * 0.22);
  out.copy(BASE_DIR).multiplyScalar((1.1 + swirl * 0.8) * g * height);
  out.x += n1(t * 2.1 + phase * 5.3) * 0.35 * g;
  out.z += n1(t * 1.7 - phase * 4.7) * 0.35 * g;
  out.y = n1(t * 2.7 + phase * 7.1) * 0.25 * g;
  return out;
}
