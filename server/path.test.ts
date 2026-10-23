import { describe, expect, it } from "vitest";
import { MAX_TRACE_PATH } from "../src/shared/protocol.ts";
import { PathRecorder } from "./path.ts";

describe("PathRecorder", () => {
  it("keeps the first point", () => {
    const r = new PathRecorder();
    r.add([0, 0, 0], 0);
    expect(r.points).toEqual([[0, 0, 0]]);
  });

  it("keeps a point only every ~0.4 s", () => {
    const r = new PathRecorder();
    for (let i = 0; i <= 10; i++) r.add([i, 0, 0], i * 100);
    // t = 0, 400, 800
    expect(r.points.map((p) => p[0])).toEqual([0, 4, 8]);
  });

  it("skips points that barely moved", () => {
    const r = new PathRecorder();
    r.add([0, 0, 0], 0);
    r.add([0.1, 0, 0], 1000);
    r.add([0.2, 0, 0], 2000);
    expect(r.points).toEqual([
      [0, 0, 0],
      [0.2, 0, 0],
    ]);
  });

  it("caps the path, dropping the oldest points", () => {
    const r = new PathRecorder();
    for (let i = 0; i < MAX_TRACE_PATH + 10; i++) r.add([i, 0, 0], i * 1000);
    expect(r.points).toHaveLength(MAX_TRACE_PATH);
    expect(r.points[0][0]).toBe(10);
    expect(r.points[MAX_TRACE_PATH - 1][0]).toBe(MAX_TRACE_PATH + 9);
  });

  it("measures total travel including skipped points", () => {
    const r = new PathRecorder();
    r.add([0, 0, 0], 0);
    r.add([0.1, 0, 0], 10);
    r.add([0, 0, 0], 20);
    expect(r.travelled).toBeCloseTo(0.2);
  });
});
