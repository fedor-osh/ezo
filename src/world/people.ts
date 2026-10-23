// The old folks: two grandmothers on the bench (one knitting, one watching the visitor when the
// "about" section is open) and two grandpas playing nardi. Stylised capsules and spheres; each
// animated part is one merged mesh, so a person costs ~5 draws.
import * as THREE from "three";
import { SPOTS } from "../core/layout.ts";
import { $reducedMotion, $section } from "../core/stores.ts";
import { localBox, type WorldCtx } from "./ctx.ts";
import { Batch, rng, type Col, type Vec } from "./kit.ts";
import { C, materials } from "./materials.ts";
import { nardiTexture } from "./textures.ts";

interface Look {
  top: Col;
  bottom: Col;
  legs: Col;
  shoes: Col;
  skin: Col;
  hair: Col;
  scarf?: Col;
  scarfDots?: Col;
  cap?: Col;
  glasses?: boolean;
  moustache?: boolean;
  bald?: boolean;
  width?: number;
}

interface Person {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
}

const capsule = (b: Batch, a: Vec, c: Vec, r: number, color: Col) => {
  b.rod(a, c, r, color, 8, 0);
  b.sphere(r, color, { p: a }, 1, 0);
  b.sphere(r, color, { p: c }, 1, 0);
};

