// Yard clutter that tells the story: clothesline poles and hooks, the ZIL fridge, rooftop water tank,
// solar heater and satellite dishes, tangled cables, pots, buckets and crates.
import * as THREE from "three";
import { CLOTHESLINES, HOUSES, SPOTS, YARD, type V3 } from "../core/layout.ts";
import { boxCollider, cylCollider, localBox, type WorldCtx } from "./ctx.ts";
import { lathe, rng, sagPoints, tube, type Vec } from "./kit.ts";
import { C } from "./materials.ts";
import type { Facade } from "./facade.ts";

const P = HOUSES.plinth;
const F = HOUSES.floor;

export function buildClutter(ctx: WorldCtx, fa: Facade): void {
  const rand = rng(404);
  clotheslineAnchors(ctx);
  fridge(ctx);
  rooftops(ctx);
  cables(ctx);
  yardBits(ctx, fa, rand);
}

/** Poles for free-standing line ends, wall brackets for ends near a facade. */
function clotheslineAnchors(ctx: WorldCtx): void {
  const ends: Array<{ p: V3; other: V3 }> = [];
  const lines = [CLOTHESLINES.main, ...CLOTHESLINES.decor];
  for (const l of lines) {
    ends.push({ p: l.from as V3, other: l.to as V3 }, { p: l.to as V3, other: l.from as V3 });
  }
  const mt = ctx.b.metal;
  for (const { p, other } of ends) {
    const [x, y, z] = p;
    const wallX = x <= YARD.minX + 0.8 ? YARD.minX : x >= YARD.maxX - 0.8 ? YARD.maxX : null;
    const wallZ = z <= YARD.minZ + 0.8 ? YARD.minZ : null;
    if (wallX !== null || wallZ !== null) {
      const from: Vec = wallX !== null ? [wallX, y, z] : [x, y, wallZ as number];
      mt.rod(from, [x, y, z], 0.018, "#5a5550", 5);
      mt.rod([from[0], y - 0.25, from[2]], [x * 0.5 + from[0] * 0.5, y, z * 0.5 + from[2] * 0.5], 0.012, "#5a5550", 4);
      mt.add(new THREE.TorusGeometry(0.04, 0.008, 4, 10), "#4a4540", { p: [x, y - 0.03, z], r: [Math.PI / 2, 0, 0] });
      ctx.b.matte.box(0.12, 0.12, 0.02, C.stoneDark, {
        p: wallX !== null ? [wallX + Math.sign(-wallX) * 0.01, y, z] : [x, y, (wallZ as number) + 0.01],
        r: [0, wallX !== null ? Math.PI / 2 : 0, 0],
      });
      continue;
    }
    // T-pole: an old water pipe painted green, crossbar across the line, hook at the end.
    const top = y + 0.25;
    const dx = other[0] - x;
    const dz = other[2] - z;
    const yaw = Math.atan2(dx, dz);
    ctx.f.at({ p: [x, 0, z], r: [0, yaw, 0] }, () => {
      mt.cyl(0.05, 0.055, top, 8, "#5f8f6a", { p: [0, top / 2, 0] });
      mt.cyl(0.09, 0.11, 0.12, 8, "#8a8580", { p: [0, 0.06, 0] });
      mt.box(0.9, 0.06, 0.06, "#5f8f6a", { p: [0, y, 0] });
      mt.cyl(0.06, 0.06, 0.04, 8, "#4f7a5a", { p: [0, top + 0.02, 0] });
      // Rust where the paint has flaked.
      for (let k = 0; k < 3; k++) ctx.b.props.box(0.11, 0.05 + k * 0.03, 0.11, C.rust, { p: [0, 0.4 + k * 0.9, 0] });
      mt.add(new THREE.TorusGeometry(0.035, 0.008, 4, 10), "#3a3530", { p: [0, y - 0.04, 0.0], r: [0, Math.PI / 2, 0] });
      // Spare pegs clipped on the crossbar.
      const pegs = ["#e2334a", "#3f9c94", "#f7d354", "#3f78c2"];
      for (let k = 0; k < 4; k++) ctx.b.props.box(0.02, 0.07, 0.025, pegs[k], { p: [-0.35 + k * 0.08, y - 0.02, 0.0] });
    });
    cylCollider(ctx, x, z, 0.07, top);
    ctx.rest.box(0.9, 0.06, 0.06, "#fff", { p: [x, y + 0.03, z], r: [0, yaw, 0] });
  }
}

