import { describe, expect, it } from "vitest";
import {
  MAX_FOV,
  REFERENCE_ASPECT,
  arcLift,
  distance,
  easeInOutCubic,
  fitPoseToAspect,
  flightDuration,
  poseAt,
  type Pose,
} from "./flight.ts";

const home: Pose = { position: [0, 5.2, 14.5], target: [0, 2.2, -2], fov: 50 };
const work: Pose = { position: [-1, 1.55, 3], target: [-3, 1.15, -1.6], fov: 46 };

describe("easing", () => {
  it("hits 0, ½ and 1 exactly and clamps outside", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
  });

  it("is monotonic", () => {
    let prev = 0;
    for (let i = 1; i <= 100; i++) {
      const v = easeInOutCubic(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("flight path", () => {
  const lift = arcLift(home, work);

  it("starts and ends exactly on the poses", () => {
    expect(poseAt(home, work, lift, 0)).toEqual(home);
    expect(poseAt(home, work, lift, 1)).toEqual(work);
    expect(poseAt(home, work, lift, 1.4)).toEqual(work);
  });

  it("peaks `lift` above the straight midpoint", () => {
    const mid = poseAt(home, work, lift, 0.5);
    expect(mid.position[1]).toBeCloseTo((home.position[1] + work.position[1]) / 2 + lift, 10);
    expect(mid.position[0]).toBeCloseTo((home.position[0] + work.position[0]) / 2, 10);
  });

  it("keeps short hops low so they stay under the pergola", () => {
    const a: Pose = { position: [-1, 1.55, 3], target: [0, 0, 0], fov: 46 };
    const b: Pose = { position: [-1.5, 2.2, 1.5], target: [0, 0, 0], fov: 52 };
    expect(arcLift(a, b)).toBeLessThan(0.5);
    expect(arcLift(home, { ...home, position: [40, 5, -40] })).toBe(2.5);
  });

  it("lasts 1.6–2.4 s depending on distance", () => {
    expect(flightDuration(work, work)).toBeCloseTo(1.6);
    expect(flightDuration(home, work)).toBeGreaterThan(1.6);
    expect(flightDuration(home, { ...home, position: [100, 0, 0] })).toBeCloseTo(2.4);
  });

  it("writes into a reusable output without touching the inputs", () => {
    const out: Pose = { position: [0, 0, 0], target: [0, 0, 0], fov: 0 };
    const homeCopy = structuredClone(home);
    poseAt(home, work, lift, 0.3, out);
    expect(home).toEqual(homeCopy);
    expect(out.fov).toBeGreaterThan(work.fov);
    expect(out.fov).toBeLessThan(home.fov);
  });
});

describe("aspect compensation", () => {
  it("leaves wide screens untouched", () => {
    expect(fitPoseToAspect(home, REFERENCE_ASPECT)).toEqual(home);
    expect(fitPoseToAspect(home, 2.4)).toEqual(home);
  });

  it("widens the lens on narrower screens", () => {
    const tablet = fitPoseToAspect(home, 1.2);
    expect(tablet.fov).toBeGreaterThan(home.fov);
    expect(tablet.position).toEqual(home.position);
  });

  it("caps the fov and pulls back along the view line on portrait phones", () => {
    const phone = fitPoseToAspect(home, 375 / 812);
    expect(phone.fov).toBe(MAX_FOV);
    expect(phone.target).toEqual(home.target);
    const before = distance(home.position, home.target);
    const after = distance(phone.position, phone.target);
    expect(after).toBeGreaterThan(before);
    expect(after).toBeLessThanOrEqual(before * 1.5 + 1e-9);
    // Same direction: the subject stays centred.
    const dir = (p: Pose) => p.position.map((v, i) => (v - p.target[i]) / distance(p.position, p.target));
    dir(phone).forEach((v, i) => expect(v).toBeCloseTo(dir(home)[i], 10));
  });

  it("is safe with a degenerate aspect", () => {
    expect(fitPoseToAspect(home, 0)).toEqual(home);
    expect(fitPoseToAspect(home, Number.NaN)).toEqual(home);
  });
});
