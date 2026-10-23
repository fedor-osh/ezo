import { describe, expect, it } from "vitest";
import { createBrain, nearestThreat, pickSafeSpot, updateBrain, type CatSense, type Spot } from "./catBrain.ts";

const spots: Spot[] = [
  { x: 0, z: 0, y: 0, elevated: false, cosy: true },
  { x: 6, z: 0, y: 0, elevated: false, cosy: false },
  { x: -6, z: 0, y: 0, elevated: false, cosy: false },
  { x: 0, z: 6, y: 0.9, elevated: true, cosy: true },
];

function sense(over: Partial<CatSense> = {}): CatSense {
  let seed = 1;
  return {
    x: 0,
    z: 0,
    flyers: [],
    spots,
    atTarget: false,
    reducedMotion: false,
    rng: () => ((seed = (seed * 16807) % 2147483647) / 2147483647),
    ...over,
  };
}

describe("cat brain", () => {
  it("ignores flyers that are far away or high up", () => {
    expect(nearestThreat(0, 0, [{ x: 3, y: 0.5, z: 0 }])).toBeNull();
    expect(nearestThreat(0, 0, [{ x: 0.5, y: 2.5, z: 0 }])).toBeNull();
    expect(nearestThreat(0, 0, [{ x: 1, y: 1, z: 0 }])?.d).toBeCloseTo(1);
  });

  it("flinches then flees when a flyer swoops in low", () => {
    const b = createBrain(0, () => 0.5);
    b.mode = "rest";
    b.timer = 100;
    const s = sense({ flyers: [{ x: 1.5, y: 0.6, z: 0 }] });
    updateBrain(b, s, 1 / 60);
    expect(b.mode).toBe("flinch");
    expect(b.threat).toEqual({ x: 1.5, z: 0 });
    for (let i = 0; i < 40; i++) updateBrain(b, s, 1 / 60);
    expect(b.mode).toBe("flee");
  });

  it("picks a safe spot on the far side of the threat", () => {
    // Threat at +x: the spot at -x is the obvious escape.
    expect(pickSafeSpot(0, 0, { x: 1.5, z: 0 }, spots)).toBe(2);
    // Threat at -x: run to +x.
    expect(pickSafeSpot(0, 0, { x: -1.5, z: 0 }, spots)).toBe(1);
  });

  it("calms down after the threat leaves", () => {
    const b = createBrain(0, () => 0.5);
    updateBrain(b, sense({ flyers: [{ x: 1, y: 0.5, z: 0 }] }), 0.016);
    expect(b.mode).toBe("flinch");
    const calm = sense({ x: -6, z: 0, atTarget: true });
    for (let i = 0; i < 60 * 3; i++) updateBrain(b, calm, 1 / 60);
    expect(b.mode).toBe("recover");
    for (let i = 0; i < 60 * 8; i++) updateBrain(b, calm, 1 / 60);
    expect(b.fear).toBeLessThan(0.6);
    expect(["sit", "walk", "groom", "rest"]).toContain(b.mode);
  });

  it("a resting cat eventually gets up and goes somewhere", () => {
    const b = createBrain(0, () => 0.9);
    const s = sense();
    const seen = new Set<string>();
    for (let i = 0; i < 60 * 120; i++) {
      updateBrain(b, s, 1 / 60);
      seen.add(b.mode);
    }
    expect(seen.has("walk")).toBe(true);
    expect(seen.has("flee")).toBe(false);
  });
});
