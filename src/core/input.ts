// Pointer input → world. Each frame: cast a ray from the camera, find the interactable under it,
// and compute `pointer.aim`, the world point pointer creatures fly toward.
import * as THREE from "three";
import { ORDER, type Engine } from "./types.ts";
import { interactables, surfaces, type Interactable } from "./surfaces.ts";
import { $section } from "./stores.ts";
import { sectionById } from "./sections.ts";

export interface PointerHover {
  target: Interactable;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  /** Present when the target is also a registered Surface. */
  uv: { u: number; v: number } | null;
}

export const pointer = {
  /** Is a mouse/pen/touch currently over the canvas? */
  inside: false,
  type: "mouse" as "mouse" | "pen" | "touch",
  clientX: 0,
  clientY: 0,
  ndc: new THREE.Vector2(),
  ray: new THREE.Ray(),
  /** World target for our pointer creature. */
  aim: new THREE.Vector3(0, 2.5, 0),
  hover: null as PointerHover | null,
  down: false,
  /** performance.now() of the last pointer movement. Creatures idle when the user is still. */
  lastMoveAt: 0,
};

const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane();
const tmpForward = new THREE.Vector3();
const tmpPoint = new THREE.Vector3();

export function installInput(engine: Engine): void {
  const { canvas, camera } = engine;
  let downAt = { x: 0, y: 0, t: 0 };

  const setFromEvent = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.clientX = e.clientX;
    pointer.clientY = e.clientY;
    pointer.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    pointer.type = e.pointerType === "touch" || e.pointerType === "pen" ? e.pointerType : "mouse";
    pointer.inside = true;
    pointer.lastMoveAt = performance.now();
  };

  canvas.addEventListener("pointermove", setFromEvent);
  canvas.addEventListener("pointerenter", setFromEvent);
  canvas.addEventListener("pointerleave", () => {
    pointer.inside = false;
    if (pointer.hover) pointer.hover.target.onHover?.(null);
    pointer.hover = null;
    delete canvas.dataset.hover;
  });
  canvas.addEventListener("pointerdown", (e) => {
    setFromEvent(e);
    pointer.down = true;
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener("pointerup", (e) => {
    setFromEvent(e);
    pointer.down = false;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    if (moved > 8 || performance.now() - downAt.t > 800) return;
    // Recompute the hover right now: on touch there was no hover before the tap.
    updateHover(engine);
    const h = pointer.hover;
    if (h) {
      const hit = raycaster.intersectObject(h.target.object, true)[0];
      if (hit) h.target.onActivate?.(hit);
    }
  });

  engine.onUpdate(() => {
    if (pointer.inside) updateHover(engine);
    // Fly-plane: faces the camera at the current section's pointer depth.
    camera.getWorldDirection(tmpForward);
    if (pointer.hover) {
      pointer.aim.copy(pointer.hover.point);
    } else if (pointer.inside) {
      const depth = sectionById($section.get()).shot.pointerDepth;
      tmpPoint.copy(camera.position).addScaledVector(tmpForward, depth);
      plane.setFromNormalAndCoplanarPoint(tmpForward, tmpPoint);
      if (pointer.ray.intersectPlane(plane, tmpPoint)) pointer.aim.copy(tmpPoint);
    }
  }, ORDER.input);
}

function updateHover(engine: Engine): void {
  raycaster.setFromCamera(pointer.ndc, engine.camera);
  pointer.ray.copy(raycaster.ray);

  let best: { i: Interactable; hit: THREE.Intersection } | null = null;
  for (const i of interactables.values()) {
    const hit = raycaster.intersectObject(i.object, true)[0];
    if (hit && (!best || hit.distance < best.hit.distance)) best = { i, hit };
  }

  const prev = pointer.hover?.target ?? null;
  if (!best) {
    if (prev) prev.onHover?.(null);
    pointer.hover = null;
    delete engine.canvas.dataset.hover;
    return;
  }

  const normal = best.hit.face?.normal.clone().transformDirection(best.hit.object.matrixWorld) ?? new THREE.Vector3(0, 0, 1);
  const surface = surfaces.get(best.i.id);
  pointer.hover = {
    target: best.i,
    point: best.hit.point.clone(),
    normal,
    uv: surface?.uvFromHit?.(best.hit) ?? null,
  };
  if (prev && prev !== best.i) prev.onHover?.(null);
  best.i.onHover?.(best.hit);
  // CSS decides the cursor (see styles.css): a pointer hand, or nothing when the butterfly is the cursor.
  engine.canvas.dataset.hover = "";
}
