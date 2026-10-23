// Camera director: flies between section shots on a gentle arc, breathes a little when idle,
// leans toward the pointer, and keeps the subject framed on narrow screens.
import * as THREE from "three";
import { ORDER, type Engine } from "../core/types.ts";
import { $reducedMotion, $section } from "../core/stores.ts";
import { sectionById } from "../core/sections.ts";
import { pointer } from "../core/input.ts";
import { gust } from "../core/wind.ts";
import type { SectionId } from "../shared/protocol.ts";
import { arcLift, clonePose, damp, fitPoseToAspect, flightDuration, poseAt, type Pose } from "./flight.ts";
import { viewInset } from "./viewport.ts";

interface Flight {
  from: Pose;
  start: number;
  duration: number;
  lift: number;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);

export function installCameraDirector(engine: Engine): void {
  const { camera, canvas } = engine;

  let sectionId: SectionId = $section.get();
  let pending: "intro" | "flight" | null = $reducedMotion.get() ? null : "intro";
  let flight: Flight | null = null;

  const shotPose = (id: SectionId): Pose => {
    const { position, target, fov } = sectionById(id).shot;
    return { position: [...position], target: [...target], fov };
  };

  const rest = fitPoseToAspect(shotPose(sectionId), camera.aspect);
  const current = clonePose(rest);
  const copyPose = (from: Pose, to: Pose) => {
    for (let i = 0; i < 3; i++) {
      to.position[i] = from.position[i];
      to.target[i] = from.target[i];
    }
    to.fov = from.fov;
  };

  // Idle life, all smoothed so nothing ever snaps.
  const lean = new THREE.Vector2();
  let life = $reducedMotion.get() ? 0 : 1;
  let shiftPx = 0;

  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const look = new THREE.Vector3();

  $section.listen((id) => {
    if (id === sectionId) return;
    sectionId = id;
    pending = $reducedMotion.get() ? null : "flight";
    // Reduced motion: an instant cut, handled by simply not flying.
    if (!pending) flight = null;
  });

  engine.onUpdate((dt, t) => {
    const reduced = $reducedMotion.get();
    fitPoseToAspect(shotPose(sectionId), camera.aspect, rest);

    if (pending === "intro") {
      // A short, gentle dolly in from a little further back and higher.
      const from = clonePose(rest);
      for (let i = 0; i < 3; i++) from.position[i] = rest.target[i] + (rest.position[i] - rest.target[i]) * 1.18;
      from.position[1] += 0.9;
      from.fov = rest.fov + 4;
      flight = { from, start: t, duration: 2.6, lift: 0 };
    } else if (pending === "flight") {
      // Always start from wherever we are now, so interrupting mid-flight just bends the path.
      const from = clonePose(current);
      flight = { from, start: t, duration: flightDuration(from, rest), lift: arcLift(from, rest) };
      gust(0.8);
    }
    pending = null;

    if (flight && !reduced) {
      const u = (t - flight.start) / flight.duration;
      poseAt(flight.from, rest, flight.lift, u, current);
      if (u >= 1) flight = null;
    } else {
      flight = null;
      copyPose(rest, current);
    }

    // Idle sway + parallax toward the pointer; fades out under reduced motion and during flights.
    const aliveTarget = reduced ? 0 : flight ? 0.25 : 1;
    life = damp(life, aliveTarget, 3, dt);
    const leanOn = !reduced && pointer.inside && pointer.type === "mouse";
    lean.x = damp(lean.x, leanOn ? pointer.ndc.x : 0, 2.2, dt);
    lean.y = damp(lean.y, leanOn ? pointer.ndc.y : 0, 2.2, dt);

    camera.position.fromArray(current.position);
    look.fromArray(current.target);
    fwd.subVectors(look, camera.position);
    // Close shots move less, so the subject never slides out of frame.
    const reach = THREE.MathUtils.clamp(fwd.length() / 9, 0.25, 1) * life;
    fwd.normalize();
    right.crossVectors(fwd, WORLD_UP).normalize();
    up.crossVectors(right, fwd);
    const swayX = Math.sin(t * 0.21) * 0.05 + Math.sin(t * 0.13 + 2) * 0.03;
    const swayY = Math.sin(t * 0.33 + 1) * 0.035;
    camera.position.addScaledVector(right, (lean.x * 0.22 + swayX) * reach);
    camera.position.addScaledVector(up, (lean.y * 0.12 + swayY) * reach);
    camera.up.copy(WORLD_UP);
    camera.lookAt(look);

    if (Math.abs(camera.fov - current.fov) > 1e-4) camera.fov = current.fov;

    // On phones the bottom sheet covers part of the canvas: shift the projection so the shot's
    // subject sits in the middle of what is still visible. Raycasting stays correct (same matrices).
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    const wantShift = Math.min(viewInset.bottom * 0.5, h * 0.22);
    shiftPx = reduced ? wantShift : damp(shiftPx, wantShift, 4, dt);
    if (shiftPx > 0.5) camera.setViewOffset(w, h, 0, shiftPx, w, h);
    else if (camera.view?.enabled) camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }, ORDER.camera);
}
