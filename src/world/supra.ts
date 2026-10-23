// The supra table: the close-up hero of the "work" shot. Embroidered tablecloth, puri, khachapuri
// adjaruli, khinkali, churchkhela, tomatoes and cucumbers, herbs, a clay doqi with amber wine.
import * as THREE from "three";
import { SPOTS } from "../core/layout.ts";
import { localBox, type WorldCtx } from "./ctx.ts";
import { rng, type Vec } from "./kit.ts";
import { C, materials } from "./materials.ts";
import { tableclothTexture } from "./textures.ts";
import * as food from "./food.ts";

export function buildSupra(ctx: WorldCtx): void {
  const { center, size, top, rotationY } = SPOTS.table;
  const [L, D] = size;
  const rand = rng(77);
  ctx.f.at({ p: center as Vec, r: [0, rotationY, 0] }, () => {
    table(ctx, L, D, top);
    seats(ctx, L, D, rand);
    ctx.f.at({ p: [0, top + 0.006, 0] }, () => spread(ctx, rand));
    localBox(ctx, 0, 0, L, D, top);
    ctx.rest.box(L, 0.04, D, "#fff", { p: [0, top + 0.02, 0] });
  });
}

function table(ctx: WorldCtx, L: number, D: number, top: number): void {
  const m = ctx.b.matte;
  const wood = "#7a4e2f";
  m.box(L, 0.05, D, wood, { p: [0, top - 0.025, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.boxUp(0.07, top - 0.05, 0.07, wood, { p: [sx * (L / 2 - 0.12), 0, sz * (D / 2 - 0.1)] });
  // Tablecloth: textured top + plain drapes with a red hem.
  const overhang = 0.08;
  const cl = L + overhang * 2;
  const cd = D + overhang * 2;
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(cl, cd).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: tableclothTexture(), roughness: 0.95 }),
  );
  cloth.applyMatrix4(ctx.f.top.clone().multiply(new THREE.Matrix4().makeTranslation(0, top + 0.004, 0)));
  cloth.matrixAutoUpdate = false;
  cloth.updateMatrix();
  cloth.receiveShadow = true;
  cloth.name = "tablecloth";
  ctx.root.add(cloth);
  const drop = 0.24;
  const b = ctx.b.matte;
  for (const sz of [-1, 1]) {
    b.box(cl, drop, 0.01, "#f6f1e6", { p: [0, top - drop / 2 + 0.004, sz * (cd / 2)] }, 0.01);
    b.box(cl, 0.03, 0.012, "#c62f3f", { p: [0, top - drop + 0.03, sz * (cd / 2)] }, 0);
  }
  for (const sx of [-1, 1]) {
    b.box(0.01, drop, cd, "#f6f1e6", { p: [sx * (cl / 2), top - drop / 2 + 0.004, 0] }, 0.01);
    b.box(0.012, 0.03, cd, "#c62f3f", { p: [sx * (cl / 2), top - drop + 0.03, 0] }, 0);
  }
}

