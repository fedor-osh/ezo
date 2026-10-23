// Traces of visitors who went home: sleeping butterflies, coloured leaves on the ground, and faint
// dotted ghost trails of their paths. Everything fades with age and is gone after a day.
import * as THREE from "three";
import type { Trace } from "../../shared/protocol.ts";
import { ORDER, type Engine, type WorldHandle } from "../../core/types.ts";
import { surfaces } from "../../core/surfaces.ts";
import { YARD } from "../../core/layout.ts";
import { $reducedMotion, $traces } from "../../core/stores.ts";
import { bodyGeometry, dotTexture, leafColor, leafGeometry, leafTexture, wingGeometry, wingTexture } from "./art.ts";
import { STAND_OFF, TRACE_SCALE, type RestPose } from "./creature.ts";
import { WINGS_REST, surfaceQuaternion } from "./views.ts";
import { clamp, hashString, seeded } from "./util.ts";

const DAY = 24 * 3600 * 1000;
const MAX_SLEEPERS = 80;
const MAX_LEAVES = 80;
const MAX_TRAILS = 30;
const MAX_TRAIL_DOTS = 3000;

export interface TracesApi {
  /** Where a trace's creature lies (computed once, cached). */
  restPose(trace: Trace): RestPose;
  /** Hide a trace while its live creature is still settling into place. */
  suppress(id: string): void;
  unsuppress(id: string): void;
}

/** Opacity by age: full for a while, then fading out to nothing at 24 h. */
export function ageFade(leftAt: number, now: number): number {
  const age = now - leftAt;
  if (age >= DAY) return 0;
  return Math.pow(clamp(1 - age / DAY, 0, 1), 0.6);
}

/** Adds a per-instance `instanceFade` alpha multiplier to a built-in material. */
function withInstanceFade<M extends THREE.Material>(m: M): M {
  m.transparent = true;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float instanceFade;\nvarying float vFade;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFade = instanceFade;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vFade;")
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.a *= vFade;");
  };
  m.customProgramCacheKey = () => "instanceFade";
  return m;
}

