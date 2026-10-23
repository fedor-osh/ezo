// Worn courtyard floor: packed earth, a cobbled path from the gate, paving slabs along the houses,
// a drain, grass tufts in the corners and along the walls.
import * as THREE from "three";
import { HOUSES, SPOTS, YARD } from "../core/layout.ts";
import type { WorldCtx } from "./ctx.ts";
import { C, materials } from "./materials.ts";
import { rng } from "./kit.ts";

const noise2 = (x: number, z: number) =>
  Math.sin(x * 0.9 + z * 0.4) * 0.5 + Math.sin(x * 2.3 - z * 1.7 + 1.3) * 0.3 + Math.sin(x * 5.1 + z * 4.3 + 2.1) * 0.2;

export function buildGround(ctx: WorldCtx): void {
  const g = ctx.b.ground;
  const rand = rng(7);

  // Earth: one subdivided plane, colour varies with low-frequency noise and wear near the path.
  const plane = new THREE.PlaneGeometry(60, 60, 90, 90).rotateX(-Math.PI / 2);
  const pos = plane.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const earth = new THREE.Color(C.earth);
  const earthDark = new THREE.Color(C.earthDark);
  const asphalt = new THREE.Color("#8d8780");
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const inside = x > YARD.minX - 0.5 && x < YARD.maxX + 0.5 && z > YARD.minZ - 0.5 && z < YARD.maxZ;
    const n = noise2(x, z);
    c.copy(earth).lerp(earthDark, THREE.MathUtils.clamp(0.5 + n * 0.6, 0, 1));
    // Damp darker ring around the drain.
    const dd = Math.hypot(x - SPOTS.drain.center[0], z - SPOTS.drain.center[2]);
    if (dd < 1.6) c.lerp(new THREE.Color("#8d6c4c"), (1 - dd / 1.6) * 0.6);
    if (!inside) c.copy(asphalt).multiplyScalar(0.92 + n * 0.06);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
    pos.setY(i, inside ? -0.005 + n * 0.008 : -0.02);
  }
  plane.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.add(plane, null, undefined, 0.03);

  // Stone paving strip along the three facades.
  const slab = (x: number, z: number, w: number, d: number) =>
    g.boxUp(w - 0.04, 0.05, d - 0.04, rand() > 0.5 ? C.stone : "#b3aa9c", { p: [x, -0.02, z], r: [0, (rand() - 0.5) * 0.04, 0] });
  for (let x = YARD.minX + 0.5; x < YARD.maxX; x += 0.9) if (rand() > 0.12) slab(x, YARD.minZ + 0.5, 0.9, 1.0);
  for (let z = YARD.minZ + 1.4; z < YARD.maxZ - 0.3; z += 0.9) {
    if (rand() > 0.15 && (z > HOUSES.stairs.bottomZ + 0.3 || z < HOUSES.gallery.fromZ)) slab(YARD.minX + 0.45, z, 0.9, 0.9);
    if (rand() > 0.15) slab(YARD.maxX - 0.45, z, 0.9, 0.9);
  }

  // Drain: a square cast-iron grate with a stone frame.
  const [dx, , dz] = SPOTS.drain.center;
  g.boxUp(0.7, 0.04, 0.7, C.stoneDark, { p: [dx, -0.01, dz] });
  ctx.b.metal.boxUp(0.5, 0.03, 0.5, "#3b3836", { p: [dx, 0.0, dz] });
  for (let i = -2; i <= 2; i++) ctx.b.metal.boxUp(0.04, 0.035, 0.48, "#5a5551", { p: [dx + i * 0.1, 0.005, dz] });

  buildCobbles(ctx);
  buildGrass(ctx);
}

