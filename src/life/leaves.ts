// Fallen autumn leaves: hundreds of tiny dynamic Rapier cuboids drawn as one InstancedMesh per
// species. Wind makes them skitter, pointer creatures blow them around, cats kick them up.
import * as THREE from "three";
import type * as RAPIER_NS from "@dimforge/rapier3d-compat";
import { SPOTS, YARD } from "../core/layout.ts";
import { flyers } from "../core/presence.ts";
import { $reducedMotion } from "../core/stores.ts";
import type { ColliderSpec, Engine } from "../core/types.ts";
import { gustiness, windAt } from "../core/wind.ts";
import { buildLeafGeometry, LEAF_RADIUS, LEAF_SHAPES } from "./leafShapes.ts";
import { obstacleAt, obstacleFromSpec, type Obstacle } from "./obstacles.ts";
import { GROUP, groups, type Physics } from "./physics.ts";

export interface Leaves {
  count: number;
  /**
   * Blow leaves away from a point: everything within `radius` gets a velocity kick of up to
   * `strength` m/s (falling off with distance), `up` of it upward.
   */
  disturb(x: number, y: number, z: number, radius: number, strength: number, up: number): void;
}

const HALF_THICK = 0.006;
const DENSITY = 40;
/** Fraction of leaves checked against the wind each frame. */
const WIND_SLICES = 10;
/** Gustiness below which the ground wind is too weak to move anything. */
const GUST_MIN = 0.7;
const FLYER_RADIUS = 1.2;
/** A leaf can't be re-kicked more often than this (s): stops hovering flyers from pinning leaves in the air. */
const KICK_COOLDOWN = 0.18;

const tmpV = new THREE.Vector3();
const tmpW = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpM = new THREE.Matrix4();
const tmpC = new THREE.Color();

interface SpawnPoint {
  x: number;
  y: number;
  z: number;
}

/** Seeded RNG so the yard looks the same on every visit. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Top surface of the collider that contains (x, z) and sits at furniture height, if any. */
function surfaceTop(obstacles: readonly Obstacle[], x: number, z: number): number | null {
  let best: number | null = null;
  for (const o of obstacles) {
    if (o.top < 0.3 || o.top > 2.2 || o.bottom > 1) continue;
    if (obstacleAt([o], x, z, -0.05) < 0) continue;
    if (best === null || o.top > best) best = o.top;
  }
  return best;
}

function planSpawns(n: number, specs: readonly ColliderSpec[], rng: () => number): SpawnPoint[] {
  // Anything the leaves could spawn inside of; leaves dropped onto tall things land on their tops.
  // (Flat things like paving or rugs, top < 0.12 m, don't count.)
  const solids = specs.map(obstacleFromSpec).filter((o) => o.bottom < 1.2 && o.top > 0.12);
  const inYard = (x: number, z: number) =>
    x > YARD.minX + 0.15 && x < YARD.maxX - 0.15 && z > YARD.minZ + 0.15 && z < YARD.maxZ - 0.15;
  const out: SpawnPoint[] = [];

  const tryAdd = (x: number, z: number, onTop = false): boolean => {
    if (!inYard(x, z)) return false;
    const top = surfaceTop(solids, x, z);
    if (onTop) {
      if (top === null) return false;
      out.push({ x, y: top + 0.05 + rng() * 0.25, z });
      return true;
    }
    // Ground spawns must not be inside or under a solid (they'd be stuck in it).
    if (obstacleAt(solids, x, z, 0.05) >= 0) return false;
    out.push({ x, y: 0.03 + rng() * 0.7, z });
    return true;
  };

  const disc = (cx: number, cz: number, radius: number, count: number, onTop = false) => {
    let made = 0;
    for (let tries = 0; made < count && tries < count * 8; tries++) {
      // Denser in the middle: piles, not carpets.
      const r = radius * Math.pow(rng(), 0.75);
      const a = rng() * Math.PI * 2;
      if (tryAdd(cx + Math.cos(a) * r, cz + Math.sin(a) * r, onTop)) made++;
    }
  };

  const along = (count: number) => {
    let made = 0;
    for (let tries = 0; made < count && tries < count * 8; tries++) {
      // Drifts against the walls, heavier in the corners.
      const side = Math.floor(rng() * 3); // back, left, right (the gate side stays swept)
      const t = rng();
      const corner = Math.pow(Math.abs(t * 2 - 1), 0.5);
      const depth = 0.15 + rng() * (0.4 + corner * 0.9);
      let x: number;
      let z: number;
      if (side === 0) {
        x = YARD.minX + (YARD.maxX - YARD.minX) * t;
        z = YARD.minZ + depth;
      } else {
        z = YARD.minZ + (YARD.maxZ - YARD.minZ) * t;
        x = side === 1 ? YARD.minX + depth : YARD.maxX - depth;
      }
      if (tryAdd(x, z)) made++;
    }
  };

  const [fx, , fz] = SPOTS.figTree.center;
  const [tx, , tz] = SPOTS.table.center;
  const [cx, , cz] = SPOTS.car.center;
  const [bx, , bz] = SPOTS.bench.center;
  const [ox, , oz] = SPOTS.tone.center;

  disc(fx, fz, 1.5, Math.round(n * 0.24));
  disc(fx + 0.9, fz - 0.7, 0.7, Math.round(n * 0.08));
  along(Math.round(n * 0.24));
  disc(tx, tz, 2.4, Math.round(n * 0.13));
  disc(tx, tz, 1.1, Math.round(n * 0.03), true);
  disc(cx, cz, 0.9, Math.round(n * 0.04), true);
  disc(bx, bz + 0.6, 1.4, Math.round(n * 0.05));
  disc(ox + 1, oz + 0.6, 1.2, Math.round(n * 0.04));
  // Strays everywhere else.
  while (out.length < n) {
    tryAdd(YARD.minX + rng() * (YARD.maxX - YARD.minX), YARD.minZ + rng() * (YARD.maxZ - YARD.minZ));
  }
  return out.slice(0, n);
}

