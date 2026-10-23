// Registry of things that can be pointed at, clicked, and perched on.
import type * as THREE from "three";

export interface Interactable {
  id: string;
  /** Raycast target. */
  object: THREE.Object3D;
  /** Human label, used for tooltips/aria. */
  label: string;
  onHover?(hit: THREE.Intersection | null): void;
  onActivate?(hit: THREE.Intersection): void;
}

/** A deforming surface (e.g. a cloth) that a creature can sit on and follow. */
export interface Surface {
  id: string;
  /** Write the world-space point and normal at surface coords (u, v ∈ [0, 1], v = 0 at the top). */
  pointAt(u: number, v: number, outPoint: THREE.Vector3, outNormal?: THREE.Vector3): void;
  /** Convert a raycast hit on `object` into surface coords, if it belongs to this surface. */
  uvFromHit?(hit: THREE.Intersection): { u: number; v: number } | null;
}

export const interactables = new Map<string, Interactable>();
export const surfaces = new Map<string, Surface>();

export function registerInteractable(i: Interactable): () => void {
  interactables.set(i.id, i);
  return () => interactables.delete(i.id);
}

export function registerSurface(s: Surface): () => void {
  surfaces.set(s.id, s);
  return () => surfaces.delete(s.id);
}
