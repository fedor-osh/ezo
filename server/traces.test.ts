import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Trace } from "../src/shared/protocol.ts";
import { TRACE_MAX_AGE_MS, TraceStore } from "./traces.ts";

const DAY = 24 * 60 * 60 * 1000;

const trace = (id: string, leftAt: number): Trace => ({
  id,
  kind: "butterfly",
  color: "#ff6f91",
  name: "Sleepy Churchkhela",
  path: [[0, 1, 2]],
  rest: [0, 1, 2],
  perch: null,
  sections: ["home"],
  arrivedAt: leftAt - 10_000,
  leftAt,
});

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ezo-traces-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("TraceStore", () => {
  it("caps the number of traces, keeping the newest", () => {
    const store = new TraceStore({ file: null, maxTraces: 3 });
    for (let i = 0; i < 5; i++) store.add(trace(`t${i}`, Date.now() + i));
    expect(store.list().map((t) => t.id)).toEqual(["t2", "t3", "t4"]);
  });

  it("drops traces older than 7 days", () => {
    let now = 10 * DAY;
    const store = new TraceStore({ file: null, now: () => now });
    store.add(trace("old", now - 6 * DAY));
    store.add(trace("new", now - DAY));
    expect(store.list()).toHaveLength(2);
    now += 2 * DAY;
    expect(store.list().map((t) => t.id)).toEqual(["new"]);
    expect(TRACE_MAX_AGE_MS).toBe(7 * DAY);
  });

  it("persists atomically and loads back, pruning on load", async () => {
    const file = join(dir, "sub", "ezo.json");
    const now = Date.now();
    const a = new TraceStore({ file, debounceMs: 10 });
    a.countVisitor();
    a.countVisitor();
    a.add(trace("keep", now));
    await a.flush();
    expect(readdirSync(join(dir, "sub"))).toEqual(["ezo.json"]);

    const saved = JSON.parse(readFileSync(file, "utf8"));
    saved.traces.push(trace("expired", now - 8 * DAY));
    writeFileSync(file, JSON.stringify(saved));

    const b = new TraceStore({ file });
    b.load();
    expect(b.totalVisitors).toBe(2);
    expect(b.list().map((t) => t.id)).toEqual(["keep"]);
  });

  it("debounces writes", async () => {
    const file = join(dir, "ezo.json");
    const store = new TraceStore({ file, debounceMs: 30 });
    store.add(trace("a", Date.now()));
    store.add(trace("b", Date.now()));
    expect(() => readFileSync(file)).toThrow();
    await new Promise((r) => setTimeout(r, 80));
    await store.flush();
    expect(JSON.parse(readFileSync(file, "utf8")).traces).toHaveLength(2);
  });

  it("survives a corrupt file and sanitizes bad traces", () => {
    const file = join(dir, "ezo.json");
    writeFileSync(file, "{nope");
    const a = new TraceStore({ file });
    a.load();
    expect(a.list()).toEqual([]);

    writeFileSync(
      file,
      JSON.stringify({
        totalVisitors: "lots",
        traces: [trace("good", Date.now()), { id: 1 }, { ...trace("bad", Date.now()), rest: [NaN, 0] }],
      }),
    );
    const b = new TraceStore({ file });
    b.load();
    expect(b.totalVisitors).toBe(0);
    expect(b.list().map((t) => t.id)).toEqual(["good"]);
  });
});
