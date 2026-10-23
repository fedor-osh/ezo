// The Rapier world: ground, invisible yard walls, the world's static colliders, and a fixed-step
// loop. Leaves and cats plug in through hooks instead of owning the loop.
import type * as RAPIER_NS from "@dimforge/rapier3d-compat";
import type RAPIER_DEFAULT from "@dimforge/rapier3d-compat";
import { YARD } from "../core/layout.ts";
import { ORDER, type ColliderSpec, type Engine } from "../core/types.ts";

type Rapier = typeof RAPIER_DEFAULT;

export const STEP = 1 / 60;
const MAX_SUBSTEPS = 3;

/**
 * Collision groups: 16 bits of membership, 16 bits of filter.
 * Statics collide with leaves; cats (kinematic) only touch leaves.
 */
export const GROUP = {
  static: 0x0001,
  leaf: 0x0002,
  cat: 0x0004,
} as const;
export const groups = (member: number, filter: number) => ((member & 0xffff) << 16) | (filter & 0xffff);

export interface Physics {
  R: Rapier;
  world: RAPIER_NS.World;
  /** Called once per rendered frame before stepping, with the frame dt. */
  onFrame(fn: (dt: number, t: number) => void): void;
  /** Called before every fixed step. */
  onSubstep(fn: (h: number) => void): void;
  /** Called after the frame's steps: sync visuals here. */
  onAfterSteps(fn: (dt: number, t: number) => void): void;
  /** Run n fixed steps right now (pre-settling at init). */
  simulate(steps: number): void;
}

export function createPhysics(R: Rapier, engine: Engine, colliders: readonly ColliderSpec[]): Physics {
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP;

  const staticGroups = groups(GROUP.static, GROUP.leaf);
  const ground = world.createRigidBody(R.RigidBodyDesc.fixed());

  // Ground: a thick slab whose top is y = 0, a bit bigger than the yard.
  const gw = (YARD.maxX - YARD.minX) / 2 + 2;
  const gd = (YARD.maxZ - YARD.minZ) / 2 + 2;
  const cx = (YARD.maxX + YARD.minX) / 2;
  const cz = (YARD.maxZ + YARD.minZ) / 2;
  world.createCollider(
    R.ColliderDesc.cuboid(gw, 0.5, gd).setTranslation(cx, -0.5, cz).setFriction(0.9).setCollisionGroups(staticGroups),
    ground,
  );

  // Invisible walls just outside the yard so nothing blows away.
  // Tall enough that nothing lands on top (leaves above 9 m are respawned anyway).
  const H = 10;
  const T = 0.5;
  const walls: Array<[number, number, number, number]> = [
    [YARD.minX - T, cz, T, gd],
    [YARD.maxX + T, cz, T, gd],
    [cx, YARD.minZ - T, gw, T],
    [cx, YARD.maxZ + T, gw, T],
  ];
  for (const [x, z, hx, hz] of walls) {
    world.createCollider(
      R.ColliderDesc.cuboid(hx, H, hz).setTranslation(x, H, z).setFriction(0.4).setCollisionGroups(staticGroups),
      ground,
    );
  }

  for (const c of colliders) {
    const [x, y, z] = c.position;
    let desc: RAPIER_NS.ColliderDesc;
    if (c.shape === "box") {
      const a = (c.rotationY ?? 0) / 2;
      desc = R.ColliderDesc.cuboid(c.half[0], c.half[1], c.half[2]).setRotation({ x: 0, y: Math.sin(a), z: 0, w: Math.cos(a) });
    } else {
      desc = R.ColliderDesc.cylinder(c.halfHeight, c.radius);
    }
    world.createCollider(desc.setTranslation(x, y, z).setFriction(0.7).setCollisionGroups(staticGroups), ground);
  }

  const frameFns: Array<(dt: number, t: number) => void> = [];
  const subFns: Array<(h: number) => void> = [];
  const afterFns: Array<(dt: number, t: number) => void> = [];

  const step = () => {
    for (const f of subFns) f(STEP);
    world.step();
  };

  let acc = 0;
  engine.onUpdate((dt, t) => {
    for (const f of frameFns) f(dt, t);
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < MAX_SUBSTEPS) {
      step();
      acc -= STEP;
      n++;
    }
    // Falling behind (slow device, tab hiccup): drop the backlog instead of spiralling.
    if (n === MAX_SUBSTEPS) acc = Math.min(acc, STEP);
    for (const f of afterFns) f(dt, t);
  }, ORDER.physics);

  return {
    R,
    world,
    onFrame: (fn) => void frameFns.push(fn),
    onSubstep: (fn) => void subFns.push(fn),
    onAfterSteps: (fn) => void afterFns.push(fn),
    simulate(steps) {
      for (let i = 0; i < steps; i++) step();
    },
  };
}