/** ZIL fridge: rounded, cream-white, a big chrome lever handle, a little rust. Used as a cupboard now. */
function fridge(ctx: WorldCtx): void {
  const { center, rotationY } = SPOTS.fridge;
  ctx.f.at({ p: center as Vec, r: [0, rotationY, 0] }, () => {
    const g = ctx.b.glossy;
    const w = 0.66;
    const d = 0.62;
    const h = 1.42;
    g.boxUp(w, h - 0.12, d, "#f1ece0", { p: [0, 0.08, 0] });
    g.add(new THREE.CapsuleGeometry(0.12, w - 0.24, 4, 8).rotateZ(Math.PI / 2), "#f1ece0", { p: [0, h - 0.06, 0], s: [1, 1, d / 0.24] });
    g.boxUp(w, 0.24, d - 0.24, "#f1ece0", { p: [0, h - 0.18, 0] });
    ctx.b.matte.boxUp(w - 0.04, 0.08, d - 0.04, "#3a3836", { p: [0, 0, 0] });
    ctx.b.matte.box(0.01, h - 0.3, w - 0.06, "#d8d2c4", { p: [0, 0.78, d / 2 + 0.002], r: [0, Math.PI / 2, 0] });
    ctx.b.metal.box(0.06, 0.32, 0.05, C.chrome, { p: [w / 2 - 0.1, 1.0, d / 2 + 0.04] });
    ctx.b.metal.box(0.16, 0.04, 0.04, C.chrome, { p: [w / 2 - 0.16, 1.15, d / 2 + 0.06] });
    ctx.b.metal.box(0.18, 0.05, 0.01, C.chrome, { p: [0, 1.28, d / 2 + 0.005] });
    for (let k = 0; k < 5; k++) ctx.b.props.sphere(0.025, C.rust, { p: [-0.25 + k * 0.1, 0.12 + (k % 2) * 0.05, d / 2 - 0.005], s: [1.4, 1, 0.3] }, 0);
    // A jar of pickles and a three-litre jar of compote on top.
    ctx.b.glossy.cyl(0.08, 0.08, 0.26, 10, "#c46a7a", { p: [-0.12, h + 0.13, 0] });
    ctx.b.glossy.cyl(0.06, 0.06, 0.03, 10, "#c9b25a", { p: [-0.12, h + 0.27, 0] });
    ctx.b.glossy.cyl(0.06, 0.06, 0.16, 10, "#6f8a3a", { p: [0.15, h + 0.08, 0.05] });
    localBox(ctx, 0, 0, w, d, h);
    ctx.rest.box(w, 0.06, d, "#fff", { p: [0, h, 0] });
  });
}

function rooftops(ctx: WorldCtx): void {
  const hC = P + 2 * F + 0.25;
  // Rusty water tank on a stand on the pink house roof.
  ctx.f.at({ p: [6.2, hC, -9.8] }, () => {
    const mt = ctx.b.metal;
    for (const x of [-0.6, 0.6]) for (const z of [-0.45, 0.45]) mt.box(0.06, 1.1, 0.06, "#4a4440", { p: [x, 0.55, z] });
    mt.box(1.4, 0.06, 1.0, "#4a4440", { p: [0, 1.1, 0] });
    ctx.b.matte.cyl(0.6, 0.6, 1.7, 14, C.rust, { p: [0, 1.75, 0], r: [0, 0, Math.PI / 2] }, 0.08);
    for (const x of [-0.6, 0, 0.6]) ctx.b.matte.cyl(0.62, 0.62, 0.06, 14, C.rustDark, { p: [x, 1.75, 0], r: [0, 0, Math.PI / 2] });
    mt.rod([0.85, 1.6, 0], [1.2, 1.6, 0], 0.03, "#777", 5);
    mt.rod([1.2, 1.6, 0], [1.2, 0, 0], 0.03, "#777", 5);
    ctx.rest.box(1.6, 0.1, 0.6, "#fff", { p: [0, 2.35, 0] });
  });
  // Solar water heater: tilted dark-blue panel toward the low sun, a tank on top.
  ctx.f.at({ p: [8.6, hC, -9.4], r: [0, 0.35, 0] }, () => {
    const mt = ctx.b.metal;
    ctx.b.glass.box(1.8, 0.05, 1.1, "#1f3a66", { p: [0, 0.75, 0], r: [-0.75, 0, 0] });
    for (let k = -4; k <= 4; k++) mt.box(0.025, 0.07, 1.12, "#c9ced2", { p: [k * 0.2, 0.75, 0], r: [-0.75, 0, 0] });
    mt.box(1.86, 0.07, 0.04, "#c9ced2", { p: [0, 0.75 + 0.36, -0.37], r: [-0.75, 0, 0] });
    mt.cyl(0.22, 0.22, 1.9, 12, "#dfe3e6", { p: [0, 1.4, -0.55], r: [0, 0, Math.PI / 2] });
    for (const x of [-0.85, 0.85]) {
      mt.rod([x, 0, 0.45], [x, 0.4, 0.4], 0.025, "#888", 4);
      mt.rod([x, 0, -0.5], [x, 1.25, -0.5], 0.025, "#888", 4);
    }
    ctx.rest.box(1.9, 0.1, 0.5, "#fff", { p: [0, 1.62, -0.55] });
  });
  // Satellite dishes: one on the right house wall, one on the tin roof of G.
  dish(ctx, [YARD.maxX - 0.25, P + 2 * F + 1.6, -0.6], -Math.PI / 2 - 0.4, 0.42);
  dish(ctx, [YARD.maxX - 1.0, P + 2 * F + 0.9, 5.5], -Math.PI / 2 + 0.3, 0.36);
  dish(ctx, [-4.5, P + 3 * F + 0.4, -8.3], 0.3, 0.32);
}