export function createLeaves(engine: Engine, phys: Physics, specs: readonly ColliderSpec[]): Leaves {
  const { R, world } = phys;
  const high = engine.quality === "high";
  const n = high ? 600 : 250;
  const rng = mulberry32(0xe20);

  const spawns = planSpawns(n, specs, rng);

  // One InstancedMesh per species.
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true });
  const shapeOf = new Uint8Array(n);
  const counts = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const r = rng();
    const s = r < 0.36 ? 0 : r < 0.68 ? 1 : 2;
    shapeOf[i] = s;
    counts[s]++;
  }
  const meshes = LEAF_SHAPES.map((shape, s) => {
    const m = new THREE.InstancedMesh(buildLeafGeometry(shape, high ? 40 : 26, s + 1), material, counts[s]);
    m.name = `leaves-${shape.name}`;
    m.frustumCulled = false;
    // Flat leaves on the ground self-shadow into acne stripes; receiving is enough.
    m.castShadow = false;
    m.receiveShadow = true;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    engine.scene.add(m);
    return m;
  });

  const slot = new Uint16Array(n);
  const scale = new Float32Array(n);
  const mass = new Float32Array(n);
  const pos = new Float32Array(n * 3);
  const lastKick = new Float32Array(n).fill(-1);
  const lastDv = new Float32Array(n);
  const bodies: RAPIER_NS.RigidBody[] = [];
  const leafOfBody = new Map<number, number>();
  const leafOfCollider = new Map<number, number>();
  const filled = [0, 0, 0];
  const leafGroups = groups(GROUP.leaf, GROUP.static | GROUP.leaf | GROUP.cat);

  for (let i = 0; i < n; i++) {
    const s = shapeOf[i];
    slot[i] = filled[s]++;
    const sc = 0.75 + rng() * 0.6;
    scale[i] = sc;

    const shape = LEAF_SHAPES[s];
    tmpC.set(shape.palette[Math.floor(rng() * shape.palette.length)]);
    tmpC.offsetHSL((rng() - 0.5) * 0.04, (rng() - 0.5) * 0.15, (rng() - 0.5) * 0.12);
    meshes[s].setColorAt(slot[i], tmpC);

    const sp = spawns[i];
    // Mostly flat with a random yaw, some tilted so the pile layers nicely as they fall.
    tmpQ.setFromEuler(new THREE.Euler((rng() - 0.5) * 1.2, rng() * Math.PI * 2, (rng() - 0.5) * 1.2));
    const body = world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(sp.x, sp.y, sp.z)
        .setRotation({ x: tmpQ.x, y: tmpQ.y, z: tmpQ.z, w: tmpQ.w })
        .setLinearDamping(2.6)
        .setAngularDamping(2.2)
        .setGravityScale(0.7),
    );
    const hr = LEAF_RADIUS * sc * 0.82;
    const col = world.createCollider(
      R.ColliderDesc.cuboid(hr, HALF_THICK, hr)
        .setDensity(DENSITY)
        .setFriction(0.6)
        .setRestitution(0)
        .setCollisionGroups(leafGroups),
      body,
    );
    bodies.push(body);
    mass[i] = body.mass();
    leafOfBody.set(body.handle, i);
    leafOfCollider.set(col.handle, i);
    pos[i * 3] = sp.x;
    pos[i * 3 + 1] = sp.y;
    pos[i * 3 + 2] = sp.z;
  }
  for (const m of meshes) if (m.instanceColor) m.instanceColor.needsUpdate = true;

  const writeInstance = (i: number, body: RAPIER_NS.RigidBody) => {
    const t = body.translation();
    const r = body.rotation();
    pos[i * 3] = t.x;
    pos[i * 3 + 1] = t.y;
    pos[i * 3 + 2] = t.z;
    tmpV.set(t.x, t.y, t.z);
    tmpQ.set(r.x, r.y, r.z, r.w);
    tmpS.setScalar(scale[i]);
    tmpM.compose(tmpV, tmpQ, tmpS);
    const m = meshes[shapeOf[i]];
    m.setMatrixAt(slot[i], tmpM);
    m.instanceMatrix.needsUpdate = true;
  };

  const respawn = (i: number, body: RAPIER_NS.RigidBody) => {
    const sp = spawns[Math.floor(rng() * spawns.length)];
    body.setTranslation({ x: sp.x, y: Math.max(sp.y, 0.4) + 0.5, z: sp.z }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    writeInstance(i, body);
  };

  // Let everything fall into place before the first frame, then put it to sleep.
  phys.simulate(120);
  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    const t = b.translation();
    if (t.y < -0.5 || !Number.isFinite(t.y)) respawn(i, b);
    writeInstance(i, b);
    const v = b.linvel();
    if (Math.hypot(v.x, v.y, v.z) < 0.15) b.sleep();
  }

  let now = 0;
  const impulse = { x: 0, y: 0, z: 0 };
  const torque = { x: 0, y: 0, z: 0 };
  const kick = (i: number, dvx: number, dvy: number, dvz: number, spin: number) => {
    const m = mass[i];
    impulse.x = dvx * m;
    impulse.y = dvy * m;
    impulse.z = dvz * m;
    const b = bodies[i];
    b.applyImpulse(impulse, true);
    if (spin > 0) {
      // Inertia of a thin plate is tiny; scale torque by mass·r² so spin is in rad/s.
      const k = m * (LEAF_RADIUS * scale[i]) ** 2 * 0.3;
      torque.x = (rng() - 0.5) * spin * k;
      torque.y = (rng() - 0.5) * spin * k * 0.5;
      torque.z = (rng() - 0.5) * spin * k;
      b.applyTorqueImpulse(torque, true);
    }
  };

  const ball = new R.Ball(1);
  const ident = { x: 0, y: 0, z: 0, w: 1 };
  const queryGroups = groups(0xffff, GROUP.leaf);
  const center = { x: 0, y: 0, z: 0 };

  const disturb: Leaves["disturb"] = (x, y, z, radius, strength, up) => {
    if (strength <= 0.05) return;
    ball.radius = radius;
    center.x = x;
    center.y = y;
    center.z = z;
    world.intersectionsWithShape(
      center,
      ident,
      ball,
      (c) => {
        const i = leafOfCollider.get(c.handle);
        if (i === undefined) return true;
        const dx = pos[i * 3] - x;
        const dy = pos[i * 3 + 1] - y;
        const dz = pos[i * 3 + 2] - z;
        const d = Math.hypot(dx, dy, dz);
        const f = 1 - (d / radius) ** 2;
        if (f <= 0) return true;
        const dv = strength * f * (0.6 + rng() * 0.6);
        if (dv < 0.12) return true;
        // Cooldown, unless this kick is clearly stronger than the last one (the flyer came closer).
        if (now - lastKick[i] < KICK_COOLDOWN && dv < lastDv[i] * 1.5) return true;
        lastKick[i] = now;
        lastDv[i] = dv;
        const h = Math.hypot(dx, dz) || 1;
        kick(i, (dx / h) * dv, dv * up * (0.5 + rng()), (dz / h) * dv, dv * 6);
        return true;
      },
      undefined,
      queryGroups,
    );
  };

  let windCursor = 0;
  const windSlice = Math.ceil(n / WIND_SLICES);

  phys.onFrame((dt, t) => {
    now = t;
    const calm = $reducedMotion.get();

    // Wind: only gusts move ground leaves, and only a rotating slice of them per frame.
    const g = gustiness(t);
    if (g > GUST_MIN) {
      const sliceDt = dt * WIND_SLICES;
      for (let k = 0; k < windSlice; k++) {
        const i = windCursor;
        windCursor = (windCursor + 1) % n;
        const y = pos[i * 3 + 1];
        // Only leaves lying on something: airborne ones are handled by the drift below.
        if (y > 1.6 || !bodies[i].isSleeping() && Math.abs(bodies[i].linvel().y) > 0.1) continue;
        tmpV.set(pos[i * 3], y, pos[i * 3 + 2]);
        windAt(tmpV, t, tmpW);
        const ws = Math.hypot(tmpW.x, tmpW.z);
        const excess = ws - 0.5;
        if (excess <= 0 || rng() > Math.min(1, excess * 1.2) * sliceDt * 3) continue;
        const push = (0.35 + excess * 1.1) * (0.5 + rng() * 0.8) * (calm ? 0.5 : 1);
        let lift = 0;
        if (!calm && excess > 0.35 && rng() < excess * 0.25) lift = Math.min(3.2, 1 + excess * 1.2 + rng());
        kick(i, (tmpW.x / ws) * push, lift + push * 0.15, (tmpW.z / ws) * push, lift > 0 ? 9 : 3);
      }
    }

    // Pointer creatures: a butterfly's flapping or a low-flying leaf blows leaves aside.
    for (const fl of flyers.values()) {
      const p = fl.position;
      if (p.y > 2.4 || fl.perched) continue;
      // Butterflies flap even when hovering; a leaf pointer only pushes by moving.
      const speed = fl.velocity.length() + (fl.kind === "butterfly" ? 1.6 : 0.3);
      // Closer to the ground = stronger downdraft on the leaves.
      const low = 1 - Math.min(1, Math.max(0, p.y - 0.25) / 2.2);
      const strength = Math.min(calm ? 0.9 : 3.4, speed * 0.75) * low;
      disturb(p.x, p.y, p.z, calm ? FLYER_RADIUS * 0.7 : FLYER_RADIUS, strength, calm ? 0.2 : 0.6);
    }
  });

  // Airborne leaves drift with the wind and flutter; resting ones are left alone so they can sleep.
  const lv = { x: 0, y: 0, z: 0 };
  phys.onAfterSteps((dt, t) => {
    const calm = $reducedMotion.get();
    world.forEachActiveRigidBody((body) => {
      const i = leafOfBody.get(body.handle);
      if (i === undefined) return;
      const tr = body.translation();
      if (
        tr.y < -1 ||
        tr.y > 9 ||
        tr.x < YARD.minX - 0.3 ||
        tr.x > YARD.maxX + 0.3 ||
        tr.z < YARD.minZ - 0.3 ||
        tr.z > YARD.maxZ + 0.3 ||
        !Number.isFinite(tr.y)
      ) {
        respawn(i, body);
        return;
      }
      writeInstance(i, body);
      if (tr.y < 0.1) return;
      const v = body.linvel();
      if (Math.abs(v.y) < 0.12) return;
      tmpV.set(tr.x, tr.y, tr.z);
      windAt(tmpV, t, tmpW);
      const k = Math.min(1, dt * (calm ? 0.8 : 1.6));
      lv.x = (tmpW.x - v.x) * k;
      lv.y = Math.sin(t * 7 + i) * dt * 1.2;
      lv.z = (tmpW.z - v.z) * k;
      kick(i, lv.x, lv.y, lv.z, calm ? 0 : 1.5);
    });
  });

  return { count: n, disturb };
}
