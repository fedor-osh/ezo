// Butterfly flight: a steering agent with mass. Pure math (three.js vectors only), unit-tested.
//
// Seek + arrive with a limited acceleration gives the "mass"; flapping adds a periodic lift and
// forward pulse so the path bobs instead of gliding on rails; smooth noise adds wander and a bit
// of out-of-plane wobble. Heading follows velocity smoothly and the body banks into turns.
import { Vector3 } from "three";
import { angleDelta, clamp, damp, noise1 } from "./util.ts";

export interface ButterflyState {
  p: Vector3;
  v: Vector3;
  /** Heading around world Y (0 = facing +Z). */
  yaw: number;
  /** Bank angle, positive lifts the +X wing. */
  roll: number;
  /** Nose pitch, positive = nose down. */
  pitch: number;
  /** Wing beat phase in radians. */
  flap: number;
  /** Current flap amplitude 0..1 (eases between flight and hover). */
  effort: number;
  /** Per-creature noise phase. */
  phase: number;
}

export interface ButterflyOptions {
  /** World-size multiplier (creatures grow when far from the camera so they stay visible). */
  scale: number;
  calm: boolean;
  /** Absolute time, drives the wander noise. */
  t: number;
  /** Lowest allowed height. */
  minY?: number;
}

export function createButterflyState(p: Vector3, phase = 0): ButterflyState {
  return { p: p.clone(), v: new Vector3(), yaw: 0, roll: 0, pitch: 0, flap: phase, effort: 1, phase };
}

const tmpDesired = new Vector3();
const tmpSteer = new Vector3();
const tmpDir = new Vector3();

export const BUTTERFLY = {
  maxSpeed: 3.2,
  maxAccel: 9,
  /** Radius (m, before scale) inside which the agent starts slowing down. */
  arriveRadius: 0.7,
  flapHz: 7.5,
  calmFlapHz: 2.2,
} as const;

/** Advance one butterfly by dt toward `target`. Mutates `s`. */
export function stepButterfly(s: ButterflyState, target: Vector3, dt: number, o: ButterflyOptions): void {
  if (dt <= 0) return;
  const k = o.scale;
  const calm = o.calm;
  const maxSpeed = BUTTERFLY.maxSpeed * k * (calm ? 0.45 : 1);
  const maxAccel = BUTTERFLY.maxAccel * k * (calm ? 0.4 : 1);

  // --- seek + arrive -------------------------------------------------------------------------
  tmpDir.subVectors(target, s.p);
  const dist = tmpDir.length();
  // The speed we could still brake from with ~60 % of our acceleration, capped linearly near the
  // target so the agent settles instead of oscillating.
  const brake = Math.sqrt(2 * maxAccel * 0.6 * dist);
  const desiredSpeed = Math.min(maxSpeed, brake, (dist / (BUTTERFLY.arriveRadius * k)) * maxSpeed);
  if (dist > 1e-6) tmpDesired.copy(tmpDir).multiplyScalar(desiredSpeed / dist);
  else tmpDesired.set(0, 0, 0);
  tmpSteer.subVectors(tmpDesired, s.v);
  // Steering gain: reach the desired velocity in ~0.25 s, limited by the max acceleration.
  tmpSteer.multiplyScalar(4);
  const steerLen = tmpSteer.length();
  if (steerLen > maxAccel) tmpSteer.multiplyScalar(maxAccel / steerLen);

  // --- flapping ------------------------------------------------------------------------------
  const speed = s.v.length();
  const busy = clamp(speed / (maxSpeed * 0.5) + dist / (0.6 * k), 0, 1);
  s.effort += (Math.max(0.35, busy) - s.effort) * damp(3, dt);
  const hz = calm ? BUTTERFLY.calmFlapHz : BUTTERFLY.flapHz * (0.7 + 0.3 * s.effort);
  s.flap = (s.flap + dt * hz * Math.PI * 2) % (Math.PI * 200);
  const beat = Math.sin(s.flap);
  // Downstroke (beat > 0) gives lift and a little thrust along the heading; zero-mean so it only bobs.
  const pulse = (calm ? 0.25 : 1) * s.effort * k;
  tmpSteer.y += beat * 4 * pulse;
  // Every few beats a stronger stroke: a visible slow bob (the per-beat bob alone is millimetres).
  tmpSteer.y += Math.sin(s.flap * 0.25 + s.phase) * 3.2 * pulse;
  if (speed > 1e-3) tmpSteer.addScaledVector(s.v, (Math.max(0, beat) - 0.32) * 1.4 * pulse / speed);

  // --- wander --------------------------------------------------------------------------------
  // Stronger in flight, still a little when hovering; Y is the out-of-plane wobble.
  const w = (calm ? 0.25 : 1) * k * (0.5 + 0.9 * s.effort);
  const t = o.t;
  tmpSteer.x += noise1(t * 1.3, s.phase) * 1.6 * w;
  tmpSteer.y += noise1(t * 1.1, s.phase + 11) * 1.0 * w;
  tmpSteer.z += noise1(t * 1.2, s.phase + 23) * 1.6 * w;

  // --- integrate (semi-implicit Euler) -------------------------------------------------------
  s.v.addScaledVector(tmpSteer, dt);
  // A touch of air drag keeps it from ringing.
  s.v.multiplyScalar(Math.exp(-0.6 * dt));
  const vLen = s.v.length();
  const hardMax = maxSpeed * 1.25;
  if (vLen > hardMax) s.v.multiplyScalar(hardMax / vLen);
  s.p.addScaledVector(s.v, dt);

  const minY = o.minY ?? 0.15;
  if (s.p.y < minY) {
    s.p.y = minY;
    if (s.v.y < 0) s.v.y = 0;
  }

  orientToVelocity(s, dt, target);
}

/** Heading follows velocity smoothly; bank into turns; pitch with climb rate. */
function orientToVelocity(s: ButterflyState, dt: number, target: Vector3): void {
  const hx = s.v.x;
  const hz = s.v.z;
  const hSpeed = Math.hypot(hx, hz);
  let yawTarget = s.yaw;
  if (hSpeed > 0.08) yawTarget = Math.atan2(hx, hz);
  else {
    // Hovering: slowly turn to face the target.
    const dx = target.x - s.p.x;
    const dz = target.z - s.p.z;
    if (Math.hypot(dx, dz) > 0.05) yawTarget = Math.atan2(dx, dz);
  }
  const dYaw = angleDelta(s.yaw, yawTarget) * damp(hSpeed > 0.08 ? 6 : 1.5, dt);
  s.yaw += dYaw;
  const yawRate = dYaw / dt;
  // Turning toward +X (positive yaw rate) is a left turn for a body facing +Z: dip the +X wing.
  const rollTarget = clamp(-yawRate * 0.18, -0.7, 0.7);
  s.roll += (rollTarget - s.roll) * damp(5, dt);
  const pitchTarget = clamp(-Math.atan2(s.v.y, Math.max(0.2, hSpeed)) * 0.6, -0.6, 0.6);
  s.pitch += (pitchTarget - s.pitch) * damp(4, dt);
}
