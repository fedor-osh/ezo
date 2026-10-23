import * as THREE from "three";
import { ORDER, type Engine, type UpdateFn, type WorldHandle } from "../core/types.ts";
import { newBatches, type WorldCtx } from "./ctx.ts";
import { Batch, Frames } from "./kit.ts";
import { materials } from "./materials.ts";
import { buildAtmosphere } from "./atmosphere.ts";
import { buildGround } from "./ground.ts";
import { buildHouses } from "./houses.ts";
import { buildPergola } from "./pergola.ts";
import { buildSupra } from "./supra.ts";
import { buildTone } from "./tone.ts";
import { buildPeople } from "./people.ts";
import { buildCar } from "./car.ts";
import { buildScooter } from "./scooter.ts";
import { buildFigTree } from "./figtree.ts";
import { buildClutter } from "./clutter.ts";
import { buildAmbient } from "./ambient.ts";

export function buildWorld(engine: Engine): WorldHandle {
  const root = new THREE.Group();
  root.name = "world";
  engine.scene.add(root);

  const f = new Frames();
  const updates: UpdateFn[] = [];
  const ctx: WorldCtx = {
    engine,
    high: engine.quality === "high",
    root,
    f,
    b: newBatches(f),
    colliders: [],
    rest: new Batch(19, 0, f),
    restObjects: [],
    update: (fn) => updates.push(fn),
  };

  buildAtmosphere(ctx);
  buildGround(ctx);
  const facade = buildHouses(ctx);
  buildPergola(ctx);
  buildSupra(ctx);
  buildTone(ctx);
  buildPeople(ctx);
  buildCar(ctx);
  buildScooter(ctx);
  buildFigTree(ctx);
  buildClutter(ctx, facade);
  buildAmbient(ctx, facade);

  flush(ctx);
  engine.onUpdate((dt, t) => {
    for (const fn of updates) fn(dt, t);
  }, ORDER.world);

  return { colliders: ctx.colliders, restSurfaces: ctx.restObjects };
}

/** Merge every static batch into one mesh per material. */
function flush(ctx: WorldCtx): void {
  const mat = materials();
  const { b } = ctx;
  const add = (batch: Batch, m: THREE.Material, name: string, cast: boolean, receive = true) => {
    if (batch.empty) return;
    ctx.root.add(batch.build(m, { cast, receive, name }));
  };
  add(b.matte, mat.matte, "static-matte", true);
  add(b.props, mat.matte, "static-props", ctx.high);
  add(b.metal, mat.metal, "static-metal", true);
  add(b.glass, mat.glass, "static-glass", false);
  add(b.glow, mat.glow, "static-glow", false);
  add(b.soft, mat.soft, "static-soft", true);
  add(b.glossy, mat.glossy, "static-glossy", true);
  add(b.ground, mat.matte, "static-ground", false, true);

  if (!ctx.rest.empty) {
    const proxy = ctx.rest.build(new THREE.MeshBasicMaterial({ visible: false }), { cast: false, receive: false, name: "rest-proxies" });
    ctx.root.add(proxy);
    proxy.updateMatrixWorld(true);
    ctx.restObjects.push(proxy);
  }
}
