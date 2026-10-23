import type * as THREE from "three";

export type UpdateFn = (dt: number, t: number) => void;

/** Update order buckets: lower runs first each frame. */
export const ORDER = {
  input: 0,
  net: 10,
  physics: 20,
  life: 30,
  cloth: 40,
  world: 45,
  camera: 50,
} as const;

export interface Engine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  /** Register a per-frame callback. dt is clamped to 1/20 s. Returns an unsubscribe fn. */
  onUpdate(fn: UpdateFn, order?: number): () => void;
  /** "low" on small screens / weak GPUs: fewer leaves, no shadows on small props, etc. */
  quality: "low" | "high";
}

/** Static collider described by the world, consumed by the physics world (src/life). */
export type ColliderSpec =
  | {
      shape: "box";
      position: [number, number, number];
      /** Half extents. */
      half: [number, number, number];
      /** Rotation around Y in radians. */
      rotationY?: number;
    }
  | {
      shape: "cylinder";
      position: [number, number, number];
      radius: number;
      halfHeight: number;
    };

export interface WorldHandle {
  colliders: ColliderSpec[];
  /** Meshes that pointer creatures and traces may come to rest on (raycast-down targets). */
  restSurfaces: THREE.Object3D[];
}
