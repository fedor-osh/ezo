import type { Engine, WorldHandle } from "../core/types.ts";

// STUB — owned by the world agent.
export function buildWorld(_engine: Engine): WorldHandle {
  return { colliders: [], restSurfaces: [] };
}
