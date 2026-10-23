// The tone: a clay bread oven sunk in a brick base, embers glowing inside, a puri slapped onto the
// inner wall, a lazy wisp of smoke (one Points draw, animated on the GPU).
import * as THREE from "three";
import { SPOTS } from "../core/layout.ts";
import { $reducedMotion } from "../core/stores.ts";
import { windAt } from "../core/wind.ts";
import { localCyl, type WorldCtx } from "./ctx.ts";
import { lathe, rng, type Vec } from "./kit.ts";
import { C } from "./materials.ts";
import * as food from "./food.ts";

export function buildTone(ctx: WorldCtx): void {
  const { center, radius: R, height: H } = SPOTS.tone;
  const rand = rng(55);
  ctx.f.at({ p: center as Vec }, () => {
    const m = ctx.b.matte;
    // Brick-and-clay drum, slightly tapered, with a thick rounded rim.
    m.add(lathe([[R, 0], [R * 1.02, H * 0.3], [R * 0.97, H * 0.8], [R * 0.9, H]], 14), "#c98a5a");
    m.add(new THREE.TorusGeometry(R * 0.78, 0.09, 8, 22).rotateX(Math.PI / 2), "#b97a4c", { p: [0, H, 0] });
    // Exposed brick courses where the clay render has fallen off.
    for (let k = 0; k < 9; k++) {
      const a = 0.5 + k * 0.32;
      const y = 0.2 + (k % 3) * 0.12;
      m.box(0.18, 0.08, 0.05, C.brick, { p: [Math.cos(a) * (R + 0.01), y, Math.sin(a) * (R + 0.01)], r: [0, -a + Math.PI / 2, 0] });
    }
    // Inside: dark throat, glowing embers at the bottom, a puri stuck on the wall.
    ctx.b.matte.add(lathe([[R * 0.68, H + 0.02], [R * 0.72, H * 0.5], [R * 0.6, 0.25]], 14).scale(1, 1, 1), "#2a1a12", undefined, 0);
    ctx.b.glow.cyl(R * 0.6, R * 0.6, 0.02, 14, "#e2551a", { p: [0, 0.25, 0] });
    for (let k = 0; k < 12; k++) {
      const a = rand() * Math.PI * 2;
      const r = rand() * R * 0.45;
      ctx.b.glow.sphere(0.05 + rand() * 0.04, rand() < 0.5 ? "#ff7a1a" : "#ffb02e", { p: [Math.cos(a) * r, 0.28, Math.sin(a) * r], s: [1, 0.5, 1] }, 0);
    }
    ctx.b.soft.add(food.puri(0.4, 0.13, 0.06), null, { p: [0.0, H * 0.6, -R * 0.62], r: [Math.PI / 2 - 0.15, 0, Math.PI / 2] });
    // One more resting on the rim, cooling.
    ctx.b.soft.add(food.puri(0.42, 0.14, 0.07), null, { p: [R * 0.55, H + 0.08, R * 0.25], r: [0.08, 0.9, 0.05] });
    // Wooden lid leaning on the oven, an iron hook, a stack of firewood.
    m.cyl(0.5, 0.5, 0.05, 12, C.wood, { p: [-R - 0.06, 0.48, 0.1], r: [0, 0, 1.38] });
    m.box(0.06, 0.06, 0.35, C.woodDark, { p: [-R - 0.1, 0.5, 0.1], r: [0, 0, 1.38] });
    ctx.b.metal.rod([R * 0.5, H + 0.05, -0.2], [R + 0.35, 0.02, -0.6], 0.015, "#3b3836", 4);
    for (let k = 0; k < 9; k++) {
      const row = Math.floor(k / 4);
      const x = R + 0.45 + (k % 4) * 0.11 - row * 0.05;
      m.cyl(0.05, 0.05, 0.6, 6, k % 2 ? "#8a6a4a" : "#6e5238", { p: [x, 0.06 + row * 0.1, 0.55], r: [Math.PI / 2, 0, (rand() - 0.5) * 0.2] });
    }
    localCyl(ctx, 0, 0, R, H);
    localCyl(ctx, R + 0.6, 0.55, 0.3, 0.3);
    ctx.rest.cyl(R * 0.95, R * 0.95, 0.06, 10, "#fff", { p: [0, H + 0.05, 0] });
  });
  buildSmoke(ctx, new THREE.Vector3(center[0], H + 0.15, center[2]));
}

function buildSmoke(ctx: WorldCtx, origin: THREE.Vector3): void {
  const n = ctx.high ? 26 : 12;
  const seed = new Float32Array(n);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) seed[i] = i / n;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
  const uniforms = {
    uTime: { value: 0 },
    uOrigin: { value: origin },
    uWind: { value: new THREE.Vector3() },
    uPx: { value: ctx.engine.renderer.getPixelRatio() },
  };
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms,
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime, uPx;
      uniform vec3 uOrigin, uWind;
      varying float vA;
      void main() {
        float age = fract(uTime * 0.11 + seed);
        vec3 p = uOrigin;
        p.y += age * 3.2;
        p.x += sin(seed * 31.0 + age * 5.0) * 0.18 * age + uWind.x * age * age * 1.6;
        p.z += cos(seed * 17.0 + age * 4.0) * 0.18 * age + uWind.z * age * age * 1.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPx * (160.0 + age * 420.0) / -mv.z;
        vA = smoothstep(0.0, 0.12, age) * (1.0 - age) * 0.65;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = (1.0 - smoothstep(0.1, 0.5, length(d))) * vA;
        gl_FragColor = vec4(vec3(0.74, 0.72, 0.7), a);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 3;
  points.name = "tone-smoke";
  ctx.root.add(points);
  const w = new THREE.Vector3();
  ctx.update((dt, t) => {
    if ($reducedMotion.get()) return;
    uniforms.uTime.value = t;
    windAt(origin, t, w);
    uniforms.uWind.value.lerp(w, Math.min(1, dt));
  });
}
