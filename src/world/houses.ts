// The three houses around the yard, the front wall with the gate, the left-house wooden stairs and
// gallery. Each side is built in its own facade frame (see facade.ts).
import * as THREE from "three";
import { HOUSES, YARD } from "../core/layout.ts";
import { boxCollider, cylCollider, type WorldCtx } from "./ctx.ts";
import { Facade } from "./facade.ts";
import { rng, type Place } from "./kit.ts";
import { C, materials } from "./materials.ts";
import { mosaicTexture, signTexture } from "./textures.ts";

const F = HOUSES.floor;
const P = HOUSES.plinth;
/** Level of floor k (0 = ground floor). */
const lvl = (k: number) => P + k * F;

export const FRAMES = {
  back: { p: [YARD.minX, 0, YARD.minZ], r: [0, 0, 0] } as Place,
  left: { p: [YARD.minX, 0, YARD.maxZ], r: [0, Math.PI / 2, 0] } as Place,
  right: { p: [YARD.maxX, 0, YARD.minZ], r: [0, -Math.PI / 2, 0] } as Place,
};

export function buildHouses(ctx: WorldCtx): Facade {
  const fa = new Facade(ctx, rng(3));
  ctx.f.at(FRAMES.back, () => backHouse(ctx, fa));
  ctx.f.at(FRAMES.left, () => leftHouse(ctx, fa));
  ctx.f.at(FRAMES.right, () => rightHouse(ctx, fa));
  frontWall(ctx);
  stairsAndGallery(ctx, fa);
  buildTiles(ctx, fa);

  // House footprints (behind the facades) and the front wall.
  const depth = 4.5;
  boxCollider(ctx, 0, YARD.minZ - depth / 2, YARD.maxX - YARD.minX + depth * 2, depth, 10);
  boxCollider(ctx, YARD.minX - depth / 2, 2, depth, YARD.maxZ - YARD.minZ + 4, 7);
  boxCollider(ctx, YARD.maxX + depth / 2, 2, depth, YARD.maxZ - YARD.minZ + 4, 10);
  return fa;
}

function backHouse(ctx: WorldCtx, fa: Facade): void {
  const d = 4.4;
  // A: cream, three floors, terracotta roof, a shushabandi on the top floor.
  const hA = fa.body(-4, 6.5, 3, d, C.cream, F, P);
  fa.roofPitched(-4, 6.5, hA, d, 1.7, C.terracotta, true);
  fa.door(2.0, { color: C.woodPaint });
  fa.window(4.6, 1.0, { arch: true, shutter: C.teal, curtain: true });
  fa.window(2.6, lvl(1) + 0.8, { shutter: C.sky, curtain: true });
  fa.window(4.8, lvl(1) + 0.8, { shutter: C.sky, mark: "tv" });
  fa.shushabandi(1.8, 5.6, lvl(2), 0.85, C.woodDark, F, 1);
  fa.acUnit(0.8, lvl(2) + 1.4);
  fa.gasPipe(0.4, 6.5, 2.85, [3.2]);
  fa.cracks(0.3, 6.3, 0.8, 8.5, C.cream, 9);
  fa.peel(5.7, 1.5, 0.7, 0.5);
  fa.peel(0.9, 5.2, 0.5, 0.4);

  // B: ochre, the two-storey hero shushabandi (the "stack" shot).
  const hB = fa.body(6.5, 13.5, 3, d, C.ochre, F, P);
  fa.roofTin(6.5, 13.5, hB, d, 0.9);
  fa.door(10, { color: C.wood, awning: true });
  fa.window(7.6, 1.0, { arch: true, shutter: C.teal, w: 0.8 });
  fa.window(12.4, 1.0, { arch: true, shutter: C.teal, w: 0.8, curtain: true });
  fa.shushabandi(7.7, 12.3, lvl(1), 1.0, "#6b4128", F, 2);
  fa.window(13.0, lvl(1) + 0.8, { w: 0.6, h: 1.2 });
  fa.cracks(6.6, 13.4, 0.5, 3.0, C.ochre, 6);
  fa.peel(8.8, 2.3, 0.6, 0.45);
  fa.gasPipe(6.5, 13.5, 2.85, [11.4]);

  // C: pink, two floors, carved balcony, flat roof with tank and solar heater.
  const hC = fa.body(13.5, 24, 2, d, C.pink, F, P);
  fa.roofFlat(13.5, 24, hC, d, C.pink);
  fa.window(14.4, 1.05, { shutter: C.woodPaint, curtain: true, pot: false });
  fa.window(16.6, 1.05, { shutter: C.woodPaint, pot: false });
  fa.door(19.0, { color: C.wine, step: true });
  fa.woodBalcony(14.0, 17.6, lvl(1), 1.0, C.woodDark, { roofTo: lvl(2) - 0.2, pots: 3 });
  fa.window(16.7, lvl(1) + 0.75, { curtain: true });
  fa.window(19.0, lvl(1) + 0.8, { shutter: C.woodPaint });
  ctx.f.at({ p: [0, lvl(1) - 0.15, 0] }, () => fa.door(15.0, { color: C.woodPaint, transom: false, step: false, h: 2.1 }));
  fa.gasPipe(13.5, 20, 2.85, [17.8]);
  fa.cracks(13.6, 19.8, 0.6, 6.0, C.pink, 7);
  fa.peel(18.0, 4.8, 0.6, 0.5);
}

