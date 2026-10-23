// Wind sway for instanced foliage (vine leaves, grape bunches, fig leaves), done in the vertex shader
// and driven by the shared wind field so it moves together with the cloth and the leaves.
import * as THREE from "three";
import { windAt } from "../core/wind.ts";
import { $reducedMotion } from "../core/stores.ts";
import type { WorldCtx } from "./ctx.ts";

export interface SwayUniforms {
  uWind: { value: THREE.Vector3 };
  uTime: { value: number };
}

/**
 * Clone `base` with an instanced sway: each instance is pushed by the wind, more the further it
 * hangs below `pivotY` (grapes) plus a per-instance flutter (leaves).
 */
export function swayMaterial(base: THREE.MeshStandardMaterial, u: SwayUniforms, o: { pivotY: number; hang: number; flutter: number }): THREE.MeshStandardMaterial {
  const m = base.clone();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = u.uWind;
    shader.uniforms.uTime = u.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 uWind;\nuniform float uTime;",
      )
      .replace(
        "#include <project_vertex>",
        /* glsl */ `
        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
          mvPosition = instanceMatrix * mvPosition;
          float ph = ip.x * 1.73 + ip.z * 1.31 + ip.y * 0.7;
          float hang = clamp(${o.pivotY.toFixed(3)} - ip.y, 0.0, 2.0) * ${o.hang.toFixed(3)};
          vec3 off = vec3(uWind.x, 0.0, uWind.z) * (hang + ${o.flutter.toFixed(3)});
          off += vec3(sin(uTime * 2.3 + ph), sin(uTime * 3.1 + ph * 1.3) * 0.6, cos(uTime * 1.9 + ph)) * ${o.flutter.toFixed(3)} * (0.4 + length(uWind));
          mvPosition.xyz += off;
        #endif
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  m.customProgramCacheKey = () => `ezo-sway-${o.pivotY}-${o.hang}-${o.flutter}`;
  return m;
}

/** Uniforms updated from windAt at `probe`, smoothed so the foliage does not jitter. */
export function swayDriver(ctx: WorldCtx, probe: THREE.Vector3, scale = 0.05): SwayUniforms {
  const u: SwayUniforms = { uWind: { value: new THREE.Vector3() }, uTime: { value: 0 } };
  const w = new THREE.Vector3();
  ctx.update((dt, t) => {
    if ($reducedMotion.get()) {
      u.uWind.value.multiplyScalar(0.9);
      return;
    }
    windAt(probe, t, w).multiplyScalar(scale);
    u.uWind.value.lerp(w, Math.min(1, dt * 2.5));
    u.uTime.value = t;
  });
  return u;
}
