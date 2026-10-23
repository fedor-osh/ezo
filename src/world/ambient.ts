// Small signs of life: pigeons on the parapet that hop now and then, a TV flickering behind one
// window, a Wi-Fi router blinking in another.
import * as THREE from "three";
import { HOUSES, YARD } from "../core/layout.ts";
import { $reducedMotion } from "../core/stores.ts";
import type { WorldCtx } from "./ctx.ts";
import type { Facade } from "./facade.ts";
import { Batch, rng } from "./kit.ts";
import { materials } from "./materials.ts";

export function buildAmbient(ctx: WorldCtx, fa: Facade): void {
  pigeons(ctx);
  tv(ctx, fa);
  router(ctx, fa);
}

function pigeonGeometry(): THREE.BufferGeometry {
  const b = new Batch(3, 0);
  const grey = "#8f95a3";
  b.sphere(1, grey, { p: [0, 0.09, 0], s: [0.07, 0.065, 0.11] }, 2);
  b.sphere(0.045, "#7d8392", { p: [0, 0.17, 0.08] }, 1);
  b.sphere(1, "#6f9a8a", { p: [0, 0.135, 0.06], s: [0.045, 0.035, 0.03] }, 1);
  b.add(new THREE.ConeGeometry(0.012, 0.03, 4).rotateX(Math.PI / 2), "#c9a46a", { p: [0, 0.165, 0.135] });
  b.sphere(0.008, "#e2552a", { p: [0.03, 0.18, 0.105] }, 0);
  b.sphere(0.008, "#e2552a", { p: [-0.03, 0.18, 0.105] }, 0);
  b.box(0.08, 0.02, 0.1, "#5f6573", { p: [0, 0.1, -0.12], r: [0.3, 0, 0] });
  for (const s of [-1, 1]) {
    b.sphere(1, "#a7adb9", { p: [s * 0.055, 0.1, -0.01], s: [0.02, 0.05, 0.1] }, 1);
    b.box(0.01, 0.04, 0.01, "#d06a5a", { p: [s * 0.025, 0.02, 0.01] });
  }
  return b.geometry();
}

function pigeons(ctx: WorldCtx): void {
  const geo = pigeonGeometry();
  // On the pink house parapet (back right), facing the yard.
  const y = HOUSES.plinth + 2 * HOUSES.floor + 0.25 + 0.51;
  const z = YARD.minZ + 0.05;
  const n = 5;
  const rand = rng(31);
  const mesh = new THREE.InstancedMesh(geo, materials().soft, n);
  mesh.castShadow = true;
  mesh.name = "pigeons";
  const birds = Array.from({ length: n }, (_, i) => ({
    x: 4.2 + i * 0.75 + rand() * 0.3,
    yaw: (rand() - 0.5) * 0.8,
    hopAt: 2 + rand() * 8,
    hopFrom: 0,
    hopTo: 0,
    peck: rand() * 10,
  }));
  for (const b of birds) b.hopFrom = b.hopTo = b.x;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  const write = (t: number) => {
    birds.forEach((b, i) => {
      let hop = 0;
      let x = b.hopTo;
      const k = (t - b.hopAt) / 0.45;
      if (k >= 0 && k < 1) {
        x = THREE.MathUtils.lerp(b.hopFrom, b.hopTo, k);
        hop = Math.sin(k * Math.PI) * 0.12;
      }
      const peck = Math.max(0, Math.sin(t * 1.3 + b.peck)) > 0.97 ? 0.35 : 0;
      q.setFromEuler(e.set(peck, b.yaw, 0));
      mesh.setMatrixAt(i, m.compose(p.set(x, y + hop, z), q, s));
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  write(0);
  mesh.computeBoundingSphere();
  ctx.root.add(mesh);
  ctx.update((_dt, t) => {
    if ($reducedMotion.get()) return;
    for (const b of birds) {
      if (t > b.hopAt + 0.45) {
        b.hopFrom = b.hopTo;
        b.hopTo = THREE.MathUtils.clamp(b.hopTo + (rand() - 0.5) * 0.9, 3.8, 9.6);
        b.yaw = (b.hopTo - b.hopFrom) * 1.2 + (rand() - 0.5) * 0.6;
        b.hopAt = t + 3 + rand() * 9;
      }
    }
    write(t);
  });
}

/** A TV glowing behind the net curtain: a plane inside the window whose colour flickers. */
function tv(ctx: WorldCtx, fa: Facade): void {
  const mark = fa.marks.get("tv");
  if (!mark) return;
  const mat = new THREE.MeshBasicMaterial({ color: "#7fb0ff", transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(mark.w - 0.15, mark.h * 0.6), mat);
  mesh.position.set(...mark.pos);
  mesh.position.y -= mark.h * 0.12;
  mesh.rotation.y = mark.yaw;
  mesh.translateZ(-0.003);
  mesh.name = "tv-glow";
  ctx.root.add(mesh);
  const base = new THREE.Color("#6f9cff");
  const warm = new THREE.Color("#ffd2a0");
  let next = 0;
  ctx.update((_dt, t) => {
    if ($reducedMotion.get()) return;
    if (t < next) return;
    next = t + 0.08 + Math.random() * 0.25;
    mat.color.copy(base).lerp(warm, Math.random() * 0.6);
    mat.opacity = 0.3 + Math.random() * 0.35;
  });
}

/** Wi-Fi router on a windowsill (inside), its LEDs blinking. */
function router(ctx: WorldCtx, fa: Facade): void {
  const mark = fa.marks.get("router");
  if (!mark) return;
  const group = new THREE.Group();
  group.position.set(...mark.pos);
  group.rotation.y = mark.yaw;
  group.position.y += -mark.h / 2 + 0.03;
  // Sits on the sill, against the glass.
  const b = new Batch(8, 0);
  b.box(0.26, 0.05, 0.14, "#f2f2ee", { p: [0.15, 0.025, 0.09] });
  for (const x of [0.05, 0.25]) b.box(0.015, 0.18, 0.015, "#e6e6e0", { p: [x, 0.13, 0.04], r: [0, 0, x < 0.1 ? 0.2 : -0.2] });
  const body = b.build(materials().soft, { cast: false, name: "router" });
  body.matrixAutoUpdate = true;
  group.add(body);
  const leds: THREE.MeshBasicMaterial[] = [];
  for (let k = 0; k < 4; k++) {
    const mat = new THREE.MeshBasicMaterial({ color: k === 0 ? "#3cff7a" : "#7affb0", toneMapped: false });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.01, 0.005), mat);
    led.position.set(0.08 + k * 0.035, 0.03, 0.162);
    group.add(led);
    leds.push(mat);
  }
  ctx.root.add(group);
  const on = new THREE.Color("#3cff7a");
  const off = new THREE.Color("#1a3a22");
  ctx.update((_dt, t) => {
    const still = $reducedMotion.get();
    leds.forEach((mat, k) => {
      const lit = k === 0 || still || Math.sin(t * (9 + k * 5.3) + k * 2) + Math.sin(t * (3.1 + k)) > 0.2;
      mat.color.copy(lit ? on : off);
    });
  });
}
