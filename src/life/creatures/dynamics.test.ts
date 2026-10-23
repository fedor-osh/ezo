import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { createButterflyState, stepButterfly } from "./butterflySim.ts";
import { createLeafState, stepLeaf } from "./leafSim.ts";
import { startRide, stepRide, type SurfaceLike } from "./perch.ts";

const DT = 1 / 60;

describe("butterfly", () => {
  for (const calm of [false, true]) {
    it(`converges to a static target and settles (calm=${calm})`, () => {
      const s = createButterflyState(new Vector3(-4, 1, 2), 1.3);
      const target = new Vector3(2, 3, -1);
      let t = 0;
      let maxLateDist = 0;
      let lateSpeed = 0;
      let n = 0;
      for (let i = 0; i < 60 * 20; i++) {
        t += DT;
        stepButterfly(s, target, DT, { scale: 1, calm, t });
        expect(Number.isFinite(s.p.x + s.p.y + s.p.z)).toBe(true);
        if (t > 14) {
          maxLateDist = Math.max(maxLateDist, s.p.distanceTo(target));
          lateSpeed += s.v.length();
          n++;
        }
      }
      // Hovers near the target with a little wander, not racing around it.
      expect(maxLateDist).toBeLessThan(0.3);
      expect(lateSpeed / n).toBeLessThan(0.6);
    });
  }

  it("bobs: the path is not a straight line", () => {
    const s = createButterflyState(new Vector3(0, 2, 0), 0);
    const target = new Vector3(0, 2, -30);
    const ys: number[] = [];
    for (let i = 0; i < 120; i++) {
      stepButterfly(s, target, DT, { scale: 1, calm: false, t: i * DT });
      ys.push(s.p.y);
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.01);
  });

  it("stays above the ground", () => {
    const s = createButterflyState(new Vector3(0, 1, 0), 0);
    for (let i = 0; i < 300; i++) stepButterfly(s, new Vector3(3, -5, 0), DT, { scale: 1, calm: false, t: i * DT });
    expect(s.p.y).toBeGreaterThanOrEqual(0.15);
  });
});

describe("leaf", () => {
  it("stays finite and eventually drifts near the target with no wind", () => {
    const s = createLeafState(new Vector3(5, 4, 3), 0.7);
    const target = new Vector3(-1, 2, 0);
    const wind = new Vector3();
    let t = 0;
    let minDist = Infinity;
    let late = 0;
    let n = 0;
    for (let i = 0; i < 60 * 30; i++) {
      t += DT;
      stepLeaf(s, target, DT, { scale: 1, calm: false, t, wind });
      expect(Number.isFinite(s.p.x + s.p.y + s.p.z + s.yaw + s.tumble)).toBe(true);
      const d = s.p.distanceTo(target);
      minDist = Math.min(minDist, d);
      if (t > 20) {
        late += d;
        n++;
      }
    }
    expect(minDist).toBeLessThan(0.5);
    expect(late / n).toBeLessThan(0.8);
  });

  it("lags behind: it does not reach a far target immediately", () => {
    const s = createLeafState(new Vector3(0, 2, 0), 0);
    const target = new Vector3(6, 2, 0);
    for (let i = 0; i < 30; i++) stepLeaf(s, target, DT, { scale: 1, calm: false, t: i * DT, wind: new Vector3() });
    expect(s.p.distanceTo(target)).toBeGreaterThan(4);
  });

  it("stays finite in strong wind", () => {
    const s = createLeafState(new Vector3(0, 2, 0), 0);
    const wind = new Vector3(8, 1, -3);
    for (let i = 0; i < 60 * 20; i++) stepLeaf(s, new Vector3(0, 2, 0), 1 / 20, { scale: 2, calm: false, t: i / 20, wind });
    expect(Number.isFinite(s.p.length())).toBe(true);
    expect(s.p.length()).toBeLessThan(30);
  });
});

describe("perch", () => {
  it("a perched creature follows a moving surface point", () => {
    let time = 0;
    const surface: SurfaceLike = {
      pointAt(u, v, out, n) {
        out.set(u + Math.sin(time * 3) * 0.4, 3 - v + Math.cos(time * 2) * 0.2, Math.sin(time) * 0.3);
        n?.set(0, 0, 1);
      },
    };
    const pos = new Vector3(0.7, 2.2, 0.2);
    const ride = startRide(surface, "cloth:test", 0.5, 0.45, pos);
    const normal = new Vector3();
    const expected = new Vector3();
    for (let i = 0; i < 180; i++) {
      time += DT;
      stepRide(ride, surface, DT, pos, normal, 0.01);
      surface.pointAt(0.5, 0.45, expected);
      if (i > 90) expect(pos.distanceTo(expected)).toBeLessThan(0.02);
    }
    expect(normal.z).toBeCloseTo(1);
  });

  it("flips the normal to face the viewer", () => {
    const surface: SurfaceLike = { pointAt: (_u, _v, out, n) => (out.set(0, 0, 0), n?.set(0, 0, 1)) };
    const ride = startRide(surface, "s", 0, 0, new Vector3());
    const pos = new Vector3();
    const normal = new Vector3();
    stepRide(ride, surface, DT, pos, normal, 0.05, new Vector3(0, 0, -5));
    expect(normal.z).toBeCloseTo(-1);
    expect(pos.z).toBeCloseTo(-0.05);
  });
});