function leftHouse(ctx: WorldCtx, fa: Facade): void {
  const d = 4.4;
  // D: salmon, shop front with the faded sign, carved balcony.
  const hD = fa.body(-4, 7, 2, d, C.salmon, F, P);
  fa.roofPitched(-4, 7, hD, d, 1.5, C.terracotta, true);
  fa.door(1.5, { color: C.teal, transom: false });
  fa.window(3.0, 0.75, { w: 1.6, h: 1.6, frame: C.teal, pot: false });
  sign(ctx, 2.2, 2.75, "ХЛЕБ");
  fa.window(5.6, 1.0, { arch: true, shutter: C.wine });
  fa.woodBalcony(0.6, 3.2, lvl(1), 0.95, "#7c4b2c", { pots: 2 });
  ctx.f.at({ p: [0, lvl(1) - 0.2, 0] }, () => fa.door(1.9, { color: C.wood, transom: false, step: false, h: 2.1, w: 0.9 }));
  fa.window(4.6, lvl(1) + 0.8, { shutter: C.sky, curtain: true });
  fa.window(6.3, lvl(1) + 0.8, { shutter: C.sky });
  fa.gasPipe(0, 7, 2.85, [4.3]);
  fa.cracks(0.2, 6.8, 0.5, 5.8, C.salmon, 7);
  fa.peel(4.2, 1.9, 0.6, 0.5);

  // E: mint, behind the wooden gallery.
  const hE = fa.body(7, 20, 2, d, C.mint, F, P);
  fa.roofTin(7, 20, hE, d, 0.8);
  fa.door(12.0, { color: C.woodPaint });
  fa.window(14.2, 1.0, { shutter: C.teal, curtain: true });
  ctx.f.at({ p: [0, lvl(1) - 0.2, 0] }, () => fa.door(11.6, { color: C.wood, transom: false, step: false, h: 2.15 }));
  fa.window(13.4, lvl(1) + 0.8, { curtain: true, pot: false });
  fa.window(15.1, lvl(1) + 0.8, { shutter: C.sky, pot: false });
  fa.gasPipe(7, 16, 2.85, [9.0]);
  fa.cracks(7.2, 15.8, 0.5, 5.8, C.mint, 6);
  fa.peel(8.5, 1.6, 0.5, 0.6);
}