function dish(ctx: WorldCtx, p: Vec, yaw: number, r: number): void {
  ctx.f.at({ p, r: [0, yaw, 0] }, () => {
    const prof: Array<[number, number]> = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      prof.push([t * r, t * t * r * 0.45]);
    }
    for (let i = 6; i >= 0; i--) {
      const t = i / 6;
      prof.push([t * r, t * t * r * 0.45 - 0.015]);
    }
    ctx.b.props.add(lathe(prof, 16), "#efede6", { p: [0, 0, 0.18], r: [Math.PI / 2 - 0.35, 0, 0] });
    ctx.b.metal.rod([0, -0.05, 0.2], [0, -0.05, -0.05], 0.02, "#777", 4);
    ctx.b.metal.rod([0, -r * 0.6, 0.25], [0, 0.0, 0.25 + r * 1.1], 0.012, "#888", 4);
    ctx.b.props.box(0.05, 0.05, 0.1, "#3a3a3a", { p: [0, 0.03, 0.25 + r * 1.1] });
  });
}

/** Sagging, tangled internet and power cables between the houses. */
function cables(ctx: WorldCtx): void {
  const rand = rng(12);
  const runs: Array<[Vec, Vec, number, number]> = [
    [[3.45, 9.25, -8.05], [9.95, 8.4, -2.8], 0.9, 4],
    [[-9.95, 5.95, 3.4], [9.95, 5.75, 2.4], 1.1, 2],
    [[-6.2, 9.1, -8.05], [-9.95, 6.25, -1.2], 0.7, 3],
    [[-9.95, 6.1, 6.8], [-3.0, 6.0, 8.0], 0.6, 1],
    [[9.95, 6.0, 7.0], [3.0, 5.6, 8.0], 0.5, 1],
    [[-3.45, 9.2, -8.05], [3.45, 9.2, -8.05], 0.5, 2],
  ];
  for (const [a, b, sag, count] of runs) {
    for (let k = 0; k < count; k++) {
      const o = (): Vec => [(rand() - 0.5) * 0.12, (rand() - 0.5) * 0.12, (rand() - 0.5) * 0.12];
      const oa = o();
      const ob = o();
      const pts = sagPoints(
        [a[0] + oa[0], a[1] + oa[1], a[2] + oa[2]],
        [b[0] + ob[0], b[1] + ob[1], b[2] + ob[2]],
        sag * (0.85 + rand() * 0.4),
        10,
      );
      ctx.b.props.add(tube(pts, 0.012, 3), rand() < 0.25 ? "#3a3a3a" : "#1f1f1f", undefined, 0);
    }
    ctx.b.props.box(0.18, 0.22, 0.1, "#d8d4c8", { p: [a[0], a[1] - 0.1, a[2]] });
  }
}

