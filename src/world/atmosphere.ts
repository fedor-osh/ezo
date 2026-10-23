// Late-afternoon light: gradient sky dome (also baked into the env map), warm low sun with soft
// shadows fitted to the yard, gentle fog and dust motes drifting in the sunbeams.
import * as THREE from "three";
import { YARD } from "../core/layout.ts";
import { $reducedMotion } from "../core/stores.ts";
import type { WorldCtx } from "./ctx.ts";

/** Direction toward the sun (from the yard): behind the gate and to the left, so the table and the back house are in the light. */
export const SUN_DIR = new THREE.Vector3(-0.4, 0.55, 0.74).normalize();

const SKY_TOP = new THREE.Color("#5f9fd8");
const SKY_MID = new THREE.Color("#a9d0ec");
const SKY_HORIZON = new THREE.Color("#ffd7ae");
const SKY_GROUND = new THREE.Color("#e9b98f");
export const FOG_COLOR = new THREE.Color("#f2d6b4");

function skyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: SKY_TOP },
      mid: { value: SKY_MID },
      horizon: { value: SKY_HORIZON },
      below: { value: SKY_GROUND },
      sunDir: { value: SUN_DIR },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top, mid, horizon, below, sunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = h > 0.0
          ? mix(mix(horizon, mid, smoothstep(0.0, 0.22, h)), top, smoothstep(0.22, 0.85, h))
          : mix(horizon, below, smoothstep(0.0, 0.25, -h));
        float s = max(dot(d, sunDir), 0.0);
        c += vec3(1.0, 0.78, 0.5) * (pow(s, 8.0) * 0.35 + pow(s, 120.0) * 1.2);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function buildAtmosphere(ctx: WorldCtx): void {
  const { scene, renderer } = ctx.engine;

  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), skyMaterial());
  sky.name = "sky";
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  // Bake the same sky into a PMREM env map: soft ambient light and something for glass/chrome to reflect.
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), skyMaterial()));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(envScene, 0.04, 0.1, 100);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  scene.fog = new THREE.Fog(FOG_COLOR, 32, 110);

  const hemi = new THREE.HemisphereLight("#dfe4e6", "#d09a68", 0.8);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight("#ffd09a", 2.7);
  const target = new THREE.Vector3(0, 0, -1);
  sun.position.copy(target).addScaledVector(SUN_DIR, 40);
  sun.target.position.copy(target);
  sun.castShadow = true;
  const s = sun.shadow;
  s.mapSize.setScalar(ctx.high ? 2048 : 1024);
  // Fit to the yard + the houses around it, seen from the sun.
  const half = Math.max(YARD.maxX - YARD.minX, YARD.maxZ - YARD.minZ) * 0.72;
  s.camera.left = -half;
  s.camera.right = half;
  s.camera.top = half;
  s.camera.bottom = -half;
  s.camera.near = 10;
  s.camera.far = 80;
  s.bias = -0.0004;
  s.normalBias = 0.035;
  s.radius = 3;
  scene.add(sun, sun.target);

  buildDust(ctx);
}

/** Dust motes: one Points draw, animated entirely in the vertex shader. */
function buildDust(ctx: WorldCtx): void {
  const n = ctx.high ? 260 : 110;
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = THREE.MathUtils.lerp(-8.5, 8.5, Math.random());
    pos[i * 3 + 1] = THREE.MathUtils.lerp(0.4, 5.5, Math.random());
    pos[i * 3 + 2] = THREE.MathUtils.lerp(-7, 6.5, Math.random());
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
  const uniforms = { uTime: { value: 0 }, uPx: { value: ctx.engine.renderer.getPixelRatio() } };
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms,
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime, uPx;
      varying float vA;
      void main() {
        vec3 p = position;
        float t = uTime * (0.08 + seed * 0.06) + seed * 40.0;
        p.x += sin(t * 1.3) * 0.6 + uTime * 0.05;
        p.y += sin(t * 0.9 + 2.0) * 0.35;
        p.z += cos(t * 1.1) * 0.5;
        p.x = mod(p.x + 8.5, 17.0) - 8.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPx * (14.0 + seed * 12.0) / -mv.z;
        vA = (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.7 + seed) + seed * 17.0))) * smoothstep(0.8, 2.0, -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = (1.0 - smoothstep(0.0, 0.5, d)) * vA * 0.55;
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.6) * a, a);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.name = "dust";
  points.frustumCulled = false;
  ctx.root.add(points);
  ctx.update((_dt, t) => {
    if (!$reducedMotion.get()) uniforms.uTime.value = t;
  });
}