function rightHouse(ctx: WorldCtx, fa: Facade): void {
  const d = 4.4;
  // F: pale blue, three floors, shushabandi on top, the decor clothesline along floor 1.
  const hF = fa.body(-4, 8, 3, d, C.plasterBlue, F, P);
  fa.roofPitched(-4, 8, hF, d, 1.7, C.terracotta, true);
  fa.window(1.6, 1.0, { shutter: C.woodPaint, pot: false });
  fa.window(4.4, 1.0, { arch: true, shutter: C.woodPaint, curtain: true, pot: false });
  fa.door(6.6, { color: C.wood, awning: true });
  fa.window(1.4, lvl(1) + 0.9, { curtain: true, pot: false });
  fa.window(3.6, lvl(1) + 0.9, { shutter: C.wine, pot: false });
  fa.window(5.8, lvl(1) + 0.9, { shutter: C.wine, pot: false });
  fa.shushabandi(2.4, 6.4, lvl(2), 0.8, C.woodDark, F, 1);
  fa.acUnit(1.1, lvl(2) + 1.3);
  fa.acUnit(7.2, lvl(1) + 1.9);
  fa.gasPipe(0, 8, 2.85, [5.4]);
  fa.cracks(0.2, 7.8, 0.5, 8.5, C.plasterBlue, 8);
  fa.peel(2.8, 2.2, 0.7, 0.5);

  // G: warm ochre, two floors, the mosaic above the car, the window with the Wi-Fi router.
  const hG = fa.body(8, 20, 2, d, "#eeb27a", F, P);
  fa.roofTin(8, 20, hG, d, 0.8);
  fa.door(9.1, { color: C.teal, awning: true });
  fa.window(11.0, 1.0, { shutter: C.teal, curtain: true });
  fa.window(13.0, 1.0, { shutter: C.teal, mark: "router", pot: false });
  fa.window(9.1, lvl(1) + 0.8, { shutter: C.teal });
  fa.window(15.4, lvl(1) + 0.8, { shutter: C.teal, curtain: true });
  mosaic(ctx, 12.2, lvl(1) + 1.25);
  fa.gasPipe(8, 16, 2.85, [10.1]);
  fa.cracks(8.2, 15.8, 0.5, 5.8, "#eeb27a", 6);
  fa.peel(14.6, 2.3, 0.6, 0.5);
}

/** Faded shop sign on a cream board, in the current facade frame. */
function sign(ctx: WorldCtx, x: number, y: number, text: string): void {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.6),
    new THREE.MeshStandardMaterial({ map: signTexture(text), roughness: 0.9 }),
  );
  placeInFrame(ctx, mesh, [x, y, 0.06]);
  ctx.b.matte.box(2.55, 0.72, 0.05, C.woodDark, { p: [x, y, 0.025] });
  mesh.receiveShadow = true;
  ctx.root.add(mesh);
}

function mosaic(ctx: WorldCtx, x: number, y: number): void {
  const w = 3.2;
  const h = 2.4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: mosaicTexture(), roughness: 0.55 }),
  );
  placeInFrame(ctx, mesh, [x, y, 0.035]);
  mesh.receiveShadow = true;
  ctx.root.add(mesh);
  ctx.b.matte.box(w + 0.14, h + 0.14, 0.04, "#d8cbb4", { p: [x, y, 0.015] });
}

function placeInFrame(ctx: WorldCtx, obj: THREE.Object3D, p: [number, number, number]): void {
  obj.applyMatrix4(ctx.f.top.clone().multiply(new THREE.Matrix4().makeTranslation(p[0], p[1], p[2])));
  obj.updateMatrix();
  obj.matrixAutoUpdate = false;
}

