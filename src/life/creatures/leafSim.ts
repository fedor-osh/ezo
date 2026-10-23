// Leaf pointer: it does not follow the cursor, the wind carries it there. Pure math, unit-tested.
//
// Forces: a weak, capped spring toward the target, strong aerodynamic drag relative to the wind,
// gravity mostly balanced by an oscillating lift (the classic falling-leaf flutter: lift depends
// on the leaf's tilt, which rocks back and forth and makes it side-slip), plus a slow tumble.
// Slightly under-damped on purpose: it lags, overshoots and swirls.
import { Vector3 } from "three";
import { clamp, noise1 } from "./util.ts";

export interface LeafState {
  p: Vector3;
  v: Vector3;
  /** Flutter phase (radians): the pendulum rocking of the leaf. */
  flutter: number;
  /** Spin around the world vertical. */
  yaw: number;
  yawRate: number;
  /** Tilts, derived from the flutter phase each step. */
  roll: number;
  pitch: number;
  /** Extra tumble angle around the leaf's long axis, set off by fast motion. */
  tumble: number;
  tumbleRate: number;
  phase: number;
}

export interface LeafOptions {
  scale: number;
  calm: boolean;
  t: number;
  /** Wind velocity at the leaf (from core/wind.ts), or zero. */
  wind: Vector3;
  minY?: number;
}

export const LEAF = {
  /** Spring stiffness toward the target (1/s²). */
  spring: 1.7,
  /** Spring pull is capped at this distance (m, before scale) so far targets don't fling the leaf. */
  springReach: 2.2,
  /** Drag coefficient (1/s), relative to the wind. */
  drag: 2.1,
  /** How much the global wind field pushes a pointer leaf (it must still reach the cursor). */
  windShare: 0.3,
  gravity: 1.4,
  /** Mean flutter lift as a fraction of gravity. */
  lift: 0.88,
  maxSpeed: 6,
} as const;

export function createLeafState(p: Vector3, phase = 0): LeafState {
  return {
    p: p.clone(),
    v: new Vector3(),
    flutter: phase,
    yaw: phase * 3,
    yawRate: 0.4,
    roll: 0,
    pitch: 0,
    tumble: 0,
    tumbleRate: 0,
    phase,
  };
}

const tmpA = new Vector3();
const tmpRel = new Vector3();
const tmpSide = new Vector3();

export function stepLeaf(s: LeafState, target: Vector3, dt: number, o: LeafOptions): void {
  if (dt <= 0) return;
  const k = o.scale;
  const calm = o.calm;
  const flutterAmp = calm ? 0.35 : 1;

  // Weak capped spring.
  tmpA.subVectors(target, s.p);
  const dist = tmpA.length();
  const reach = LEAF.springReach * k;
  if (dist > reach) tmpA.multiplyScalar(reach / dist);
  tmpA.multiplyScalar(LEAF.spring * (calm ? 0.8 : 1));

  // Drag toward the (scaled) wind velocity.
  tmpRel.copy(o.wind).multiplyScalar(LEAF.windShare * (calm ? 0.5 : 1)).sub(s.v);
  tmpA.addScaledVector(tmpRel, LEAF.drag);

  // Flutter: the leaf rocks like a pendulum; lift is strongest when it lies flat, and the tilt
  // makes it slide sideways (toward the low edge).
  const speed = s.v.length();
  s.flutter += dt * (2.4 + 0.5 * Math.min(speed, 3)) * (calm ? 0.6 : 1);
  const rock = Math.sin(s.flutter);
  s.roll = rock * 0.75 * flutterAmp;
  s.pitch = Math.sin(s.flutter * 0.5 + s.phase) * 0.35 * flutterAmp;
  const flatness = Math.cos(s.roll) * Math.cos(s.pitch);
  const g = LEAF.gravity * k;
  tmpA.y += -g + g * LEAF.lift * (0.55 + 0.45 * flatness) / (0.55 + 0.45 * 0.8) * (1 + 0.25 * Math.sin(s.flutter * 2));
  // Side-slip direction: the leaf's local X axis (rotated by its yaw).
  tmpSide.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
  tmpA.addScaledVector(tmpSide, Math.cos(s.flutter) * 1.5 * k * flutterAmp);

  // Integrate.
  s.v.addScaledVector(tmpA, dt);
  const max = LEAF.maxSpeed * k;
  const vLen = s.v.length();
  if (vLen > max) s.v.multiplyScalar(max / vLen);
  s.p.addScaledVector(s.v, dt);
  const minY = o.minY ?? 0.15;
  if (s.p.y < minY) {
    s.p.y = minY;
    if (s.v.y < 0) s.v.y *= -0.2;
  }

  // Spin: slow drift plus a kick from horizontal motion; tumbling when it moves fast.
  const yawRateTarget = (0.35 + noise1(o.t * 0.4, s.phase) * 0.8 + (s.v.x - s.v.z) * 0.25) * (calm ? 0.4 : 1);
  s.yawRate += (yawRateTarget - s.yawRate) * clamp(dt * 1.5, 0, 1);
  s.yaw += s.yawRate * dt;
  const tumbleTarget = calm ? 0 : clamp((speed / k - 1.2) * 2.5, 0, 9);
  s.tumbleRate += (tumbleTarget - s.tumbleRate) * clamp(dt * 2, 0, 1);
  s.tumble += s.tumbleRate * dt;
  // Once slow again, settle the tumble back to a face-up angle.
  if (s.tumbleRate < 0.5) {
    const rest = Math.round(s.tumble / (Math.PI * 2)) * Math.PI * 2;
    s.tumble += (rest - s.tumble) * clamp(dt * 2, 0, 1);
  }
}
