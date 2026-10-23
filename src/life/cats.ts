// Three yard cats. The brain (catBrain.ts) decides what to do, this controller turns that into
// motion (steering, hops onto the car/bench), poses, a kinematic Rapier body that shoves leaves,
// and extra leaf kicks when they sprint through a pile.
import * as THREE from "three";
import type * as RAPIER_NS from "@dimforge/rapier3d-compat";
import { SPOTS, YARD } from "../core/layout.ts";
import { flyers } from "../core/presence.ts";
import { $reducedMotion } from "../core/stores.ts";
import type { ColliderSpec, Engine } from "../core/types.ts";
import { createBrain, updateBrain, type CatBrain, type Spot, type ThreatPoint } from "./catBrain.ts";
import { applyPose, buildCat, COATS, restingPose, type CatPose, type CatRig } from "./catModel.ts";
import type { Leaves } from "./leaves.ts";
import {
  clearance,
  groundObstacles,
  obstacleFromSpec,
  resolvePenetration,
  signedDistance,
  type Obstacle,
} from "./obstacles.ts";
import { GROUP, groups, type Physics } from "./physics.ts";
import { fleeDesire, steer } from "./steering.ts";

const RADIUS = 0.2;
const WALK = 0.42;
const RUN = 3.1;
const RUN_CALM = 1.1;
const SCALE = 1.15;

interface Hop {
  fx: number;
  fy: number;
  fz: number;
  tx: number;
  ty: number;
  tz: number;
  t: number;
  dur: number;
  h: number;
  /** Obstacle we land on top of, or -1 for the ground. */
  onto: number;
}

interface Cat {
  rig: CatRig;
  brain: CatBrain;
  body: RAPIER_NS.RigidBody;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  phase: number;
  /** Index into `tops` of the obstacle we're standing on, -1 = ground. */
  on: number;
  hop: Hop | null;
  /** Small vertical bounce when startled (visual only). */
  bounce: number;
  pose: CatPose;
  seed: number;
}

interface ElevatedSpot extends Spot {
  /** Index of the obstacle the spot is on top of. */
  top: number;
}

const tmpTarget = restingPose();