/** Seated person. Local origin = seat surface under the pelvis, facing +Z. */
function person(look: Look, seatH: number, rand: () => number): Person {
  const mat = materials().soft;
  const W = look.width ?? 1;
  const root = new THREE.Group();
  const mk = (b: Batch, parent: THREE.Object3D, name: string) => {
    const mesh = b.build(mat, { cast: true, receive: true, name });
    mesh.matrixAutoUpdate = true;
    parent.add(mesh);
    return mesh;
  };

  // Lower body: lap, legs, shoes (static).
  const low = new Batch(Math.floor(rand() * 1000), 0);
  low.sphere(1, look.bottom, { p: [0, 0.07, 0.06], s: [0.21 * W, 0.11, 0.24] }, 2);
  for (const sx of [-1, 1]) {
    capsule(low, [sx * 0.1 * W, 0.07, 0.02], [sx * 0.1 * W, 0.08, 0.34], 0.075, look.bottom);
    capsule(low, [sx * 0.1 * W, 0.04, 0.37], [sx * 0.1 * W, -seatH + 0.08, 0.4], 0.05, look.legs);
    low.sphere(1, look.shoes, { p: [sx * 0.1 * W, -seatH + 0.04, 0.45], s: [0.06, 0.045, 0.1] }, 1);
  }
  mk(low, root, "legs");

  // Torso: breathing pivot at the hips.
  const torso = new THREE.Group();
  torso.position.set(0, 0.06, -0.02);
  root.add(torso);
  const tb = new Batch(Math.floor(rand() * 1000), 0);
  const prof: Array<[number, number]> = [
    [0.001, 0],
    [0.19 * W, 0.02],
    [0.21 * W, 0.14],
    [0.2 * W, 0.28],
    [0.17 * W, 0.4],
    [0.1 * W, 0.49],
    [0.05, 0.52],
    [0.001, 0.53],
  ];
  tb.add(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 14), look.top, { s: [1, 1, 0.82] }, 0);
  // Cardigan opening and buttons.
  tb.box(0.03, 0.34, 0.01, new THREE.Color(look.top).multiplyScalar(0.75), { p: [0, 0.22, 0.17 * W] }, 0);
  for (let k = 0; k < 4; k++) tb.sphere(0.012, "#e8dcc0", { p: [0.025, 0.1 + k * 0.08, 0.172 * W] }, 0);
  tb.cyl(0.05, 0.055, 0.08, 8, look.skin, { p: [0, 0.54, 0.0] });
  mk(tb, torso, "torso");

  // Head with face; pivot at the neck.
  const head = new THREE.Group();
  head.position.set(0, 0.56, 0.01);
  torso.add(head);
  const hb = new Batch(Math.floor(rand() * 1000), 0);
  const hr = 0.125;
  hb.sphere(hr, look.skin, { p: [0, hr, 0], s: [1, 1.05, 1] }, 3);
  hb.sphere(0.03, look.skin, { p: [0, hr - 0.01, hr - 0.005], s: [1, 1.1, 1] }, 1);
  for (const sx of [-1, 1]) {
    hb.sphere(0.013, "#2a211c", { p: [sx * 0.045, hr + 0.025, hr - 0.02] }, 1);
    hb.sphere(0.022, "#f29a8e", { p: [sx * 0.07, hr - 0.02, hr - 0.035], s: [1, 0.7, 0.5] }, 1);
    hb.sphere(0.025, look.skin, { p: [sx * hr, hr, 0], s: [0.5, 1, 0.8] }, 1);
  }
  hb.box(0.04, 0.008, 0.01, "#9a4a42", { p: [0, hr - 0.06, hr - 0.015] }, 0);
  if (look.glasses) {
    for (const sx of [-1, 1]) hb.add(new THREE.TorusGeometry(0.026, 0.004, 4, 12), "#3a3030", { p: [sx * 0.045, hr + 0.025, hr + 0.005] }, 0);
    hb.box(0.025, 0.005, 0.005, "#3a3030", { p: [0, hr + 0.03, hr + 0.005] }, 0);
  }
  if (look.moustache) hb.sphere(1, look.hair, { p: [0, hr - 0.035, hr - 0.01], s: [0.055, 0.017, 0.025] }, 1);
  if (look.scarf) {
    // Headscarf: a shell open at the face, knotted under the chin.
    const shell = new THREE.SphereGeometry(hr + 0.018, 16, 10, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.72);
    hb.add(shell, look.scarf, { p: [0, hr + 0.005, -0.004] }, 0);
    hb.add(new THREE.SphereGeometry(hr + 0.02, 16, 6, 0, Math.PI * 2, 0, Math.PI * 0.27), look.scarf, { p: [0, hr + 0.005, -0.004] }, 0);
    hb.sphere(0.028, look.scarf, { p: [0, hr - 0.115, 0.06] }, 1);
    hb.add(new THREE.ConeGeometry(0.06, 0.16, 4), look.scarf, { p: [0, hr - 0.06, -hr - 0.01], r: [-0.4, 0, 0] }, 0);
    if (look.scarfDots) {
      for (let k = 0; k < 18; k++) {
        const th = 0.25 + rand() * 1.5;
        const ph = Math.PI / 2 + 1.1 + rand() * (Math.PI * 2 - 2.2);
        const r = hr + 0.022;
        hb.sphere(0.011, look.scarfDots, { p: [-r * Math.cos(ph) * Math.sin(th), hr + 0.005 + r * Math.cos(th), r * Math.sin(ph) * Math.sin(th) - 0.004] }, 0);
      }
    }
    hb.sphere(1, look.hair, { p: [0, hr + 0.085, hr - 0.05], s: [0.07, 0.025, 0.03] }, 1);
  } else if (look.cap) {
    hb.cyl(hr + 0.01, hr + 0.025, 0.06, 14, look.cap, { p: [0, hr + 0.075, -0.01], r: [-0.12, 0, 0] });
    hb.cyl(hr + 0.03, hr + 0.03, 0.02, 14, look.cap, { p: [0, hr + 0.1, 0.0], s: [1, 1, 1], r: [-0.12, 0, 0] });
    hb.box(0.17, 0.015, 0.09, new THREE.Color(look.cap).multiplyScalar(0.8), { p: [0, hr + 0.06, hr + 0.04], r: [0.15, 0, 0] }, 0);
    hb.sphere(1, look.hair, { p: [0, hr - 0.02, -0.06], s: [hr * 1.02, 0.06, 0.08] }, 1);
  } else if (look.bald) {
    for (const sx of [-1, 1]) hb.sphere(1, look.hair, { p: [sx * 0.105, hr + 0.01, -0.03], s: [0.03, 0.05, 0.07] }, 1);
    hb.sphere(1, look.hair, { p: [0, hr, -0.105], s: [0.08, 0.05, 0.03] }, 1);
  }
  mk(hb, head, "head");

  // Arms, pivoting at the shoulders.
  const arm = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.19 * W, 0.42, 0.0);
    torso.add(g);
    const ab = new Batch(Math.floor(rand() * 1000), 0);
    capsule(ab, [0, 0, 0], [side * 0.03, -0.22, 0.06], 0.05, look.top);
    capsule(ab, [side * 0.03, -0.22, 0.06], [-side * 0.07, -0.26, 0.28], 0.045, look.top);
    ab.sphere(0.042, look.skin, { p: [-side * 0.09, -0.26, 0.31] }, 1);
    mk(ab, g, side < 0 ? "armL" : "armR");
    return g;
  };
  return { root, torso, head, armL: arm(-1), armR: arm(1) };
}

