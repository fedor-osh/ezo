// Grape-vine pergola over the supra table: posts, beams, a twisting old vine, an instanced leaf
// canopy, hanging grape bunches and churchkhela strings, all swaying with the shared wind.
import * as THREE from "three";
import { SPOTS } from "../core/layout.ts";
import { localCyl, type WorldCtx } from "./ctx.ts";
import { rng, tube, type Vec } from "./kit.ts";
import { C, materials } from "./materials.ts";
import { swayDriver, swayMaterial } from "./sway.ts";

export function leafGeometry(size = 0.13, lobes = 5): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const n = 30;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    // Lobed outline with a notch where the stem joins (a = -PI/2).
    const lobe = 0.72 + 0.28 * Math.abs(Math.cos((a + Math.PI / 2) * (lobes / 2)));
    const notch = 1 - 0.45 * Math.exp(-Math.pow((a - Math.PI * 1.5) * 3, 2));
    const r = size * lobe * notch;
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r + size * 0.55));
  }
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts), 1).rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, -(x * x) * 2.2 + Math.abs(z) * 0.05);
  }
  g.computeVertexNormals();
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(pos.count * 3).fill(1), 3));
  return g;
}

export function buildPergola(ctx: WorldCtx): void {
  const { center, size, height } = SPOTS.pergola;
  const [w, d] = size;
  const rand = rng(41);
  const rotY = SPOTS.table.rotationY;
  const wood = "#7b5236";

  const frame = { p: center as Vec, r: [0, rotY, 0] as Vec };
  const world = new THREE.Matrix4().compose(
    new THREE.Vector3(...center),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
    new THREE.Vector3(1, 1, 1),
  );

  ctx.f.at(frame, () => {
    const m = ctx.b.matte;
    const posts: Array<[number, number]> = [];
    for (const px of [-w / 2 + 0.1, 0, w / 2 - 0.1]) for (const pz of [-d / 2 + 0.1, d / 2 - 0.1]) posts.push([px, pz]);
    for (const [px, pz] of posts) {
      m.boxUp(0.13, height, 0.13, wood, { p: [px, 0, pz], r: [0, (rand() - 0.5) * 0.1, 0] });
      m.boxUp(0.22, 0.12, 0.22, C.stone, { p: [px, 0, pz] });
      localCyl(ctx, px, pz, 0.1, height);
    }
    // Beams and slats.
    for (const pz of [-d / 2 + 0.1, d / 2 - 0.1]) m.box(w + 0.3, 0.14, 0.12, wood, { p: [0, height + 0.02, pz] });
    for (let px = -w / 2; px <= w / 2 + 0.01; px += 0.6) m.box(0.08, 0.08, d + 0.3, "#8a6040", { p: [px, height + 0.13, 0] });
    ctx.rest.box(w, 0.1, d, "#fff", { p: [0, height + 0.35, 0] });

    // The old vine: a gnarled trunk spiralling up a corner post, branches running along the beams.
    const vine = "#6a4930";
    const trunk: Vec[] = [];
    const [tx, tz] = [-w / 2 + 0.1, d / 2 - 0.1];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const a = t * Math.PI * 3;
      trunk.push([tx + Math.cos(a) * 0.12 + 0.05, t * (height + 0.1), tz + Math.sin(a) * 0.12 - 0.05]);
    }
    m.add(tube(trunk, 0.055, 6), vine);
    const branches: Vec[][] = [
      [[tx, height + 0.1, tz], [-0.8, height + 0.22, d / 2 - 0.3], [0.9, height + 0.18, d / 2 - 0.2], [w / 2 - 0.1, height + 0.2, d / 2 - 0.4]],
      [[tx, height + 0.1, tz], [-w / 2 + 0.4, height + 0.2, 0], [-1.0, height + 0.24, -d / 2 + 0.4], [1.4, height + 0.2, -d / 2 + 0.2]],
      [[-1.2, height + 0.2, 0.2], [0, height + 0.26, -0.2], [1.5, height + 0.2, 0.4]],
    ];
    for (const b of branches) m.add(tube(b, 0.03, 5), vine);
  });

  // Instanced foliage, swaying with the wind.
  const u = swayDriver(ctx, new THREE.Vector3(center[0], height, center[2]), 0.035);
  const mats = materials();
  const leafMat = swayMaterial(mats.matte, u, { pivotY: height + 0.6, hang: 0.25, flutter: 0.018 });
  leafMat.side = THREE.DoubleSide;
  const nLeaves = ctx.high ? 720 : 360;
  const leaves = new THREE.InstancedMesh(leafGeometry(0.13), leafMat, nLeaves);
  const greens = ["#5f9b3a", "#4e8a32", "#73ad42", "#8cc152", "#3f7a2f", "#6aa23f"].map((c) => new THREE.Color(c));
  const autumn = ["#d9a43a", "#e0b84a", "#c97c2a"].map((c) => new THREE.Color(c));
  const mt = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pv = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const col = new THREE.Color();
  const clump = (x: number, z: number) => Math.sin(x * 2.1 + 1) * Math.cos(z * 2.7) + Math.sin(x * 5.3 - z * 3.1) * 0.5;
  let i = 0;
  while (i < nLeaves) {
    const kind = rand();
    let x: number;
    let y: number;
    let z: number;
    if (kind < 0.72) {
      // Canopy on top, patchy so sunlight dapples the table.
      x = (rand() - 0.5) * (w + 0.5);
      z = (rand() - 0.5) * (d + 0.4);
      if (clump(x, z) < -0.2 && rand() < 0.9) continue;
      y = height + 0.12 + rand() * 0.2;
      e.set((rand() - 0.5) * 0.9, rand() * Math.PI * 2, (rand() - 0.5) * 0.9);
    } else if (kind < 0.94) {
      // Hanging off the edges.
      const side = Math.floor(rand() * 4);
      const t = rand() - 0.5;
      x = side < 2 ? t * w : (side === 2 ? -1 : 1) * (w / 2 + 0.1);
      z = side < 2 ? (side === 0 ? -1 : 1) * (d / 2 + 0.05) : t * d;
      y = height - rand() * 0.55;
      e.set(1.1 + rand() * 0.5, rand() * Math.PI * 2, (rand() - 0.5) * 0.6);
    } else {
      // Along the trunk.
      const t = rand();
      x = -w / 2 + 0.1 + (rand() - 0.5) * 0.4;
      z = d / 2 - 0.1 + (rand() - 0.5) * 0.4;
      y = 0.6 + t * (height - 0.6);
      e.set(1.0 + rand() * 0.6, rand() * Math.PI * 2, 0);
    }
    pv.set(x, y, z).applyMatrix4(world);
    q.setFromEuler(e);
    const k = 0.75 + rand() * 0.6;
    sv.set(k, k, k);
    mt.compose(pv, q, sv);
    // Rotate the instance's frame into the pergola's yaw.
    mt.premultiply(new THREE.Matrix4().makeTranslation(-pv.x, -pv.y, -pv.z))
      .premultiply(new THREE.Matrix4().makeRotationY(rotY))
      .premultiply(new THREE.Matrix4().makeTranslation(pv.x, pv.y, pv.z));
    leaves.setMatrixAt(i, mt);
    col.copy(rand() < 0.08 ? autumn[Math.floor(rand() * autumn.length)] : greens[Math.floor(rand() * greens.length)]);
    leaves.setColorAt(i, col.multiplyScalar(0.9 + rand() * 0.2));
    i++;
  }
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  leaves.name = "vine-leaves";
  leaves.computeBoundingSphere();
  ctx.root.add(leaves);

  // Grape bunches and churchkhela strings share one instanced "hanging fruit" mesh.
  const fruitMat = swayMaterial(mats.glossy, u, { pivotY: height, hang: 0.55, flutter: 0.004 });
  const items: Array<{ p: THREE.Vector3; s: THREE.Vector3; c: THREE.Color }> = [];
  const bunches = ctx.high ? 18 : 11;
  const purple = ["#4b2353", "#5e2b62", "#3a1d44", "#6b3470"];
  const green = ["#b9c95a", "#a6bd4a", "#c8d26a"];
  for (let bI = 0; bI < bunches; bI++) {
    const bx = (rand() - 0.5) * (w - 0.6);
    const bz = (rand() - 0.5) * (d - 0.5);
    // Keep the bunches off the camera's line to the food: mostly near the edges of the table.
    const top = height - 0.02;
    const len = 0.22 + rand() * 0.12;
    const pal = rand() < 0.65 ? purple : green;
    const base = new THREE.Color(pal[Math.floor(rand() * pal.length)]);
    const rows = 6;
    for (let r = 0; r < rows; r++) {
      const t = r / (rows - 1);
      const rr = 0.075 * (1 - t * 0.75);
      const nRing = Math.max(1, Math.round(7 * (1 - t * 0.7)));
      for (let k = 0; k < nRing; k++) {
        const a = (k / nRing) * Math.PI * 2 + r * 0.7;
        const p = new THREE.Vector3(bx + Math.cos(a) * rr, top - 0.05 - t * len, bz + Math.sin(a) * rr).applyMatrix4(world);
        const gs = 0.022 + rand() * 0.006;
        items.push({ p, s: new THREE.Vector3(gs, gs * 1.1, gs), c: base.clone().multiplyScalar(0.85 + rand() * 0.3) });
      }
    }
    ctx.b.props.rod(
      new THREE.Vector3(bx, top + 0.05, bz).applyMatrix4(world).toArray() as Vec,
      new THREE.Vector3(bx, top - 0.06, bz).applyMatrix4(world).toArray() as Vec,
      0.008,
      "#6b5a2a",
      4,
    );
  }
  // Churchkhela: walnut strings dipped in thickened grape juice, hung to dry from the front beam.
  const churchColors = ["#7a2f2a", "#a8492b", "#c7712e", "#5a2222"];
  for (let s = 0; s < 5; s++) {
    const sx = 0.5 + s * 0.17;
    const sz = d / 2 - 0.1;
    const cc = new THREE.Color(churchColors[s % churchColors.length]);
    const lumps = 11;
    for (let k = 0; k < lumps; k++) {
      const p = new THREE.Vector3(sx + Math.sin(k * 2.1) * 0.006, height - 0.12 - k * 0.055, sz).applyMatrix4(world);
      items.push({ p, s: new THREE.Vector3(0.034, 0.042, 0.032), c: cc.clone().multiplyScalar(0.88 + rand() * 0.2) });
    }
    ctx.b.props.rod(
      new THREE.Vector3(sx, height + 0.02, sz).applyMatrix4(world).toArray() as Vec,
      new THREE.Vector3(sx, height - 0.1, sz).applyMatrix4(world).toArray() as Vec,
      0.006,
      "#e8dcc0",
      3,
    );
  }
  const grapeGeo = new THREE.IcosahedronGeometry(1, 1);
  grapeGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(grapeGeo.attributes.position.count * 3).fill(1), 3));
  const fruit = new THREE.InstancedMesh(grapeGeo, fruitMat, items.length);
  items.forEach((it, k) => {
    fruit.setMatrixAt(k, mt.compose(it.p, q.identity(), it.s));
    fruit.setColorAt(k, it.c);
  });
  fruit.castShadow = ctx.high;
  fruit.receiveShadow = true;
  fruit.name = "grapes-churchkhela";
  fruit.computeBoundingSphere();
  ctx.root.add(fruit);
}