function frontWall(ctx: WorldCtx): void {
  const { z, halfWidth, wallHeight } = HOUSES.gate;
  const m = ctx.b.matte;
  const t = 0.32;
  for (const side of [-1, 1]) {
    const x0 = side * halfWidth;
    const x1 = side * YARD.maxX;
    const cx = (x0 + x1) / 2;
    const w = Math.abs(x1 - x0);
    m.boxUp(w, wallHeight, t, C.creamShade, { p: [cx, 0, z + t / 2] });
    m.boxUp(w + 0.04, 0.1, t + 0.1, C.stone, { p: [cx, wallHeight, z + t / 2] });
    ctx.rest.boxUp(w, 0.12, t, "#fff", { p: [cx, wallHeight, z + t / 2] });
    boxCollider(ctx, cx, z + t / 2, w, t, wallHeight + 0.1);
    // Gate pillars.
    m.boxUp(0.55, 2.0, 0.55, C.cream, { p: [x0, 0, z + t / 2] });
    m.boxUp(0.68, 0.14, 0.68, C.stone, { p: [x0, 2.0, z + t / 2] });
    m.sphere(0.18, C.stone, { p: [x0, 2.3, z + t / 2] }, 0);
    boxCollider(ctx, x0, z + t / 2, 0.55, 0.55, 2.0);
    // Wrought-iron gate leaf swung open against the wall.
    const mt = ctx.b.metal;
    const leaf = 2.1;
    ctx.f.at({ p: [x0 - side * 0.3, 0, z - 0.12], r: [0, side > 0 ? Math.PI - 0.18 : 0.18, 0] }, () => {
      mt.box(0.05, 0.05, 0.05, C.black, { p: [0, 0.2, 0] });
      for (const yy of [0.15, 0.95, 1.85]) mt.box(leaf, 0.05, 0.04, C.sky, { p: [-leaf / 2, yy, 0] });
      for (let bx = 0.05; bx < leaf; bx += 0.16) mt.box(0.025, 1.75, 0.025, C.sky, { p: [-bx, 1.0, 0] });
      for (let bx = 0.25; bx < leaf; bx += 0.48) mt.add(new THREE.TorusGeometry(0.1, 0.015, 3, 8), C.sky, { p: [-bx, 1.4, 0] });
    });
  }
  // Rusty street lamp bracket on the left pillar.
  ctx.b.metal.rod([-halfWidth - 0.1, 2.0, z + 0.2], [-halfWidth + 0.5, 2.6, z + 0.2], 0.025, C.black, 4);
}

