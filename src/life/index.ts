import RAPIER from "@dimforge/rapier3d-compat";
import type { Engine, WorldHandle } from "../core/types.ts";
import { createCats } from "./cats.ts";
import { createLeaves } from "./leaves.ts";
import { createPhysics } from "./physics.ts";

/** Physics world, fallen leaves and the yard cats. */
export async function initLife(engine: Engine, world: WorldHandle): Promise<void> {
  await RAPIER.init();
  const phys = createPhysics(RAPIER, engine, world.colliders);
  const leaves = createLeaves(engine, phys, world.colliders);
  createCats(engine, phys, world.colliders, leaves);
}
