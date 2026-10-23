import { describe, expect, it } from "vitest";
import { DEFAULT_STEP, FixedStepper, VerletCloth, type ClothGridSpec, type StepParams, type Vec3 } from "./verlet.ts";

const grid = (overrides: Partial<ClothGridSpec> = {}): ClothGridSpec => ({
  cols: 14,
  rows: 16,
  width: 1,
  height: 1.1,
  place(i, j, out) {
    out[0] = (i / 13) * 1;
    out[1] = 3.5 - (j / 15) * 1.1;
    out[2] = 0;
  },
  pins: [0, 6, 13],
  ...overrides,
});

const params = (wind: Vec3, extra: Partial<StepParams> = {}): StepParams => ({
  ...DEFAULT_STEP,
  wind: (_x, _y, _z, out) => {
    out[0] = wind[0];
    out[1] = wind[1];
    out[2] = wind[2];
  },
  ...extra,
});

const pinSnapshot = (c: VerletCloth) => c.pins.map((k) => Array.from(c.pos.subarray(k * 3, k * 3 + 3)));

describe("VerletCloth", () => {
  it("keeps pinned particles exactly where they were pinned", () => {
    const cloth = new VerletCloth(grid());
    const before = pinSnapshot(cloth);
    expect(before).toHaveLength(3);
    for (let s = 0; s < 600; s++) cloth.step(1 / 90, params([6, 1, -4]));
    expect(pinSnapshot(cloth)).toEqual(before);
  });

  it("settles without NaN under strong gusty wind and stays near its line", () => {
    const cloth = new VerletCloth(grid());
    let t = 0;
    const gusty = params([0, 0, 0], {
      wind: (x, y, z, out) => {
        out[0] = 14 * Math.sin(t * 3 + x * 2);
        out[1] = 6 * Math.sin(t * 5 + y);
        out[2] = -18 + 8 * Math.sin(t * 7 + z);
      },
    });
    for (let s = 0; s < 2000; s++) {
      t += 1 / 90;
      cloth.step(1 / 90, gusty);
    }
    expect(cloth.isFinite()).toBe(true);
    for (let k = 0; k < cloth.count; k++) {
      const d = Math.hypot(cloth.pos[k * 3] - 0.5, cloth.pos[k * 3 + 1] - 3.5, cloth.pos[k * 3 + 2]);
      expect(d).toBeLessThan(2.5);
    }
  });

  it("hangs below its pins at rest with no wind", () => {
    const cloth = new VerletCloth(grid());
    for (let s = 0; s < 900; s++) cloth.step(1 / 90, params([0, 0, 0]));
    const p: Vec3 = [0, 0, 0];
    cloth.sample(0.5, 1, p);
    expect(p[1]).toBeLessThan(3.5 - 0.9);
    expect(Math.abs(p[2])).toBeLessThan(0.05);
  });

  it("survives absurd impulses and recovers", () => {
    const cloth = new VerletCloth(grid());
    cloth.addVelocityAt(0.5, 0.6, 0.3, 1e6, -1e6, 1e6, 1 / 90);
    for (let s = 0; s < 300; s++) cloth.step(1 / 90, params([2, 0, 0]));
    expect(cloth.isFinite()).toBe(true);
  });

  it("masks cells out and keeps dead particles glued to live ones", () => {
    const cloth = new VerletCloth(grid({ mask: (cu, cv) => cv < 0.4 || Math.abs(cu - 0.5) < 0.3 }));
    expect(cloth.indices.length).toBeLessThan(13 * 15 * 6);
    for (let s = 0; s < 300; s++) cloth.step(1 / 90, params([3, 0, -2]));
    const corner = (cloth.rows - 1) * cloth.cols; // bottom-left: masked out
    expect(cloth.live[corner]).toBe(0);
    expect(cloth.pos[corner * 3 + 1]).toBeLessThan(3.5);
    expect(cloth.isFinite()).toBe(true);
  });

  it("samples a front normal pointing toward +z for a cloth whose u runs along +x", () => {
    const cloth = new VerletCloth(grid());
    const p: Vec3 = [0, 0, 0];
    const n: Vec3 = [0, 0, 0];
    cloth.sample(0.5, 0.5, p, n);
    expect(n[2]).toBeGreaterThan(0.99);
  });
});

describe("FixedStepper", () => {
  it("accumulates and caps steps", () => {
    const s = new FixedStepper(0.01, 4);
    expect(s.advance(0.025)).toBe(2);
    expect(s.advance(0.006)).toBe(1);
    expect(s.advance(1)).toBe(4);
    expect(s.advance(0)).toBe(0);
  });
});
