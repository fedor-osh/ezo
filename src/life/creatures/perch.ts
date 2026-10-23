// Riding a deforming surface. The creature keeps a landing offset that decays to zero, so it glides
// onto the perch point and then sticks to it exactly, whatever the cloth does. Pure math.
import { Vector3 } from "three";
import { damp } from "./util.ts";

export interface SurfaceLike {
  pointAt(u: number, v: number, outPoint: Vector3, outNormal?: Vector3): void;
}

export interface PerchRide {
  surfaceId: string;
  u: number;
  v: number;
  /** Creature position minus perch point; decays to zero while landing. */
  offset: Vector3;
  /** Seconds since landing. */
  age: number;
}

const tmpP = new Vector3();
const tmpN = new Vector3();

export function startRide(surface: SurfaceLike, surfaceId: string, u: number, v: number, from: Vector3): PerchRide {
  surface.pointAt(u, v, tmpP, tmpN);
  return { surfaceId, u, v, offset: from.clone().sub(tmpP), age: 0 };
}

/**
 * Advance the ride and write the creature position (and the surface normal) for this frame.
 * `standOff` lifts the creature off the surface along the normal (normal flipped to face `viewer`).
 */
export function stepRide(
  ride: PerchRide,
  surface: SurfaceLike,
  dt: number,
  outPos: Vector3,
  outNormal: Vector3,
  standOff = 0,
  viewer?: Vector3,
): void {
  ride.age += dt;
  ride.offset.multiplyScalar(1 - damp(7, dt));
  if (ride.offset.lengthSq() < 1e-8) ride.offset.set(0, 0, 0);
  surface.pointAt(ride.u, ride.v, tmpP, tmpN);
  if (tmpN.lengthSq() < 1e-8) tmpN.set(0, 0, 1);
  tmpN.normalize();
  if (viewer && (tmpP.x - viewer.x) * tmpN.x + (tmpP.y - viewer.y) * tmpN.y + (tmpP.z - viewer.z) * tmpN.z > 0) {
    tmpN.negate();
  }
  outNormal.copy(tmpN);
  outPos.copy(tmpP).addScaledVector(tmpN, standOff).add(ride.offset);
}
