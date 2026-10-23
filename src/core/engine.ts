import * as THREE from "three";
import type { Engine, UpdateFn } from "./types.ts";
import { $mode, $sceneReady } from "./stores.ts";
import { updateWind } from "./wind.ts";

export function createEngine(canvas: HTMLCanvasElement): Engine {
  const small = Math.min(innerWidth, innerHeight) < 700;
  const quality: Engine["quality"] = small || navigator.hardwareConcurrency <= 4 ? "low" : "high";

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === "high" ? 1.75 : 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200);

  const callbacks: Array<{ fn: UpdateFn; order: number }> = [];
  const engine: Engine = {
    renderer,
    scene,
    camera,
    canvas,
    quality,
    onUpdate(fn, order = 100) {
      const entry = { fn, order };
      callbacks.push(entry);
      callbacks.sort((a, b) => a.order - b.order);
      return () => {
        const i = callbacks.indexOf(entry);
        if (i >= 0) callbacks.splice(i, 1);
      };
    },
  };

  const resize = () => {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  const clock = new THREE.Clock();
  let t = 0;
  let firstFrame = true;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    // Pause entirely in flat mode or when the tab is hidden: saves battery, physics stays sane.
    if ($mode.get() === "flat" || document.hidden) return;
    t += dt;
    updateWind(dt);
    for (const c of callbacks) c.fn(dt, t);
    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      $sceneReady.set(true);
    }
  });

  return engine;
}
