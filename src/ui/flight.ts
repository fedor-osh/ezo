// Pure camera maths for the director: easing, curved flight path, aspect compensation.
// Plain tuples, no Three.js, so it is cheap to test and reason about.

export type Vec = [number, number, number];

export interface Pose {
  position: Vec;
  target: Vec;
  /** Vertical field of view, degrees. */
  fov: number;
}

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

export const easeInOutCubic = (t: number): number => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};

export const distance = (a: Vec, b: Vec): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export const clonePose = (p: Pose): Pose => ({ position: [...p.position], target: [...p.target], fov: p.fov });

/** 1.6 s for a hop, up to 2.4 s for crossing the whole yard. */
export function flightDuration(from: Pose, to: Pose): number {
  const travel = distance(from.position, to.position) + 0.5 * distance(from.target, to.target);
  return 1.6 + 0.8 * clamp01(travel / 18);
}

/**
 * How high the arc rises above the straight line at its middle. Proportional to the distance so short
 * hops under the pergola stay under it, while long flights lift over the roofline and the clotheslines.
 */
export const arcLift = (from: Pose, to: Pose): number => Math.min(2.5, distance(from.position, to.position) * 0.22);

/**
 * Pose at progress `u` ∈ [0, 1] (linear time). Position follows a quadratic Bézier whose control point
 * sits `2 × lift` above the midpoint, so the curve peaks exactly `lift` above it. Endpoints are exact.
 */
export function poseAt(from: Pose, to: Pose, lift: number, u: number, out: Pose = clonePose(from)): Pose {
  const e = easeInOutCubic(u);
  const a = (1 - e) * (1 - e);
  const b = 2 * (1 - e) * e;
  const c = e * e;
  for (let i = 0; i < 3; i++) {
    const p0 = from.position[i];
    const p1 = to.position[i];
    const ctrl = (p0 + p1) / 2 + (i === 1 ? 2 * lift : 0);
    out.position[i] = a * p0 + b * ctrl + c * p1;
    out.target[i] = from.target[i] + (to.target[i] - from.target[i]) * e;
  }
  out.fov = from.fov + (to.fov - from.fov) * e;
  return out;
}

/** Shots are framed for a laptop-ish screen. Narrower screens get a wider lens, then a pull-back. */
export const REFERENCE_ASPECT = 16 / 10;
export const MAX_FOV = 68;
const MAX_PULL_BACK = 1.5;
/** <1 on purpose: matching the full horizontal width on a phone makes the subject tiny. */
const COMPENSATION = 0.8;

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function fitPoseToAspect(shot: Pose, aspect: number, out: Pose = clonePose(shot)): Pose {
  out.target = [...shot.target];
  if (!(aspect > 0) || aspect >= REFERENCE_ASPECT) {
    out.position = [...shot.position];
    out.fov = shot.fov;
    return out;
  }
  const desiredTan = Math.tan(rad(shot.fov) / 2) * (REFERENCE_ASPECT / aspect) ** COMPENSATION;
  const capTan = Math.tan(rad(MAX_FOV) / 2);
  if (desiredTan <= capTan) {
    out.position = [...shot.position];
    out.fov = deg(2 * Math.atan(desiredTan));
    return out;
  }
  const pull = Math.min(MAX_PULL_BACK, desiredTan / capTan);
  out.fov = MAX_FOV;
  out.position = [0, 1, 2].map((i) => shot.target[i] + (shot.position[i] - shot.target[i]) * pull) as Vec;
  return out;
}

/** Frame-rate independent exponential smoothing toward `to`. */
export const damp = (from: number, to: number, lambda: number, dt: number): number =>
  from + (to - from) * (1 - Math.exp(-lambda * dt));