function yardBits(ctx: WorldCtx, fa: Facade, rand: () => number): void {
  const m = ctx.b.matte;
  // Big tubs with a lemon tree and an aloe along the right wall, geraniums at the back.
  const tub = (x: number, z: number, r: number, plant: "lemon" | "aloe" | "flowers") => {
    m.add(lathe([[r * 0.75, 0], [r, r * 1.1], [r * 1.05, r * 1.15], [r * 0.95, r * 1.15]], 10), C.terracotta, { p: [x, 0, z] });
    m.cyl(r * 0.92, r * 0.92, 0.02, 10, "#5a3f2a", { p: [x, r * 1.08, z] });
    if (plant === "lemon") {
      m.rod([x, r, z], [x + 0.05, r + 0.7, z], 0.03, "#6a4a30", 5);
      m.sphere(0.4, "#3f7a2f", { p: [x + 0.05, r + 0.95, z], s: [1, 0.9, 1] }, 1);
      for (let k = 0; k < 6; k++) {
        const a = rand() * 6.28;
        ctx.b.glossy.sphere(0.05, "#f6d02f", { p: [x + Math.cos(a) * 0.36, r + 0.85 + rand() * 0.25, z + Math.sin(a) * 0.36], s: [1, 1.2, 1] }, 1);
      }
    } else if (plant === "aloe") {
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * 6.28;
        m.add(new THREE.ConeGeometry(0.04, 0.5, 4), "#6f9e6a", { p: [x + Math.cos(a) * 0.08, r + 0.25, z + Math.sin(a) * 0.08], r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5] });
      }
    } else {
      fa.geranium(x, r * 1.0, z);
    }
    cylCollider(ctx, x, z, r, r * 1.15);
  };
  tub(YARD.maxX - 0.55, -2.4, 0.32, "lemon");
  tub(YARD.maxX - 0.5, -3.3, 0.22, "aloe");
  tub(2.4, YARD.minZ + 0.5, 0.24, "flowers");
  tub(-4.6, YARD.minZ + 0.45, 0.22, "flowers");
  tub(-8.8, 2.2, 0.26, "aloe");

  // Buckets and a tin basin by the tone, a crate of tomatoes by the shop.
  const bucket = (x: number, z: number, c: string) => {
    ctx.b.metal.add(lathe([[0.12, 0], [0.15, 0.28], [0.155, 0.29], [0.145, 0.29], [0.13, 0.04]], 10), c, { p: [x, 0, z] });
    ctx.b.metal.add(new THREE.TorusGeometry(0.15, 0.006, 3, 10, Math.PI), "#555", { p: [x, 0.29, z], r: [0, 0, 0.3] });
    cylCollider(ctx, x, z, 0.15, 0.3);
  };
  bucket(SPOTS.tone.center[0] + 1.1, SPOTS.tone.center[2] - 0.7, "#9aa7a6");
  bucket(-1.6, YARD.minZ + 0.6, "#3f78c2");
  ctx.b.metal.add(lathe([[0.25, 0], [0.38, 0.14], [0.4, 0.15]], 14), "#b8bec2", { p: [SPOTS.tone.center[0] + 1.3, 0, SPOTS.tone.center[2] + 1.0] });
  cylCollider(ctx, SPOTS.tone.center[0] + 1.3, SPOTS.tone.center[2] + 1.0, 0.38, 0.15);
  ctx.f.at({ p: [YARD.minX + 0.75, 0, 6.3], r: [0, 0.3, 0] }, () => {
    m.boxUp(0.5, 0.28, 0.36, "#b07a48");
    for (let k = 0; k < 8; k++) ctx.b.glossy.sphere(0.055, "#d8282c", { p: [-0.17 + (k % 4) * 0.11, 0.3, -0.07 + Math.floor(k / 4) * 0.13] }, 1);
    localBox(ctx, 0, 0, 0.5, 0.36, 0.3);
  });
  // A broom leaning by the back door and a garden hose coil.
  ctx.b.props.rod([0.75, 0, -7.75], [0.95, 1.4, -7.93], 0.018, "#c9a46a", 5);
  ctx.b.props.add(new THREE.ConeGeometry(0.12, 0.35, 6), "#d8b45a", { p: [0.76, 0.12, -7.72], r: [0.12, 0, -0.14] });
  ctx.b.props.add(new THREE.TorusGeometry(0.22, 0.025, 5, 16).rotateX(Math.PI / 2), "#3a8a4a", { p: [YARD.maxX - 0.5, 0.03, -4.4] });
  ctx.b.props.add(new THREE.TorusGeometry(0.19, 0.025, 5, 16).rotateX(Math.PI / 2), "#3a8a4a", { p: [YARD.maxX - 0.5, 0.08, -4.4] });
  boxCollider(ctx, YARD.maxX - 0.5, -4.4, 0.5, 0.5, 0.12);
}