function buildCobbles(ctx: WorldCtx): void {
  const rand = rng(21);
  const spots: Array<[number, number]> = [];
  const keep = ctx.high ? 0.9 : 0.7;
  // Path from the gate to the back house door, wobbling a little.
  for (let z = YARD.maxZ + 3; z > YARD.minZ + 1.0; z -= 0.24) {
    const wob = Math.sin(z * 0.35) * 0.5;
    const halfW = 1.1 + Math.sin(z * 0.8) * 0.15;
    for (let x = -halfW; x <= halfW; x += 0.24) {
      const edge = Math.abs(x) / halfW;
      if (rand() < keep * (1 - edge * edge * 0.6)) spots.push([x + wob + (z * 4.1) % 0.12, z]);
    }
  }
  // Worn patch under the pergola.
  const [px, , pz] = SPOTS.pergola.center;
  const [pw, pd] = SPOTS.pergola.size;
  for (let x = px - pw / 2; x < px + pw / 2; x += 0.26) {
    for (let z = pz - pd / 2; z < pz + pd / 2; z += 0.26) {
      const r = Math.hypot((x - px) / (pw / 2), (z - pz) / (pd / 2));
      if (rand() < keep * (1.15 - r * 0.8)) spots.push([x, z]);
    }
  }

  const geo = new THREE.CylinderGeometry(0.105, 0.12, 0.06, 6);
  const mesh = new THREE.InstancedMesh(geo, materials().matte, spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const base = ["#b3a185", "#a6927a", "#bfae90", "#9c8a72", "#b9a07e"].map((h) => new THREE.Color(h));
  const c = new THREE.Color();
  spots.forEach(([x, z], i) => {
    q.setFromEuler(e.set((rand() - 0.5) * 0.08, rand() * Math.PI, (rand() - 0.5) * 0.08));
    const k = 0.8 + rand() * 0.4;
    s.set(k * (0.9 + rand() * 0.3), 0.7 + rand() * 0.6, k);
    mesh.setMatrixAt(i, m.compose(p.set(x, -0.012, z), q, s));
    mesh.setColorAt(i, c.copy(base[Math.floor(rand() * base.length)]).multiplyScalar(0.92 + rand() * 0.16));
  });
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = "cobbles";
  // Instanced meshes need vertex colours on: the matte material uses vertexColors, so give the geometry white ones.
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1), 3));
  mesh.computeBoundingSphere();
  ctx.root.add(mesh);
}

function buildGrass(ctx: WorldCtx): void {
  const rand = rng(33);
  const n = ctx.high ? 260 : 120;
  const blade = new THREE.ConeGeometry(0.03, 0.22, 3).translate(0, 0.11, 0);
  const tuft = new THREE.BufferGeometry();
  {
    // Five blades leaning outward = one tuft geometry.
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const b = blade.clone().toNonIndexed();
      b.rotateZ((rand() - 0.5) * 0.8).rotateY((i / 5) * Math.PI * 2).scale(1, 0.7 + rand() * 0.7, 1);
      b.translate(Math.cos(i) * 0.03, 0, Math.sin(i) * 0.03);
      parts.push(b);
    }
    const merged = mergeSimple(parts);
    tuft.copy(merged);
  }
  const color = new THREE.BufferAttribute(new Float32Array(tuft.attributes.position.count * 3), 3);
  const pos = tuft.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = 0.55 + pos.getY(i) * 2.2;
    color.setXYZ(i, k, k, k);
  }
  tuft.setAttribute("color", color);
  const mesh = new THREE.InstancedMesh(tuft, materials().matte, n);
  const m = new THREE.Matrix4();
  const greens = [new THREE.Color(C.vine), new THREE.Color(C.leafDark), new THREE.Color(C.leafLight), new THREE.Color("#9fae4c")];
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    let x: number;
    let z: number;
    const side = rand();
    // Mostly hugging the walls and corners, where feet do not reach.
    if (side < 0.3) {
      x = YARD.minX + 1.0 + rand() * 0.5;
      z = THREE.MathUtils.lerp(YARD.minZ, YARD.maxZ, rand());
    } else if (side < 0.6) {
      x = YARD.maxX - 1.0 - rand() * 0.5;
      z = THREE.MathUtils.lerp(YARD.minZ, YARD.maxZ, rand());
    } else if (side < 0.8) {
      x = THREE.MathUtils.lerp(YARD.minX, YARD.maxX, rand());
      z = YARD.minZ + 1.05 + rand() * 0.4;
    } else {
      // Around the fig tree and along the front wall.
      const a = rand() * Math.PI * 2;
      const r = 0.6 + rand() * 1.4;
      x = SPOTS.figTree.center[0] + Math.cos(a) * r;
      z = SPOTS.figTree.center[2] + Math.sin(a) * r;
      if (rand() < 0.4) {
        x = THREE.MathUtils.lerp(YARD.minX, YARD.maxX, rand());
        z = YARD.maxZ - 0.35 - rand() * 0.3;
        if (Math.abs(x) < HOUSES.gate.halfWidth) z -= 0.6;
      }
    }
    const k = 0.7 + rand() * 0.8;
    m.makeRotationY(rand() * 6.28).scale(new THREE.Vector3(k, k * (0.8 + rand() * 0.6), k)).setPosition(x, 0, z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.copy(greens[Math.floor(rand() * greens.length)]));
  }
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.name = "grass";
  mesh.computeBoundingSphere();
  ctx.root.add(mesh);
}

function mergeSimple(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let count = 0;
  for (const p of parts) count += p.attributes.position.count;
  const pos = new Float32Array(count * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array as Float32Array, o);
    o += p.attributes.position.count * 3;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
