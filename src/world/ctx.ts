import * as THREE from "three";
import type { ColliderSpec, Engine, UpdateFn } from "../core/types.ts";
import { Batch, Frames } from "./kit.ts";

/** Everything a world module needs: shared batches, collider/rest-surface sinks, an update hook. */
export interface WorldCtx {
  engine: Engine;
  high: boolean;
  root: THREE.Group;
  /** Static, merged at the end into one mesh per material. */
  b: {
    /** Big things: houses, walls, roofs, furniture. Cast + receive shadows. */
    matte: Batch;
    /** Small clutter: casts shadows only on high quality. */
    props: Batch;
    metal: Batch;
    glass: Batch;
    glow: Batch;
    /** Smooth-shaded round things (food, fruit). */
    soft: Batch;
    glossy: Batch;
    /** Receives shadows, never casts. */
    ground: Batch;
  };
  /** Local frame stack shared by every static batch. */
  f: Frames;
  colliders: ColliderSpec[];
  /** Invisible proxy geometry for surfaces creatures may sleep on (cheap to raycast). */
  rest: Batch;
  restObjects: THREE.Object3D[];
  update(fn: UpdateFn): void;
}

export function newBatches(f: Frames): WorldCtx["b"] {
  return {
    matte: new Batch(11, 0.035, f),
    props: new Batch(12, 0.035, f),
    metal: new Batch(13, 0.02, f),
    glass: new Batch(14, 0.05, f),
    glow: new Batch(15, 0.0, f),
    soft: new Batch(16, 0.0, f),
    glossy: new Batch(17, 0.0, f),
    ground: new Batch(18, 0.06, f),
  };
}

/** Box collider helper; y is the bottom of the box. */
export function boxCollider(ctx: WorldCtx, x: number, z: number, w: number, d: number, h: number, rotationY = 0, y = 0): void {
  ctx.colliders.push({ shape: "box", position: [x, y + h / 2, z], half: [w / 2, h / 2, d / 2], rotationY });
}

export function cylCollider(ctx: WorldCtx, x: number, z: number, radius: number, h: number, y = 0): void {
  ctx.colliders.push({ shape: "cylinder", position: [x, y + h / 2, z], radius, halfHeight: h / 2 });
}

/** Box collider given in the current local frame (centre x/z, bottom y). */
export function localBox(ctx: WorldCtx, x: number, z: number, w: number, d: number, h: number, rotationY = 0, y = 0): void {
  const [wx, wy, wz] = ctx.f.point([x, y, z]);
  const e = ctx.f.top.elements;
  boxCollider(ctx, wx, wz, w, d, h, Math.atan2(e[8], e[10]) + rotationY, wy);
}

export function localCyl(ctx: WorldCtx, x: number, z: number, radius: number, h: number, y = 0): void {
  const [wx, wy, wz] = ctx.f.point([x, y, z]);
  cylCollider(ctx, wx, wz, radius, h, wy);
}