const LOOKS: Record<string, Look> = {
  knitter: { top: "#8e3b46", bottom: "#3b3346", legs: "#7a5a4a", shoes: "#2a2224", skin: C.skin, hair: "#d8d4ce", scarf: "#2f2a44", scarfDots: "#e8b84a", width: 1.08 },
  watcher: { top: "#5a7f6a", bottom: "#4a3a3a", legs: "#6e5546", shoes: "#2a2224", skin: "#f0c4a2", hair: "#e6e2dc", scarf: "#f3eee4", scarfDots: "#d2394a", glasses: true },
  grandpa: { top: "#5f5a55", bottom: "#3a3a40", legs: "#3a3a40", shoes: "#2b2320", skin: C.skinDark, hair: "#cfcac2", cap: "#4a4440", moustache: true },
  neighbour: { top: "#6d7f98", bottom: "#4c4640", legs: "#4c4640", shoes: "#2b2320", skin: "#eab794", hair: "#e9e6e1", bald: true, glasses: true, width: 1.05 },
};

export function buildPeople(ctx: WorldCtx): void {
  const rand = rng(88);
  const reduce = () => $reducedMotion.get();

  // --- The bench and the grandmothers.
  const { center, length } = SPOTS.bench;
  const seatH = 0.46;
  ctx.f.at({ p: center as Vec, r: [0, SPOTS.bench.rotationY, 0] }, () => {
    const m = ctx.b.matte;
    for (let k = 0; k < 3; k++) m.box(length, 0.04, 0.12, "#9a6a43", { p: [0, seatH - 0.02, -0.15 + k * 0.14] });
    for (let k = 0; k < 2; k++) m.box(length, 0.1, 0.035, "#9a6a43", { p: [0, seatH + 0.25 + k * 0.17, -0.27], r: [-0.12, 0, 0] });
    for (const sx of [-1, 0, 1]) {
      const x = sx * (length / 2 - 0.15);
      ctx.b.metal.box(0.05, seatH, 0.05, "#3a3a38", { p: [x, seatH / 2, 0.12] });
      ctx.b.metal.box(0.05, seatH + 0.55, 0.05, "#3a3a38", { p: [x, (seatH + 0.55) / 2, -0.25], r: [-0.12, 0, 0] });
      ctx.b.metal.box(0.05, 0.05, 0.42, "#3a3a38", { p: [x, seatH - 0.06, -0.05] });
    }
    localBox(ctx, 0, -0.05, length, 0.5, 0.95);
    ctx.rest.box(length, 0.06, 0.4, "#fff", { p: [0, seatH, -0.02] });
    // Sunflower seeds in a paper cone and the yarn ball.
    ctx.b.soft.sphere(0.07, "#d6334a", { p: [-0.05, seatH + 0.06, 0.02] }, 2);
    ctx.b.props.add(new THREE.ConeGeometry(0.05, 0.14, 8), "#e8dcc0", { p: [0.95, seatH + 0.05, 0.02], r: [Math.PI, 0, 0.3] });
    // A pair of slippers someone kicked off.
    ctx.b.soft.sphere(1, "#c45a6a", { p: [0.15, 0.03, 0.45], s: [0.05, 0.03, 0.1], r: [0, 0.4, 0] }, 1);
  });

  const knitter = person(LOOKS.knitter, seatH, rand);
  const watcher = person(LOOKS.watcher, seatH, rand);
  const benchMatrix = (x: number) =>
    new THREE.Matrix4().compose(
      new THREE.Vector3(center[0] + x, seatH, center[2] - 0.02),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, SPOTS.bench.rotationY, 0)),
      new THREE.Vector3(1, 1, 1),
    );
  knitter.root.applyMatrix4(benchMatrix(-0.5));
  watcher.root.applyMatrix4(benchMatrix(0.45));
  watcher.root.rotation.y += -0.15;
  ctx.root.add(knitter.root, watcher.root);

  // Knitting: needles and a striped scarf held in front, attached to the arms.
  const nb = new Batch(5, 0);
  nb.rod([0, 0, 0], [0.12, 0.09, 0.08], 0.005, "#d9d9d9", 4);
  const needleL = nb.build(materials().metal, { name: "needle" });
  needleL.matrixAutoUpdate = true;
  needleL.position.set(0.09, -0.26, 0.31);
  knitter.armL.add(needleL);
  const needleR = needleL.clone();
  needleR.position.set(-0.09, -0.26, 0.31);
  needleR.rotation.y = Math.PI;
  knitter.armR.add(needleR);
  const sb = new Batch(6, 0);
  const stripes = ["#f2b134", "#3f9c94", "#d6334a", "#f7f3ea"];
  for (let k = 0; k < 8; k++) sb.box(0.16, 0.025, 0.012, stripes[k % 4], { p: [0, -k * 0.025, 0] }, 0);
  const scarf = sb.build(materials().soft, { name: "knitting" });
  scarf.matrixAutoUpdate = true;
  scarf.position.set(0.1, -0.28, 0.33);
  scarf.rotation.x = -0.5;
  knitter.armL.add(scarf);

  // --- Nardi table with grandpa and his neighbour.
  const n = SPOTS.nardi;
  const tableH = 0.62;
  const stoolH = 0.42;
  let checker: THREE.Mesh | null = null;
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  ctx.f.at({ p: n.center as Vec, r: [0, n.rotationY, 0] }, () => {
    const m = ctx.b.matte;
    m.box(0.62, 0.04, 0.52, "#b07a48", { p: [0, tableH - 0.02, 0] });
    for (const s of [-1, 1]) {
      m.box(0.035, tableH * 1.15, 0.035, "#7a4e2f", { p: [0, tableH / 2, s * 0.18], r: [0.0, 0, s * 0.55] });
      m.box(0.035, tableH * 1.15, 0.035, "#7a4e2f", { p: [0, tableH / 2, s * 0.18], r: [0.0, 0, -s * 0.55] });
    }
    // Opened nardi box: two wooden halves with the painted board as a texture.
    m.box(0.52, 0.03, 0.3, "#7b4a2a", { p: [0, tableH + 0.015, 0] });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.28).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: nardiTexture(), roughness: 0.6 }));
    board.applyMatrix4(ctx.f.top.clone().multiply(new THREE.Matrix4().makeTranslation(0, tableH + 0.032, 0)));
    board.matrixAutoUpdate = false;
    board.updateMatrix();
    board.receiveShadow = true;
    ctx.root.add(board);
    // Checkers stacked on their points.
    const pt = (i: number, top: boolean): [number, number] => {
      const half = i < 6 ? -1 : 1;
      const k = i % 6;
      return [half * 0.012 + (half < 0 ? -0.237 : 0.013) + k * 0.0384 + 0.019, top ? -0.11 : 0.11];
    };
    const stacks: Array<[number, boolean, number, string]> = [
      [0, true, 3, "#f3ede0"], [5, false, 4, "#f3ede0"], [7, true, 3, "#3a2a26"], [11, false, 5, "#3a2a26"],
      [11, true, 4, "#f3ede0"], [4, true, 2, "#3a2a26"], [2, false, 3, "#3a2a26"], [8, false, 2, "#f3ede0"],
    ];
    for (const [i, top, count, col] of stacks) {
      const [x, z] = pt(i, top);
      for (let k = 0; k < count; k++) ctx.b.soft.cyl(0.017, 0.017, 0.009, 12, col, { p: [x, tableH + 0.037, z + (top ? 1 : -1) * k * 0.035] });
    }
    // Two dice.
    ctx.b.soft.box(0.022, 0.022, 0.022, "#fbf8f0", { p: [0.06, tableH + 0.044, 0.02], r: [0, 0.4, 0] }, 0);
    ctx.b.soft.box(0.022, 0.022, 0.022, "#fbf8f0", { p: [0.1, tableH + 0.044, -0.03], r: [0, 1.1, 0] }, 0);
    // A glass of tea in a podstakannik for the neighbour.
    ctx.b.metal.cyl(0.03, 0.026, 0.07, 10, "#b8a26a", { p: [0.27, tableH + 0.035, 0.18] });
    ctx.b.glossy.cyl(0.026, 0.026, 0.02, 10, "#9a3a1a", { p: [0.27, tableH + 0.075, 0.18] });
    from.fromArray(ctx.f.point([pt(4, true)[0], tableH + 0.037, pt(4, true)[1] + 0.07]));
    to.fromArray(ctx.f.point([pt(9, true)[0], tableH + 0.037, pt(9, true)[1]]));
    // Stools.
    for (const s of [-1, 1]) {
      ctx.b.matte.cyl(0.16, 0.16, 0.05, 10, "#8b5a3a", { p: [s * 0.62, stoolH - 0.025, 0] });
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        ctx.b.matte.rod([s * 0.62 + Math.cos(a) * 0.07, stoolH - 0.04, Math.sin(a) * 0.07], [s * 0.62 + Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15], 0.02, "#7a4e2f", 5);
      }
    }
    localBox(ctx, 0, 0, 0.62, 0.52, tableH);
    localBox(ctx, -0.62, 0, 0.36, 0.36, stoolH);
    localBox(ctx, 0.62, 0, 0.36, 0.36, stoolH);
    ctx.rest.box(0.62, 0.04, 0.52, "#fff", { p: [0, tableH, 0] });
  });
  const cgeo = new THREE.CylinderGeometry(0.017, 0.017, 0.009, 12);
  cgeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(cgeo.attributes.position.count * 3).fill(0.95), 3));
  checker = new THREE.Mesh(cgeo, materials().soft);
  checker.castShadow = true;
  checker.position.copy(from);
  ctx.root.add(checker);

  const grandpa = person(LOOKS.grandpa, stoolH, rand);
  const neighbour = person(LOOKS.neighbour, stoolH, rand);
  const seat = (x: number, faceYaw: number) =>
    new THREE.Matrix4()
      .makeRotationY(n.rotationY)
      .setPosition(n.center[0], 0, n.center[2])
      .multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, stoolH, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, faceYaw, 0)), new THREE.Vector3(1, 1, 1)));
  grandpa.root.applyMatrix4(seat(-0.62, Math.PI / 2));
  neighbour.root.applyMatrix4(seat(0.62, -Math.PI / 2));
  // Hands resting on the table edge.
  for (const p of [grandpa, neighbour]) {
    p.armL.rotation.x = -0.55;
    p.armR.rotation.x = -0.55;
    p.torso.rotation.x = 0.12;
  }
  ctx.root.add(grandpa.root, neighbour.root);

  // --- Animation.
  const camLocal = new THREE.Vector3();
  let watcherYaw = 0;
  const people = [knitter, watcher, grandpa, neighbour];
  const phase = people.map(() => rand() * 10);
  const MOVE_EVERY = 7;
  const MOVE_DUR = 1.6;
  ctx.update((dt, t) => {
    const still = reduce();
    people.forEach((p, i) => {
      if (!still) {
        p.torso.scale.y = 1 + Math.sin(t * 1.7 + phase[i]) * 0.012;
        p.head.rotation.x = Math.sin(t * 0.6 + phase[i]) * 0.05 + (i === 0 ? 0.25 : 0);
      }
    });
    if (!still) {
      // Knitting needles click-clack.
      knitter.armL.rotation.x = -0.25 + Math.sin(t * 7) * 0.07;
      knitter.armR.rotation.x = -0.25 + Math.sin(t * 7 + Math.PI) * 0.07;
      knitter.armL.rotation.z = Math.sin(t * 3.5) * 0.04;
      neighbour.head.rotation.y = Math.sin(t * 0.3) * 0.25;
    }
    // The watcher turns to the visitor when "about" is open; otherwise glances at the knitting.
    let targetYaw = -0.35 + (still ? 0 : Math.sin(t * 0.25) * 0.15);
    if ($section.get() === "about") {
      watcher.head.updateWorldMatrix(true, false);
      camLocal.copy(ctx.engine.camera.position);
      watcher.torso.worldToLocal(camLocal);
      targetYaw = THREE.MathUtils.clamp(Math.atan2(camLocal.x, camLocal.z), -1.1, 1.1);
    }
    watcherYaw = THREE.MathUtils.damp(watcherYaw, targetYaw, 3, dt);
    watcher.head.rotation.y = watcherYaw;
    watcher.head.rotation.z = -watcherYaw * 0.1;

    // Grandpa moves a checker now and then: reach, lift, arc, put down.
    if (!checker) return;
    const cycle = t % (MOVE_EVERY * 2);
    const forward = cycle < MOVE_EVERY;
    const local = (forward ? cycle : cycle - MOVE_EVERY) / MOVE_DUR;
    const a = forward ? from : to;
    const b = forward ? to : from;
    if (still || local >= 1) {
      checker.position.copy(b);
      grandpa.armR.rotation.x = -0.55;
      return;
    }
    const reach = Math.sin(Math.min(1, local) * Math.PI);
    grandpa.armR.rotation.x = -0.55 - reach * 0.55;
    grandpa.armR.rotation.z = -reach * 0.2;
    const mv = THREE.MathUtils.smoothstep(local, 0.25, 0.8);
    checker.position.lerpVectors(a, b, mv);
    checker.position.y += Math.sin(mv * Math.PI) * 0.08;
  });
}