function chair(ctx: WorldCtx, x: number, z: number, rotY: number, color: string, back = true): void {
  ctx.f.at({ p: [x, 0, z], r: [0, rotY, 0] }, () => {
    const m = ctx.b.matte;
    const s = 0.42;
    m.box(s, 0.05, s, color, { p: [0, 0.45, 0] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.boxUp(0.045, 0.43, 0.045, color, { p: [sx * (s / 2 - 0.04), 0, sz * (s / 2 - 0.04)] });
    m.box(s - 0.1, 0.03, 0.03, color, { p: [0, 0.18, s / 2 - 0.04] });
    if (back) {
      for (const sx of [-1, 1]) m.boxUp(0.045, 0.5, 0.045, color, { p: [sx * (s / 2 - 0.04), 0.47, -s / 2 + 0.04] });
      m.box(s, 0.12, 0.035, color, { p: [0, 0.88, -s / 2 + 0.04] });
      m.box(0.1, 0.1, 0.03, "#e8c07a", { p: [0, 0.88, -s / 2 + 0.02], r: [0, 0, Math.PI / 4] });
      m.box(s - 0.08, 0.04, 0.03, color, { p: [0, 0.66, -s / 2 + 0.04] });
    }
    localBox(ctx, 0, 0, s, s, back ? 0.95 : 0.47);
  });
}

function seats(ctx: WorldCtx, L: number, D: number, rand: () => number): void {
  const cols = ["#8b5a3a", "#4f8f8a", "#7a4e2f", "#a8613d"];
  chair(ctx, -0.6, -D / 2 - 0.32, 0.05, cols[0]);
  chair(ctx, 0.5, -D / 2 - 0.3, -0.08, cols[1]);
  chair(ctx, L / 2 + 0.35, 0.05, -Math.PI / 2 + 0.1, cols[2]);
  chair(ctx, -L / 2 - 0.42, -0.3, Math.PI / 2 - 0.35, cols[3]);
  // On the camera side: one chair pulled out and turned, as if someone just got up for more wine.
  chair(ctx, 1.05, D / 2 + 0.5, Math.PI + 0.5, cols[1]);
  // And a little stool.
  ctx.f.at({ p: [1.55, 0, -0.75] }, () => {
    ctx.b.matte.cyl(0.17, 0.17, 0.05, 10, cols[0], { p: [0, 0.42, 0] });
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + rand();
      ctx.b.matte.rod([Math.cos(a) * 0.08, 0.42, Math.sin(a) * 0.08], [Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16], 0.02, cols[0], 5);
    }
    ctx.colliders.push({ shape: "cylinder", position: ctx.f.point([0, 0.22, 0]) as Vec, radius: 0.18, halfHeight: 0.22 });
  });
}

/** Everything on the table, in a frame whose y = 0 is the tablecloth. */
function spread(ctx: WorldCtx, rand: () => number): void {
  const soft = ctx.b.soft;
  const glossy = ctx.b.glossy;
  const white = "#fbfaf6";

  // Khachapuri adjaruli on a wooden board, the hero in the middle.
  ctx.f.at({ p: [0.02, 0, 0.04], r: [0, 0.25, 0] }, () => {
    ctx.b.matte.box(0.5, 0.025, 0.26, "#b07a48", { p: [0, 0.0125, 0] });
    ctx.b.matte.box(0.08, 0.02, 0.05, "#b07a48", { p: [0.29, 0.0125, 0] });
    ctx.f.at({ p: [0, 0.025, 0] }, () => {
      soft.add(food.khachapuriBoat(0.44, 0.22), null);
      soft.add(food.cheesePool(0.44, 0.22), null);
      glossy.sphere(0.04, "#ff9a00", { p: [0.01, 0.062, 0], s: [1, 0.6, 1] }, 2);
      glossy.sphere(0.065, "#fff4d6", { p: [0.01, 0.06, 0], s: [1, 0.1, 0.8] }, 2);
      glossy.box(0.04, 0.025, 0.035, "#fff1a0", { p: [-0.075, 0.07, 0.015], r: [0.1, 0.4, 0.05] });
    });
  });

  // Puri: a stack on a wicker tray, plus one on the cloth, torn.
  ctx.f.at({ p: [-0.6, 0, -0.18], r: [0, -0.15, 0] }, () => {
    ctx.b.matte.cyl(0.26, 0.24, 0.03, 14, "#c79a5c", { p: [0, 0.015, 0], s: [1.25, 1, 0.8] });
    ctx.b.matte.add(new THREE.TorusGeometry(0.29, 0.022, 5, 24).rotateX(Math.PI / 2), "#a97a43", { p: [0, 0.03, 0], s: [1.05, 1, 0.68] });
    soft.add(food.puri(0.46, 0.14, 0.075), null, { p: [0, 0.03, -0.06], r: [0, 0.1, 0] });
    soft.add(food.puri(0.44, 0.13, 0.07), null, { p: [0.02, 0.03, 0.08], r: [0, -0.12, 0] });
    soft.add(food.puri(0.42, 0.13, 0.07), null, { p: [0, 0.085, 0.01], r: [0, 0.5, 0.06] });
  });
  soft.add(food.puri(0.3, 0.13, 0.07), null, { p: [-0.18, 0, 0.36], r: [0, 0.9, 0] });
  // The torn-off end, showing pale crumb.
  soft.add(food.puri(0.14, 0.12, 0.06), null, { p: [-0.36, 0, 0.42], r: [0, 1.4, 0] });
  soft.sphere(0.03, "#f6e6c2", { p: [-0.3, 0.035, 0.4], s: [1.2, 0.8, 1] }, 1);

  // Khinkali on a plate, topknots up, black pepper on the side.
  ctx.f.at({ p: [0.58, 0, -0.16] }, () => {
    glossy.add(food.plate(0.17), white);
    const kg = food.khinkali(0.05);
    const spots: Array<[number, number]> = [[0, 0], [0.09, 0.02], [-0.08, 0.05], [0.03, -0.09], [-0.05, -0.07], [0.07, 0.09], [-0.1, -0.02]];
    for (const [x, z] of spots) soft.add(kg.clone(), null, { p: [x, 0.008, z], r: [0, rand() * 6, (rand() - 0.5) * 0.15] });
    for (let k = 0; k < 10; k++) soft.sphere(0.003, "#222", { p: [0.12 + rand() * 0.03, 0.012, -0.08 + rand() * 0.04] }, 0);
  });

  // Tomatoes, cucumbers and radishes.
  ctx.f.at({ p: [-0.42, 0, 0.2] }, () => {
    glossy.add(food.plate(0.16), "#f4f1e8");
    const tg = food.tomato(0.042);
    const cal = food.calyx(0.022);
    const tPos: Array<[number, number]> = [[-0.05, -0.04], [0.04, -0.06], [0.0, 0.05]];
    for (const [x, z] of tPos) {
      glossy.add(tg.clone(), rand() < 0.3 ? "#e8462c" : "#d8282c", { p: [x, 0.008, z] });
      ctx.b.props.add(cal.clone(), C.leafDark, { p: [x, 0.008 + 0.068, z], r: [0, rand() * 3, 0] });
    }
    // Half a tomato, cut side up.
    glossy.sphere(0.04, "#d8282c", { p: [0.09, 0.012, 0.04], s: [1, 0.45, 1] }, 2);
    soft.cyl(0.036, 0.036, 0.004, 12, "#f06a4f", { p: [0.09, 0.03, 0.04] });
    soft.add(food.cucumber(0.15, 0.021), null, { p: [0.05, 0.03, 0.09], r: [0, 0.6, 0] });
    soft.add(food.cucumber(0.14, 0.02), null, { p: [-0.07, 0.03, 0.08], r: [0, -0.3, 0] });
    for (let k = 0; k < 4; k++) soft.cyl(0.019, 0.019, 0.006, 10, "#cfe39a", { p: [0.11 - k * 0.012, 0.015 + k * 0.002, -0.05 + k * 0.025], r: [0.4, 0, 0.3] });
  });

  // Herbs: tarragon, cilantro, purple basil and spring onions on a long plate.
  ctx.f.at({ p: [0.38, 0, 0.3], r: [0, 0.2, 0] }, () => {
    glossy.add(food.plate(0.15), "#f4f1e8", { s: [1.3, 1, 0.8] });
    const blades = (cx: number, color: string, n: number, len: number) => {
      for (let k = 0; k < n; k++) {
        const z = (rand() - 0.5) * 0.06;
        ctx.b.props.box(len, 0.004, 0.012, color, { p: [cx + (rand() - 0.5) * 0.03, 0.015 + k * 0.003, z], r: [0, (rand() - 0.5) * 0.4, 0] }, 0.08);
      }
    };
    blades(-0.08, "#2f6b2a", 9, 0.16);
    for (let k = 0; k < 12; k++) ctx.b.props.sphere(0.014, rand() < 0.5 ? "#5fa83c" : "#7cbd4a", { p: [0.0 + (rand() - 0.5) * 0.06, 0.02 + rand() * 0.015, (rand() - 0.5) * 0.08] }, 0);
    for (let k = 0; k < 9; k++) ctx.b.props.sphere(0.013, rand() < 0.5 ? "#5b2b5e" : "#6e3a6e", { p: [0.08 + (rand() - 0.5) * 0.05, 0.02 + rand() * 0.012, (rand() - 0.5) * 0.07] }, 0);
    for (let k = 0; k < 4; k++) {
      const z = -0.04 + k * 0.025;
      soft.rod([-0.14, 0.014, z], [-0.05, 0.016, z + 0.005], 0.006, "#f2f2e6", 5);
      soft.rod([-0.05, 0.016, z + 0.005], [0.12, 0.02, z + 0.02], 0.005, "#5ca83a", 5);
    }
  });

  // Churchkhela cut into rounds + a whole string, and pkhali with pomegranate seeds.
  ctx.f.at({ p: [0.98, 0, -0.22] }, () => {
    glossy.add(food.plate(0.14), "#f4f1e8");
    const cc = ["#7a2f2a", "#a8492b", "#5a2222"];
    for (let k = 0; k < 9; k++) {
      soft.sphere(0.022, cc[k % 3], { p: [-0.09 + k * 0.023, 0.03, Math.sin(k * 0.9) * 0.02], s: [1, 0.95, 1.1] }, 1);
    }
    for (let k = 0; k < 5; k++) {
      const a = k * 1.25;
      soft.cyl(0.022, 0.022, 0.012, 9, cc[k % 3], { p: [Math.cos(a) * 0.06, 0.016, 0.05 + Math.sin(a) * 0.03] });
      soft.cyl(0.011, 0.011, 0.013, 7, "#e6cf9a", { p: [Math.cos(a) * 0.06, 0.017, 0.05 + Math.sin(a) * 0.03] });
    }
  });
  ctx.f.at({ p: [0.98, 0, 0.22] }, () => {
    glossy.add(food.plate(0.13), "#f4f1e8");
    const pk = [["#3f7a33", -0.04, -0.03], ["#3f7a33", 0.04, -0.035], ["#8e2350", 0.0, 0.04], ["#8e2350", -0.06, 0.04], ["#c06b2a", 0.06, 0.04]] as const;
    for (const [c, x, z] of pk) {
      soft.sphere(0.03, c, { p: [x, 0.03, z], s: [1, 0.85, 1] }, 2);
      for (let k = 0; k < 3; k++) glossy.sphere(0.006, "#e21b3c", { p: [x + (rand() - 0.5) * 0.02, 0.056, z + (rand() - 0.5) * 0.02] }, 0);
      soft.box(0.012, 0.003, 0.012, "#e8e0c8", { p: [x + 0.01, 0.055, z], r: [0, rand(), 0] });
    }
  });

  // Sulguni cheese wedges.
  ctx.f.at({ p: [-0.98, 0, 0.3] }, () => {
    glossy.add(food.plate(0.12), "#f4f1e8");
    for (let k = 0; k < 4; k++) soft.box(0.08, 0.02, 0.05, "#fbf3dc", { p: [(k - 1.5) * 0.03, 0.02 + k * 0.004, (k % 2) * 0.02], r: [0, 0.5 + k * 0.3, 0.1] }, 0.02);
  });

  // The doqi, glasses of amber qvevri wine, and a kantsi drinking horn.
  ctx.f.at({ p: [-0.98, 0, -0.26] }, () => {
    soft.add(food.doqi(), null);
    soft.add(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI * 1.2).rotateZ(-0.3), "#a84e2a", { p: [-0.1, 0.19, 0], s: [0.9, 1.1, 1] });
  });
  const glassMat = materials().clearGlass;
  const glasses: THREE.BufferGeometry[] = [];
  const glassSpots: Array<[number, number, number]> = [[-0.82, 0.12, 0.6], [-0.24, -0.4, 0.55], [0.22, 0.44, 0.7], [0.8, 0.05, 0.4], [0.36, -0.42, 0.65]];
  for (const [x, z, fill] of glassSpots) {
    const h = 0.11;
    const g = new THREE.CylinderGeometry(0.034, 0.028, h, 14, 1, true).translate(0, h / 2, 0);
    g.applyMatrix4(ctx.f.top.clone().multiply(new THREE.Matrix4().makeTranslation(x, 0, z)));
    glasses.push(g);
    glossy.cyl(0.031, 0.026, h * fill, 14, "#d9801c", { p: [x, (h * fill) / 2 + 0.003, z] });
    glossy.cyl(0.03, 0.03, 0.006, 12, "#e8962c", { p: [x, h * fill + 0.003, z] });
  }
  const glassMesh = new THREE.Mesh(mergeGeos(glasses), glassMat);
  glassMesh.name = "wine-glasses";
  glassMesh.renderOrder = 2;
  ctx.root.add(glassMesh);
  soft.add(food.horn(), null, { p: [-0.75, 0.025, -0.05], r: [0, 0.4, 0.05] });
  ctx.b.metal.add(new THREE.TorusGeometry(0.032, 0.004, 4, 12).rotateY(Math.PI / 2), C.chrome, {
    p: new THREE.Vector3(...food.hornPoints()[10].toArray()).applyEuler(new THREE.Euler(0, 0.4, 0.05)).add(new THREE.Vector3(-0.75, 0.025, -0.05)).toArray() as Vec,
    r: [0, 0.4, 0],
  });

  // Plates set for the guests, with forks and napkins.
  const settings: Array<[number, number, number]> = [[-0.35, -0.42, 0], [0.1, -0.44, 0], [-0.62, 0.42, Math.PI], [0.75, 0.44, Math.PI]];
  for (const [x, z, r] of settings) {
    ctx.f.at({ p: [x, 0, z], r: [0, r, 0] }, () => {
      glossy.add(food.plate(0.11), white);
      ctx.b.metal.box(0.006, 0.004, 0.15, C.chrome, { p: [0.14, 0.004, 0] });
      ctx.b.props.box(0.09, 0.006, 0.09, "#e9d9b0", { p: [-0.15, 0.004, 0], r: [0, 0.3, 0] }, 0);
    });
  }
  // A pomegranate and a couple of walnuts left about.
  glossy.sphere(0.045, "#b3203a", { p: [0.25, 0.042, -0.3] }, 2);
  ctx.b.props.cyl(0.012, 0.008, 0.02, 6, "#8a3a2a", { p: [0.25, 0.09, -0.3] });
  for (const [x, z] of [[-0.05, 0.4], [-0.02, 0.43]]) soft.sphere(0.018, "#a87a4a", { p: [x, 0.016, z] }, 1);
}

function mergeGeos(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let count = 0;
  for (const g of list) count += (g.index ? g.index.count : g.attributes.position.count);
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  let o = 0;
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.set(g.attributes.position.array as Float32Array, o);
    nor.set(g.attributes.normal.array as Float32Array, o);
    o += g.attributes.position.count * 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.computeBoundingSphere();
  return out;
}