/** External wooden staircase up the left house to a gallery along its second floor. */
function stairsAndGallery(ctx: WorldCtx, fa: Facade): void {
  const m = ctx.b.matte;
  const { x, width, bottomZ, topZ } = HOUSES.stairs;
  const g = HOUSES.gallery;
  const wood = "#8a5534";
  const steps = 13;
  const run = (bottomZ - topZ) / steps;
  const rise = g.y / steps;
  for (let i = 0; i < steps; i++) {
    m.box(width - 0.1, 0.06, run + 0.04, C.woodLight, { p: [x, rise * (i + 1) - 0.03, bottomZ - run * (i + 0.5)] });
  }
  const len = Math.hypot(bottomZ - topZ, g.y);
  const ang = Math.atan2(g.y, bottomZ - topZ);
  for (const sx of [x - width / 2 + 0.04, x + width / 2 - 0.04]) {
    m.box(0.07, 0.25, len, wood, { p: [sx, g.y / 2, (bottomZ + topZ) / 2], r: [ang, 0, 0] });
  }
  // Handrail on the open side.
  const hx = x + width / 2 - 0.04;
  for (let i = 0; i <= steps; i += 3) {
    const zz = bottomZ - run * i;
    m.box(0.06, 0.95, 0.06, wood, { p: [hx, rise * i + 0.48, zz] });
  }
  m.box(0.07, 0.06, len, wood, { p: [hx, g.y / 2 + 0.95, (bottomZ + topZ) / 2], r: [ang, 0, 0] });
  // Colliders: three stepped blocks under the flight.
  for (let k = 0; k < 3; k++) {
    const z0 = bottomZ - ((bottomZ - topZ) * k) / 3;
    const z1 = bottomZ - ((bottomZ - topZ) * (k + 1)) / 3;
    boxCollider(ctx, x, (z0 + z1) / 2, width, Math.abs(z1 - z0), g.y * ((k + 1) / 3));
  }

  // Gallery deck on posts, carved railing, lean-to tin roof.
  const gx0 = YARD.minX;
  const gx1 = YARD.minX + g.depth;
  const gcx = (gx0 + gx1) / 2;
  const glen = g.toZ - g.fromZ;
  const gcz = (g.fromZ + g.toZ) / 2;
  m.box(g.depth, 0.12, glen, C.woodLight, { p: [gcx, g.y - 0.06, gcz] });
  m.box(0.12, 0.2, glen, wood, { p: [gx1 - 0.06, g.y - 0.2, gcz] });
  ctx.rest.box(g.depth, 0.12, glen, "#fff", { p: [gcx, g.y - 0.06, gcz] });
  const roofY = lvl(2) - 0.15;
  for (let zz = g.toZ; zz >= g.fromZ - 0.01; zz -= glen / 4) {
    m.boxUp(0.12, roofY, 0.12, wood, { p: [gx1 - 0.08, 0, zz] });
    // Diagonal braces from the post up to the roof beam.
    for (const dz of [-0.4, 0.4]) {
      if (zz + dz > g.toZ + 0.01 || zz + dz < g.fromZ - 0.01) continue;
      m.rod([gx1 - 0.08, roofY - 0.55, zz], [gx1 - 0.08, roofY - 0.1, zz + dz], 0.035, wood, 4);
    }
    cylCollider(ctx, gx1 - 0.08, zz, 0.1, g.y);
  }
  m.box(0.12, 0.14, glen + 0.2, wood, { p: [gx1 - 0.08, roofY - 0.04, gcz] });
  const railH = 0.95;
  m.box(0.09, 0.07, glen, wood, { p: [gx1 - 0.06, g.y + railH, gcz] });
  ctx.rest.box(0.1, 0.07, glen, "#fff", { p: [gx1 - 0.06, g.y + railH, gcz] });
  for (let zz = g.fromZ + 0.1; zz < g.toZ - 0.05; zz += 0.15) {
    m.box(0.025, railH - 0.1, 0.07, wood, { p: [gx1 - 0.06, g.y + railH / 2, zz] });
    m.box(0.03, 0.09, 0.09, C.woodLight, { p: [gx1 - 0.06, g.y + railH / 2, zz], r: [Math.PI / 4, 0, 0] });
  }
  // Short end rail at the top of the stairs.
  m.box(gx1 - (x + width / 2), 0.07, 0.07, wood, { p: [(gx1 + x + width / 2) / 2, g.y + railH, g.toZ] });
  // Lean-to roof.
  const rl = g.depth + 0.4;
  ctx.b.metal.box(rl, 0.05, glen + 0.5, C.tin, { p: [gx0 + rl / 2, roofY + 0.18, gcz], r: [0, 0, -0.2] });
  ctx.rest.box(rl, 0.06, glen + 0.5, "#fff", { p: [gx0 + rl / 2, roofY + 0.22, gcz], r: [0, 0, -0.2] });
  for (let zz = g.fromZ; zz <= g.toZ + 0.01; zz += 0.2) {
    ctx.b.metal.box(rl, 0.04, 0.04, fa.rand() < 0.2 ? C.rust : "#b5bfbd", { p: [gx0 + rl / 2, roofY + 0.21, zz], r: [0, 0, -0.2] });
  }
  // A geranium or two and a tiny stool on the gallery.
  fa.geranium(gx1 - 0.25, g.y, -4.0 - 0.5);
  ctx.f.at({ p: [gx1 - 0.25, g.y, -6.4], r: [0, Math.PI / 2, 0] }, () => fa.geranium(0, 0, 0));
}

function buildTiles(ctx: WorldCtx, fa: Facade): void {
  if (fa.tiles.length === 0) return;
  const geo = new THREE.CylinderGeometry(0.11, 0.11, 0.34, 5, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2);
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1), 3));
  const mesh = new THREE.InstancedMesh(geo, materials().matte, fa.tiles.length);
  fa.tiles.forEach((t, i) => {
    mesh.setMatrixAt(i, t.m);
    mesh.setColorAt(i, t.c);
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = "roof-tiles";
  mesh.computeBoundingSphere();
  ctx.root.add(mesh);
}
