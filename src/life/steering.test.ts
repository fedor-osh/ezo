import { describe, expect, it } from "vitest";
import { clearance, obstacleFromSpec, resolvePenetration, signedDistance, type Bounds } from "./obstacles.ts";
import { fleeDirection, freeDistance, steer } from "./steering.ts";

const bounds: Bounds = { minX: -10, maxX: 10, minZ: -8, maxZ: 8 };
const opts = { radius: 0.2, lookahead: 1.5 };

describe("obstacle footprints", () => {
  it("signed distance of a rotated box", () => {
    const box = obstacleFromSpec({ shape: "box", position: [0, 0.5, 0], half: [1, 0.5, 0.25], rotationY: Math.PI / 2 });
    // Rotated 90°: the long side now runs along Z.
    expect(signedDistance(box, 0, 0.9)).toBeLessThan(0);
    expect(signedDistance(box, 0.9, 0)).toBeCloseTo(0.65, 3);
  });

  it("circle distance and bounds clearance", () => {
    const c = obstacleFromSpec({ shape: "cylinder", position: [2, 1, 0], radius: 0.5, halfHeight: 1 });
    expect(signedDistance(c, 3, 0)).toBeCloseTo(0.5);
    expect(clearance([c], bounds, 9.5, 0)).toBeCloseTo(0.5);
  });

  it("pushes a walker out of a box and back into the yard", () => {
    const box = obstacleFromSpec({ shape: "box", position: [0, 0.5, 0], half: [1, 0.5, 1] });
    const p = resolvePenetration([box], bounds, 0.9, 0, 0.2);
    expect(signedDistance(box, p.x, p.z)).toBeGreaterThanOrEqual(0.19);
    const q = resolvePenetration([], bounds, 12, -9, 0.2);
    expect(q).toEqual({ x: 9.8, z: -7.8 });
  });
});

describe("steering", () => {
  const wall = obstacleFromSpec({ shape: "box", position: [1, 0.5, 0], half: [0.2, 0.5, 1] });

  it("keeps the desired heading when the way is clear", () => {
    const d = steer({ x: 0, z: 0 }, { x: 0, z: 1 }, [wall], bounds, opts);
    expect(d.x).toBeCloseTo(0);
    expect(d.z).toBeCloseTo(1);
  });

  it("turns to avoid a box in the way", () => {
    const pos = { x: 0, z: 0 };
    expect(freeDistance([wall], bounds, pos, 1, 0, opts.radius, opts.lookahead)).toBeLessThan(1);
    const d = steer(pos, { x: 1, z: 0 }, [wall], bounds, opts);
    // Still heading roughly forward, but no longer straight into the wall.
    expect(Math.abs(d.z)).toBeGreaterThan(0.3);
    expect(freeDistance([wall], bounds, pos, d.x, d.z, opts.radius, 0.6)).toBeGreaterThan(0.5);
  });

  it("flees away from a threat", () => {
    const d = fleeDirection({ x: 0, z: 0 }, [{ x: -1, z: 0 }], [], bounds, opts);
    expect(d.x).toBeGreaterThan(0.9);
  });

  it("flees around an obstacle instead of into it", () => {
    const d = fleeDirection({ x: 0, z: 0 }, [{ x: -1, z: 0 }], [wall], bounds, opts);
    expect(d.x).toBeGreaterThan(0); // still away from the threat
    expect(Math.abs(d.z)).toBeGreaterThan(0.3); // but around the wall
  });

  it("a cornered cat runs along the wall, not into it", () => {
    const d = fleeDirection({ x: 9.6, z: 0 }, [{ x: 8.6, z: 0.3 }], [], bounds, opts);
    expect(9.6 + d.x * 0.5).toBeLessThan(10 - opts.radius);
  });
});