function fadedInstanced(geo: THREE.BufferGeometry, mat: THREE.Material, max: number): THREE.InstancedMesh {
  const g = geo.clone();
  g.setAttribute("instanceFade", new THREE.InstancedBufferAttribute(new Float32Array(max), 1));
  const mesh = new THREE.InstancedMesh(g, mat, max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  // Allocate instance colours.
  mesh.setColorAt(0, new THREE.Color());
  return mesh;
}

interface Sleeper {
  trace: Trace;
  pose: RestPose;
  fade: number;
  color: THREE.Color;
}

export function createTraces(engine: Engine, world: WorldHandle): TracesApi {
  const { scene, camera } = engine;
  const poses = new Map<string, RestPose>();
  const suppressed = new Set<string>();
  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  let matricesFresh = false;

  // --- meshes --------------------------------------------------------------------------------
  const bodyMat = withInstanceFade(new THREE.MeshLambertMaterial({ color: 0x5a4650 }));
  const wingTex = wingTexture("#efefef", "trace-wings");
  const wingMat = withInstanceFade(
    new THREE.MeshLambertMaterial({ map: wingTex, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: wingTex, emissiveIntensity: 0.12 }),
  );
  const bodies = fadedInstanced(bodyGeometry(), bodyMat, MAX_SLEEPERS);
  const wingsR = fadedInstanced(wingGeometry(), wingMat, MAX_SLEEPERS);
  const wingsL = fadedInstanced(wingGeometry(), wingMat, MAX_SLEEPERS);

  const leafGeo = leafGeometry().clone();
  // Same base orientation as a live LeafView: flat, face up, tip +Z.
  leafGeo.applyMatrix4(
    new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.PI / 2, Math.PI, 0, "YXZ")).scale(new THREE.Vector3(1.25, 1.25, 1.25)),
  );
  const leafMat = withInstanceFade(new THREE.MeshLambertMaterial({ map: leafTexture(), side: THREE.DoubleSide }));
  const leaves = fadedInstanced(leafGeo, leafMat, MAX_LEAVES);
  leaves.receiveShadow = true;
  scene.add(bodies, wingsR, wingsL, leaves);

  const trailGeo = new THREE.BufferGeometry();
  const trailPos = new Float32Array(MAX_TRAIL_DOTS * 3);
  const trailCol = new Float32Array(MAX_TRAIL_DOTS * 4);
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute("color", new THREE.BufferAttribute(trailCol, 4));
  trailGeo.setDrawRange(0, 0);
  const trails = new THREE.Points(
    trailGeo,
    new THREE.PointsMaterial({
      // Screen-space dots: the same tiny glow in wide and close shots.
      size: 4 * Math.min(devicePixelRatio, 2),
      sizeAttenuation: false,
      map: dotTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  trails.frustumCulled = false;
  scene.add(trails);

  // --- poses ---------------------------------------------------------------------------------
  function restPose(trace: Trace): RestPose {
    const cached = poses.get(trace.id);
    if (cached) return cached;
    const seed = hashString(trace.id);
    const yaw = seeded(seed, 3) * Math.PI * 2;
    let pose: RestPose | null = null;
    if (trace.perch && trace.kind === "butterfly") {
      const s = surfaces.get(trace.perch.surfaceId);
      if (s) {
        const perch = {
          surfaceId: trace.perch.surfaceId,
          u: clamp(trace.perch.u + (seeded(seed, 4) - 0.5) * 0.1, 0.05, 0.95),
          v: clamp(trace.perch.v + (seeded(seed, 5) - 0.5) * 0.1, 0.05, 0.95),
        };
        const point = new THREE.Vector3();
        const normal = new THREE.Vector3();
        s.pointAt(perch.u, perch.v, point, normal);
        pose = { point, normal: normal.normalize(), yaw, perch };
      }
    }
    if (!pose) {
      // Drop straight down from where they last pointed onto whatever is below.
      const jitter = 0.18;
      const x = clamp(trace.rest[0] + (seeded(seed, 6) - 0.5) * jitter * 2, YARD.minX + 0.5, YARD.maxX - 0.5);
      const z = clamp(trace.rest[2] + (seeded(seed, 7) - 0.5) * jitter * 2, YARD.minZ + 0.5, YARD.maxZ - 0.5);
      const y = Math.max(trace.rest[1], 0.3) + 0.05;
      // World meshes may not have been rendered yet: make sure their matrices are current.
      if (!matricesFresh) {
        for (const o of world.restSurfaces) o.updateWorldMatrix(true, true);
        matricesFresh = true;
        queueMicrotask(() => (matricesFresh = false));
      }
      raycaster.set(new THREE.Vector3(x, y, z), down);
      raycaster.far = y + 1;
      const hit = world.restSurfaces.length ? raycaster.intersectObjects(world.restSurfaces, true).find((h) => h.face) : undefined;
      const point = new THREE.Vector3(x, 0, z);
      const normal = new THREE.Vector3(0, 1, 0);
      if (hit?.face) {
        point.copy(hit.point);
        normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
        if (normal.y < 0.4) normal.set(0, 1, 0);
      }
      pose = { point, normal, yaw, perch: null };
    }
    poses.set(trace.id, pose);
    return pose;
  }

  // --- lists ---------------------------------------------------------------------------------
  let sleepers: Sleeper[] = [];
  let fallen: Sleeper[] = [];
  let lastFadeRefresh = 0;

  const rebuild = () => {
    const now = Date.now();
    const live = $traces
      .get()
      .filter((tr) => now - tr.leftAt < DAY)
      .sort((a, b) => b.leftAt - a.leftAt);
    const keep = new Set(live.map((tr) => tr.id));
    for (const id of poses.keys()) if (!keep.has(id)) poses.delete(id);

    const toSleeper = (tr: Trace): Sleeper => ({
      trace: tr,
      pose: restPose(tr),
      fade: ageFade(tr.leftAt, now),
      color: tr.kind === "leaf" ? leafColor(tr.color, tr.id) : new THREE.Color(tr.color),
    });
    sleepers = live.filter((tr) => tr.kind === "butterfly").slice(0, MAX_SLEEPERS).map(toSleeper);
    fallen = live.filter((tr) => tr.kind === "leaf").slice(0, MAX_LEAVES).map(toSleeper);
    writeLeaves();
    writeTrails(live.slice(0, MAX_TRAILS), now);
    lastFadeRefresh = now;
  };

  const m = new THREE.Matrix4();
  const mWing = new THREE.Matrix4();
  const rot = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const mirror = new THREE.Matrix4().makeScale(-1, 1, 1);
  const lift = new THREE.Matrix4().makeTranslation(0, 0.002, 0);

  function writeLeaves(): void {
    const fadeAttr = leaves.geometry.getAttribute("instanceFade") as THREE.InstancedBufferAttribute;
    let i = 0;
    for (const s of fallen) {
      if (suppressed.has(s.trace.id) || s.fade <= 0) continue;
      surfaceQuaternion(s.pose.normal, s.pose.yaw, q);
      p.copy(s.pose.point).addScaledVector(s.pose.normal, STAND_OFF.leaf * TRACE_SCALE);
      m.compose(p, q, sc.setScalar(TRACE_SCALE));
      leaves.setMatrixAt(i, m);
      leaves.setColorAt(i, s.color);
      fadeAttr.setX(i, s.fade);
      i++;
    }
    leaves.count = i;
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    fadeAttr.needsUpdate = true;
  }

  function writeSleepers(t: number): void {
    const fadeB = bodies.geometry.getAttribute("instanceFade") as THREE.InstancedBufferAttribute;
    const fadeR = wingsR.geometry.getAttribute("instanceFade") as THREE.InstancedBufferAttribute;
    const fadeL = wingsL.geometry.getAttribute("instanceFade") as THREE.InstancedBufferAttribute;
    const calm = $reducedMotion.get();
    let i = 0;
    for (const s of sleepers) {
      if (suppressed.has(s.trace.id) || s.fade <= 0) continue;
      const pose = s.pose;
      const surf = pose.perch ? surfaces.get(pose.perch.surfaceId) : undefined;
      if (pose.perch && surf) {
        // Ride the cloth as it sways.
        surf.pointAt(pose.perch.u, pose.perch.v, p, n);
        n.normalize();
        if ((p.x - camera.position.x) * n.x + (p.y - camera.position.y) * n.y + (p.z - camera.position.z) * n.z > 0) n.negate();
      } else {
        p.copy(pose.point);
        n.copy(pose.normal);
      }
      surfaceQuaternion(n, pose.yaw, q);
      p.addScaledVector(n, STAND_OFF.butterfly * TRACE_SCALE);
      m.compose(p, q, sc.setScalar(TRACE_SCALE));
      bodies.setMatrixAt(i, m);
      // Slow sleepy breathing of the folded wings.
      const a = WINGS_REST + (calm ? 0 : 0.05 * Math.sin(t * 0.8 + pose.yaw * 5));
      mWing.multiplyMatrices(m, lift).multiply(rot.makeRotationZ(a));
      wingsR.setMatrixAt(i, mWing);
      mWing.multiplyMatrices(m, lift).multiply(rot.makeRotationZ(-a)).multiply(mirror);
      wingsL.setMatrixAt(i, mWing);
      for (const mesh of [bodies, wingsR, wingsL]) mesh.setColorAt(i, s.color);
      fadeB.setX(i, s.fade);
      fadeR.setX(i, s.fade);
      fadeL.setX(i, s.fade);
      i++;
    }
    for (const mesh of [bodies, wingsR, wingsL]) {
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    fadeB.needsUpdate = fadeR.needsUpdate = fadeL.needsUpdate = true;
  }

  const c = new THREE.Color();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  function writeTrails(list: Trace[], now: number): void {
    let k = 0;
    for (let ti = 0; ti < list.length && k < MAX_TRAIL_DOTS; ti++) {
      const tr = list[ti];
      if (tr.path.length < 2) continue;
      const fade = ageFade(tr.leftAt, now) * (1 - (ti / MAX_TRAILS) * 0.5);
      c.set(tr.color);
      const segs = tr.path.length - 1;
      for (let s = 0; s < segs && k < MAX_TRAIL_DOTS; s++) {
        a.fromArray(tr.path[s]);
        b.fromArray(tr.path[s + 1]);
        const dots = Math.min(12, Math.max(1, Math.round(a.distanceTo(b) / 0.22)));
        for (let d = 0; d < dots && k < MAX_TRAIL_DOTS; d++) {
          p.lerpVectors(a, b, d / dots);
          trailPos[k * 3] = p.x;
          trailPos[k * 3 + 1] = p.y;
          trailPos[k * 3 + 2] = p.z;
          // Older parts of the path are fainter.
          const along = (s + d / dots) / segs;
          trailCol[k * 4] = c.r;
          trailCol[k * 4 + 1] = c.g;
          trailCol[k * 4 + 2] = c.b;
          trailCol[k * 4 + 3] = 0.38 * fade * (0.2 + 0.8 * along);
          k++;
        }
      }
    }
    trailGeo.setDrawRange(0, k);
    trailGeo.getAttribute("position").needsUpdate = true;
    trailGeo.getAttribute("color").needsUpdate = true;
  }

  $traces.subscribe(rebuild);

  engine.onUpdate((_dt, t) => {
    // Ages change slowly: refresh fades once a minute.
    if (Date.now() - lastFadeRefresh > 60_000) rebuild();
    writeSleepers(t);
  }, ORDER.life);

  return {
    restPose,
    suppress(id) {
      suppressed.add(id);
      writeLeaves();
    },
    unsuppress(id) {
      suppressed.delete(id);
      writeLeaves();
    },
  };
}
