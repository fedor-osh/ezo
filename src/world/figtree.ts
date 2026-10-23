// Fig tree in the front-left corner: a multi-stem grey trunk, a rounded canopy of big lobed leaves
// (instanced, wind sway) and purple figs.
import * as THREE from "three";
import { SPOTS } from "../core/layout.ts";
import { localCyl, type WorldCtx } from "./ctx.ts";
import { rng, tube, type Vec } from "./kit.ts";
import { materials } from "./materials.ts";
import { leafGeometry } from "./pergola.ts";
import { swayDriver, swayMaterial } from "./sway.ts";

export function buildFigTree(ctx: WorldCtx): void {
  const c = SPOTS.figTree.center;
  const rand = rng(9);
  const bark = "#9a948a";
  const blobs: Array<{ p: THREE.Vector3; r: number }> = [];
  ctx.f.at({ p: c as Vec }, () => {
    const stems: Vec[][] = [
      [[0, 0, 0], [0.1, 0.9, 0.05], [0.4, 1.8, 0.2], [0.7, 2.6, 0.3]],
      [[0, 0, 0], [-0.15, 1.0, 0.1], [-0.5, 1.9, -0.2], [-0.8, 2.7, -0.3]],
      [[0, 0, 0], [0.05, 1.1, -0.15], [0.15, 2.1, -0.6], [0.2, 3.0, -0.7]],
      [[0.1, 1.4, 0.1], [0.3, 2.0, 0.7], [0.4, 2.6, 1.0]],
    ];
    stems.forEach((s, i) => ctx.b.matte.add(tube(s, i === 3 ? 0.05 : 0.09 - i * 0.01, 6), bark));
    ctx.b.matte.sphere(0.22, bark, { p: [0, 0.1, 0], s: [1.2, 0.6, 1.2] }, 1);
    const centres: Array<[number, number, number, number]> = [
      [0.7, 2.9, 0.3, 0.85], [-0.8, 2.9, -0.3, 0.85], [0.2, 3.3, -0.7, 0.8], [0.4, 2.8, 1.0, 0.7],
      [0, 3.5, 0.1, 0.9], [-0.3, 2.6, 0.6, 0.7], [0.9, 2.5, -0.5, 0.6],
    ];
    for (const [x, y, z, r] of centres) {
      ctx.b.matte.sphere(r * 0.82, "#3f7a2f", { p: [x, y, z], s: [1, 0.8, 1] }, 1);
      blobs.push({ p: new THREE.Vector3(...ctx.f.point([x, y, z])), r });
      ctx.rest.sphere(r * 0.85, "#fff", { p: [x, y + 0.1, z], s: [1, 0.8, 1] }, 0);
    }
    localCyl(ctx, 0, 0, 0.28, 2.2);
  });

  // Leaves scattered over the blob surfaces, facing outward.
  const u = swayDriver(ctx, new THREE.Vector3(c[0], 3, c[2]), 0.03);
  const mat = swayMaterial(materials().matte, u, { pivotY: 6, hang: 0.02, flutter: 0.03 });
  mat.side = THREE.DoubleSide;
  const n = ctx.high ? 420 : 200;
  const leaves = new THREE.InstancedMesh(leafGeometry(0.17, 3), mat, n);
  const figs: THREE.Vector3[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const col = new THREE.Color();
  const greens = ["#4e8a32", "#5f9b3a", "#3f7a2f", "#6aa23f", "#76a845"].map((h) => new THREE.Color(h));
  for (let i = 0; i < n; i++) {
    const b = blobs[Math.floor(rand() * blobs.length)];
    dir.set(rand() - 0.5, rand() - 0.25, rand() - 0.5).normalize();
    p.copy(b.p).addScaledVector(dir, b.r * (0.75 + rand() * 0.25));
    q.setFromUnitVectors(up, dir).multiply(new THREE.Quaternion().setFromAxisAngle(up, rand() * 6.28));
    const k = 0.8 + rand() * 0.5;
    m.compose(p, q, s.set(k, k, k));
    leaves.setMatrixAt(i, m);
    leaves.setColorAt(i, col.copy(greens[Math.floor(rand() * greens.length)]).multiplyScalar(0.85 + rand() * 0.3));
    if (rand() < 0.12) figs.push(p.clone().addScaledVector(dir, 0.05));
  }
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  leaves.name = "fig-leaves";
  leaves.computeBoundingSphere();
  ctx.root.add(leaves);
  for (const f of figs) ctx.b.soft.sphere(0.04, rand() < 0.7 ? "#5a2f5a" : "#7a8a3a", { p: f.toArray() as Vec, s: [1, 1.2, 1] }, 1);
  // A couple of fallen figs and a squashed one on the ground.
  for (let k = 0; k < 4; k++) {
    ctx.b.soft.sphere(0.04, "#5a2f5a", { p: [c[0] + (rand() - 0.5) * 2, 0.03, c[2] + (rand() - 0.5) * 2], s: [1, 0.7, 1] }, 1);
  }
}