function angleTo(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function buildSpots(walkable: readonly Obstacle[], tops: readonly Obstacle[]): Array<Spot | ElevatedSpot> {
  const spots: Array<Spot | ElevatedSpot> = [];
  const bounds = YARD;
  const ground = (x: number, z: number, cosy: boolean) => {
    if (clearance(walkable, bounds, x, z) < RADIUS + 0.15) return;
    spots.push({ x, z, y: 0, elevated: false, cosy });
  };
  const [tx, , tz] = SPOTS.table.center;
  const [ox, , oz] = SPOTS.tone.center;
  const [fx, , fz] = SPOTS.figTree.center;
  // Under the table (only if the world modelled it with legs, not as a solid block).
  ground(tx + 0.3, tz - 0.1, true);
  // Warm spot by the clay oven.
  ground(ox + 1.25, oz + 0.9, true);
  // Sun patches.
  ground(0.6, 2.4, true);
  ground(2.8, -3.2, true);
  ground(-0.8, -5.6, true);
  ground(7.6, -2.2, true);
  ground(-4.6, -3.6, false);
  ground(fx + 1.2, fz - 1.4, false);
  ground(1.2, 6.2, false);
  ground(-5.5, 6.4, false);
  ground(8.4, 6.6, false);

  // Up on the Zhiguli's roof and the bench, if the world gave us colliders for them.
  const onTop = (cx: number, cz: number, minY: number, maxY: number, cosy: boolean) => {
    let best = -1;
    for (let i = 0; i < tops.length; i++) {
      const o = tops[i];
      if (o.top < minY || o.top > maxY || signedDistance(o, cx, cz) > -0.15) continue;
      if (best < 0 || o.top > tops[best].top) best = i;
    }
    if (best >= 0) spots.push({ x: cx, z: cz, y: tops[best].top, elevated: true, cosy, top: best });
  };
  onTop(SPOTS.car.center[0], SPOTS.car.center[2], 0.7, 1.55, true);
  const bench = SPOTS.bench.center;
  onTop(bench[0] - 0.7, bench[2], 0.3, 0.75, false);
  return spots;
}

export function createCats(engine: Engine, phys: Physics, specs: readonly ColliderSpec[], leaves: Leaves): void {
  const { R, world } = phys;
  const walkable = groundObstacles(specs);
  // Everything with a top surface a cat could hop onto.
  const tops = specs.map(obstacleFromSpec).filter((o) => o.bottom < 0.4 && o.top > 0.3 && o.top < 1.6);
  const spots = buildSpots(walkable, tops);
  const shadows = engine.quality === "high";
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });

  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // Start in distinct cosy spots.
  const startSpots = spots
    .map((s, i) => ({ i, key: (s.cosy ? 1 : 0) + rng() * 0.8 }))
    .sort((a, b) => b.key - a.key)
    .map((e) => e.i);

  const cats: Cat[] = COATS.map((coat, k) => {
    const rig = buildCat(coat, material, shadows);
    rig.root.scale.setScalar(SCALE);
    engine.scene.add(rig.root);
    const si = startSpots[k % Math.max(1, startSpots.length)] ?? -1;
    const sp = spots[si] ?? { x: -1 + k * 1.2, z: 2, y: 0 };
    const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(sp.x, sp.y, sp.z));
    const s45 = Math.SQRT1_2;
    world.createCollider(
      R.ColliderDesc.capsule(0.14 * SCALE, 0.095 * SCALE)
        .setTranslation(0, 0.1 * SCALE, 0.1 * SCALE)
        .setRotation({ x: s45, y: 0, z: 0, w: s45 })
        .setCollisionGroups(groups(GROUP.cat, GROUP.leaf)),
      body,
    );
    const brain = createBrain(si, rng);
    const on = si >= 0 && spots[si].elevated ? (spots[si] as ElevatedSpot).top : -1;
    return {
      rig,
      brain,
      body,
      x: sp.x,
      y: sp.y,
      z: sp.z,
      yaw: rng() * Math.PI * 2,
      speed: 0,
      phase: rng() * 10,
      on,
      hop: null,
      bounce: 0,
      pose: restingPose(),
      seed: k,
    };
  });

  const threats: ThreatPoint[] = [];
  const occupied: number[] = [];
  const kinPos = { x: 0, y: 0, z: 0 };
  const kinRot = { x: 0, y: 0, z: 0, w: 1 };

  /** Ground point just outside obstacle `top`, on the side facing (dx, dz). */
  const edgePoint = (oi: number, fromX: number, fromZ: number, dx: number, dz: number, out: number) => {
    const o = tops[oi];
    const len = Math.hypot(dx, dz) || 1;
    let x = fromX;
    let z = fromZ;
    for (let i = 0; i < 80 && signedDistance(o, x, z) < out; i++) {
      x += (dx / len) * 0.05;
      z += (dz / len) * 0.05;
    }
    return resolvePenetration(walkable, YARD, x, z, RADIUS);
  };

  const startHop = (c: Cat, tx: number, ty: number, tz: number, onto: number) => {
    const dist = Math.hypot(tx - c.x, tz - c.z);
    c.hop = {
      fx: c.x,
      fy: c.y,
      fz: c.z,
      tx,
      ty,
      tz,
      t: 0,
      dur: 0.38 + dist * 0.12,
      h: 0.18 + Math.max(0, ty - c.y) * 0.35,
      onto,
    };
    c.yaw = Math.atan2(tx - c.x, tz - c.z);
  };

  const updateCat = (c: Cat, dt: number, calm: boolean) => {
    const b = c.brain;
    const target = b.spot >= 0 ? spots[b.spot] : null;
    const prevMode = b.mode;

    // Arrival: same level and close enough.
    let atTarget = false;
    if (target) {
      const d = Math.hypot(target.x - c.x, target.z - c.z);
      if (target.elevated) atTarget = c.on === (target as ElevatedSpot).top && d < 0.9;
      else atTarget = c.on < 0 && d < 0.25;
    }

    occupied.length = 0;
    for (const o of cats) if (o !== c && o.brain.spot >= 0) occupied.push(o.brain.spot);
    updateBrain(
      b,
      { x: c.x, z: c.z, flyers: threats, spots, occupied, atTarget, reducedMotion: calm, rng },
      dt,
    );
    if (b.mode === "flee" && prevMode === "flinch" && !calm) c.bounce = 1;

    // Mid-hop: follow the arc, nothing else.
    if (c.hop) {
      const h = c.hop;
      h.t += dt / h.dur;
      const s = Math.min(1, h.t);
      c.x = h.fx + (h.tx - h.fx) * s;
      c.z = h.fz + (h.tz - h.fz) * s;
      c.y = h.fy + (h.ty - h.fy) * s + 4 * h.h * s * (1 - s);
      if (s >= 1) {
        c.on = h.onto;
        c.y = h.ty;
        c.hop = null;
        leaves.disturb(c.x, c.y + 0.05, c.z, 0.6, calm ? 0.4 : 1.4, 0.8);
      }
      c.speed = 0;
      return;
    }

    let wantSpeed = 0;
    let dirX = 0;
    let dirZ = 0;
    const moving = b.mode === "walk" || b.mode === "flee";

    if (moving) {
      const fleeing = b.mode === "flee";
      const tgt = target;
      // Leaving a rooftop: hop down toward where we're going.
      if (c.on >= 0 && !(tgt && tgt.elevated && (tgt as ElevatedSpot).top === c.on)) {
        let dx = tgt ? tgt.x - c.x : 0;
        let dz = tgt ? tgt.z - c.z : 0;
        if (fleeing && b.threat) {
          dx = c.x - b.threat.x;
          dz = c.z - b.threat.z;
        }
        if (Math.hypot(dx, dz) < 1e-3) dx = 1;
        const p = edgePoint(c.on, c.x, c.z, dx, dz, RADIUS + 0.2);
        startHop(c, p.x, 0, p.z, -1);
        return;
      }

      if (tgt && !atTarget) {
        if (tgt.elevated && c.on < 0) {
          // Walk to the edge nearest us, then hop up.
          const oi = (tgt as ElevatedSpot).top;
          const edge = edgePoint(oi, tgt.x, tgt.z, c.x - tgt.x, c.z - tgt.z, RADIUS + 0.12);
          const d = Math.hypot(edge.x - c.x, edge.z - c.z);
          if (d < 0.3) {
            // Land a little inside the top, along the line toward the spot.
            const lx = edge.x + (tgt.x - edge.x) * Math.min(1, 0.45 / Math.max(0.01, Math.hypot(tgt.x - edge.x, tgt.z - edge.z)));
            const lz = edge.z + (tgt.z - edge.z) * Math.min(1, 0.45 / Math.max(0.01, Math.hypot(tgt.x - edge.x, tgt.z - edge.z)));
            startHop(c, lx, tgt.y, lz, oi);
            return;
          }
          dirX = edge.x - c.x;
          dirZ = edge.z - c.z;
        } else if (c.on >= 0) {
          // Pottering about on top of the car.
          dirX = tgt.x - c.x;
          dirZ = tgt.z - c.z;
        } else {
          dirX = tgt.x - c.x;
          dirZ = tgt.z - c.z;
        }
      }

      if (fleeing) {
        wantSpeed = calm ? RUN_CALM : RUN;
        if (b.threat) {
          const away = fleeDesire({ x: c.x, z: c.z }, [b.threat], YARD);
          const dThreat = Math.hypot(c.x - b.threat.x, c.z - b.threat.z);
          const w = dThreat < 2.5 ? 1.6 : 0.4;
          const l = Math.hypot(dirX, dirZ) || 1;
          dirX = (dirX / l) * (tgt ? 1 : 0) + away.x * w;
          dirZ = (dirZ / l) * (tgt ? 1 : 0) + away.z * w;
        }
        if (atTarget) wantSpeed = 0;
      } else {
        wantSpeed = atTarget ? 0 : WALK;
        // Slow down on arrival.
        if (tgt) wantSpeed *= Math.min(1, Math.hypot(tgt.x - c.x, tgt.z - c.z) / 0.5 + 0.3);
      }
    }

    if (wantSpeed > 0 && (dirX !== 0 || dirZ !== 0)) {
      let hx = dirX;
      let hz = dirZ;
      if (c.on < 0) {
        const s = steer({ x: c.x, z: c.z }, { x: dirX, z: dirZ }, walkable, YARD, {
          radius: RADIUS,
          lookahead: wantSpeed > 1 ? 1.6 : 0.8,
        });
        hx = s.x;
        hz = s.z;
      }
      const want = Math.atan2(hx, hz);
      const turn = (b.mode === "flee" ? 9 : 3.5) * dt;
      const d = angleTo(c.yaw, want);
      c.yaw += THREE.MathUtils.clamp(d, -turn, turn);
      // Don't charge forward while facing the wrong way.
      wantSpeed *= Math.max(0.15, Math.cos(Math.min(Math.abs(d), Math.PI / 2)));
    } else if (b.mode === "sit" || b.mode === "recover") {
      wantSpeed = 0;
    }

    const accel = b.mode === "flee" ? 10 : 3;
    c.speed += (wantSpeed - c.speed) * Math.min(1, dt * accel);
    if (c.speed < 0.01 && wantSpeed === 0) c.speed = 0;

    c.x += Math.sin(c.yaw) * c.speed * dt;
    c.z += Math.cos(c.yaw) * c.speed * dt;
    if (c.on < 0) {
      const p = resolvePenetration(walkable, YARD, c.x, c.z, RADIUS);
      c.x = p.x;
      c.z = p.z;
      c.y = 0;
    } else {
      // Stay on the roof.
      const o = tops[c.on];
      if (signedDistance(o, c.x, c.z) > -0.12) {
        c.x -= Math.sin(c.yaw) * c.speed * dt;
        c.z -= Math.cos(c.yaw) * c.speed * dt;
        c.speed = 0;
      }
      c.y = o.top;
    }

    // Sprinting through a pile kicks leaves up (on top of the capsule's own shove).
    if (c.speed > 0.6) {
      const fx = c.x + Math.sin(c.yaw) * 0.25;
      const fz = c.z + Math.cos(c.yaw) * 0.25;
      leaves.disturb(fx, c.y + 0.03, fz, 0.42, c.speed * (calm ? 0.2 : 0.55), calm ? 0.3 : 1.1);
    }
  };

  const separate = () => {
    for (let i = 0; i < cats.length; i++) {
      for (let j = i + 1; j < cats.length; j++) {
        const a = cats[i];
        const b = cats[j];
        if (a.hop || b.hop || a.on !== b.on) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = RADIUS * 2.2;
        if (d >= min || d < 1e-6) continue;
        const push = (min - d) / 2;
        a.x -= (dx / d) * push;
        a.z -= (dz / d) * push;
        b.x += (dx / d) * push;
        b.z += (dz / d) * push;
      }
    }
  };

  const posePlan = (c: Cat, t: number, calm: boolean): CatPose => {
    const p = tmpTarget;
    Object.assign(p, restingPose());
    const b = c.brain;
    const breath = Math.sin(t * 1.7 + c.seed) * 0.004;
    switch (b.mode) {
      case "rest":
        p.bodyY = 0.1 + breath;
        p.tuck = 1;
        p.sit = 0;
        p.tailLift = -0.15;
        p.tailCurl = 0.02;
        p.tailWrap = 0.38;
        if (b.restPose === "curl") {
          p.headYaw = 1.0;
          p.headPitch = 0.35;
          p.eyes = 0;
          p.ears = 0.15;
        } else {
          p.headPitch = 0.1;
          p.eyes = b.elapsed > 4 ? 0.15 : 0.6;
        }
        break;
      case "groom":
        p.bodyY = 0.085;
        p.pitch = 0.5;
        p.sit = 1;
        p.paw = 1;
        p.headPitch = 0.45 + Math.sin(t * 9) * 0.12;
        p.headYaw = 0.35;
        p.eyes = 0.3;
        p.tailLift = -0.2;
        p.tailWrap = 0.25;
        break;
      case "sit":
      case "recover":
        p.bodyY = 0.085;
        p.pitch = 0.55;
        p.sit = 1;
        p.tailLift = -0.25;
        p.tailWrap = 0.3;
        p.ears = b.mode === "recover" ? b.fear * 0.9 : 0;
        p.puff = b.mode === "recover" ? b.fear * 0.5 : 0;
        p.headYaw = lookYaw(c);
        p.headPitch = -0.1;
        // Slow blinks.
        p.eyes = Math.sin(t * 0.7 + c.seed * 2) > 0.97 ? 0.1 : 1;
        break;
      case "flinch":
        p.bodyY = 0.12;
        p.pitch = -0.08;
        p.ears = 1;
        p.puff = calm ? 0.4 : 1;
        p.tailLift = 1.1;
        p.tailCurl = 0.25;
        p.eyes = 1.2;
        break;
      case "flee":
      case "walk": {
        const fast = c.speed > 1;
        p.bodyY = 0.17 + (fast ? Math.abs(Math.sin(c.phase)) * 0.025 : 0);
        p.pitch = fast ? Math.sin(c.phase) * 0.08 : 0;
        p.stride = THREE.MathUtils.clamp(c.speed * 1.1, 0, fast ? 0.85 : 0.45);
        p.tailLift = fast ? 0.15 : 0.95;
        p.tailCurl = fast ? 0.05 : 0.18;
        p.ears = b.fear;
        p.puff = b.fear * (calm ? 0.4 : 0.9);
        p.headPitch = fast ? -0.05 : 0.1;
        if (c.speed < 0.05) p.stride = 0;
        break;
      }
    }
    return p;
  };

  const lookYaw = (c: Cat): number => {
    let best = 7;
    let yaw = 0;
    for (const f of threats) {
      const d = Math.hypot(f.x - c.x, f.z - c.z);
      if (d < best) {
        best = d;
        yaw = THREE.MathUtils.clamp(angleTo(c.yaw, Math.atan2(f.x - c.x, f.z - c.z)), -1.1, 1.1);
      }
    }
    return yaw;
  };

  phys.onFrame((dt, t) => {
    const calm = $reducedMotion.get();
    threats.length = 0;
    for (const f of flyers.values()) threats.push({ x: f.position.x, y: f.position.y, z: f.position.z });

    for (const c of cats) updateCat(c, dt, calm);
    separate();

    for (const c of cats) {
      // Gait phase advances with distance travelled (no moonwalking).
      c.phase += dt * (c.speed > 1 ? 4.2 + c.speed * 2.6 : c.speed * 14);
      c.bounce = Math.max(0, c.bounce - dt * 3.2);
      const target = posePlan(c, t, calm);
      const rate = c.brain.mode === "flinch" ? 22 : c.brain.mode === "flee" ? 12 : 5;
      const k = 1 - Math.exp(-dt * rate);
      const p = c.pose;
      for (const key of Object.keys(target) as Array<keyof CatPose>) p[key] += (target[key] - p[key]) * k;

      const bounceY = Math.sin(c.bounce * Math.PI) * 0.16;
      c.rig.root.position.set(c.x, c.y + bounceY, c.z);
      c.rig.root.rotation.y = c.yaw;
      applyPose(c.rig, p, c.phase, t + c.seed * 3, c.speed > 1);

      kinPos.x = c.x;
      kinPos.y = c.y;
      kinPos.z = c.z;
      kinRot.y = Math.sin(c.yaw / 2);
      kinRot.w = Math.cos(c.yaw / 2);
      c.body.setNextKinematicTranslation(kinPos);
      c.body.setNextKinematicRotation(kinRot);
    }
  });
}
